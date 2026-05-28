import { useRef, useState } from "react";
import { Card, SectionTitle, Button, Modal, Field, Input, Select, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { brl, fmtDate, uid } from "../lib/format";
import { copy, waLink } from "../lib/helpers";
import { useToast } from "../components/Toast";
import type { Contract } from "../lib/types";

const empty = (): Contract => ({
  id: uid(),
  clientName: "",
  cpf: "",
  partyDate: "",
  theme: "",
  value: 0,
  deposit: 0,
  signed: false,
  signature: "",
  createdAt: new Date().toISOString().slice(0, 10),
});

const RULES_USE = [
  "A decoração é locada no formato Pegue e Monte, com retirada/montagem conforme combinado.",
  "O cliente é responsável pela conservação das peças durante o período de locação.",
  "Não é permitido o uso de fitas, colas ou objetos que danifiquem as peças.",
];
const RULES_RETURN = [
  "A devolução deve ocorrer na data e horário acordados, com as peças limpas.",
  "Peças danificadas ou perdidas serão cobradas conforme valor de reposição.",
  "O sinal não é reembolsável em caso de cancelamento com menos de 7 dias.",
];

const contractText = (c: Contract) =>
  `📑 *CONTRATO DE LOCAÇÃO — Festa & Cia*\n\n` +
  `Contratante: ${c.clientName} (CPF ${c.cpf || "—"})\n` +
  `Tema: ${c.theme} • Festa em ${fmtDate(c.partyDate)}\n` +
  `Valor total: ${brl(c.value)} • Sinal: ${brl(c.deposit)}\n` +
  `Restante: ${brl(c.value - c.deposit)}\n\n` +
  `*Regras de uso:*\n${RULES_USE.map((r) => "• " + r).join("\n")}\n\n` +
  `*Regras de devolução:*\n${RULES_RETURN.map((r) => "• " + r).join("\n")}\n\n` +
  (c.signed ? `✍️ Assinado digitalmente por: ${c.signature}` : "Aguardando assinatura.");

export default function Contracts() {
  const { contracts, setContracts, clients, themes } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [c, setC] = useState<Contract>(empty());
  const [signOpen, setSignOpen] = useState<Contract | null>(null);
  const [sigName, setSigName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const save = () => {
    if (!c.clientName.trim()) return toast("Informe o cliente");
    const exists = contracts.some((x) => x.id === c.id);
    setContracts(exists ? contracts.map((x) => (x.id === c.id ? c : x)) : [c, ...contracts]);
    setOpen(false);
    toast(exists ? "Contrato atualizado!" : "Contrato gerado!");
  };

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = "#7c6f9e";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => (drawing.current = false);
  const clearSig = () => {
    const cv = canvasRef.current!;
    cv.getContext("2d")!.clearRect(0, 0, cv.width, cv.height);
  };

  const confirmSign = () => {
    if (!sigName.trim() && signOpen) return toast("Digite o nome para assinar");
    if (!signOpen) return;
    setContracts(contracts.map((x) => (x.id === signOpen.id ? { ...x, signed: true, signature: sigName } : x)));
    setSignOpen(null);
    setSigName("");
    toast("Contrato assinado digitalmente! ✍️");
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Contrato automático"
        subtitle="Gere, assine e envie contratos profissionais"
        action={<Button onClick={() => { setC(empty()); setOpen(true); }}><Icon.plus className="h-4 w-4" /> Gerar contrato</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {contracts.map((item) => {
          const client = clients.find((cl) => cl.name === item.clientName);
          return (
            <Card key={item.id} className="animate-rise">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-stone-800">{item.clientName}</p>
                  <p className="text-xs text-stone-500">CPF {item.cpf || "—"} • {item.theme}</p>
                </div>
                {item.signed ? <Badge color="green">✍️ Assinado</Badge> : <Badge color="amber">Pendente</Badge>}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-white/60 py-2"><p className="text-stone-400">Festa</p><p className="font-semibold text-stone-700">{fmtDate(item.partyDate)}</p></div>
                <div className="rounded-xl bg-white/60 py-2"><p className="text-stone-400">Valor</p><p className="font-semibold text-stone-700">{brl(item.value)}</p></div>
                <div className="rounded-xl bg-white/60 py-2"><p className="text-stone-400">Sinal</p><p className="font-semibold text-emerald-600">{brl(item.deposit)}</p></div>
              </div>
              {item.signed && <p className="mt-3 rounded-xl bg-lilac-100/50 px-3 py-2 text-center text-sm italic text-lilac-400">Assinado por {item.signature}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {!item.signed && <Button className="!px-3 !py-2 text-xs" onClick={() => { setSignOpen(item); setTimeout(clearSig, 50); }}>✍️ Assinar</Button>}
                {client?.whatsapp && (
                  <a href={waLink(client.whatsapp, contractText(item))} target="_blank" rel="noreferrer">
                    <Button variant="wa" className="!px-3 !py-2 text-xs"><Icon.wa className="h-4 w-4" /> Enviar</Button>
                  </a>
                )}
                <Button variant="soft" className="!px-3 !py-2 text-xs" onClick={async () => { await copy(contractText(item)); toast("Contrato copiado!"); }}><Icon.copy className="h-4 w-4" /> Copiar</Button>
                <button onClick={() => { setC(item); setOpen(true); }} className="ml-auto rounded-xl bg-white/70 px-3 py-2 text-xs font-medium text-stone-500 hover:bg-white">Editar</button>
              </div>
            </Card>
          );
        })}
        {contracts.length === 0 && <Card className="col-span-full text-center text-stone-400">Nenhum contrato ainda 📑</Card>}
      </div>

      {/* Rules reference */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><SectionTitle title="Regras de uso" /><ul className="space-y-2 text-sm text-stone-600">{RULES_USE.map((r, i) => <li key={i} className="flex gap-2"><span className="text-lilac-400">•</span>{r}</li>)}</ul></Card>
        <Card><SectionTitle title="Regras de devolução" /><ul className="space-y-2 text-sm text-stone-600">{RULES_RETURN.map((r, i) => <li key={i} className="flex gap-2"><span className="text-nude-400">•</span>{r}</li>)}</ul></Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Gerar contrato" wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do cliente">
            <Input list="cclist" value={c.clientName} onChange={(e) => setC({ ...c, clientName: e.target.value })} />
            <datalist id="cclist">{clients.map((cl) => <option key={cl.id} value={cl.name} />)}</datalist>
          </Field>
          <Field label="CPF"><Input value={c.cpf} onChange={(e) => setC({ ...c, cpf: e.target.value })} placeholder="000.000.000-00" /></Field>
          <Field label="Data da festa"><Input type="date" value={c.partyDate} onChange={(e) => setC({ ...c, partyDate: e.target.value })} /></Field>
          <Field label="Tema contratado">
            <Select value={c.theme} onChange={(e) => setC({ ...c, theme: e.target.value })}>
              <option value="">Selecione...</option>
              {themes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Valor total (R$)"><Input type="number" value={c.value || ""} onChange={(e) => setC({ ...c, value: +e.target.value })} /></Field>
          <Field label="Valor do sinal (R$)"><Input type="number" value={c.deposit || ""} onChange={(e) => setC({ ...c, deposit: +e.target.value })} /></Field>
        </div>
        <div className="mt-6 flex gap-3"><Button variant="ghost" onClick={() => setOpen(false)} className="ml-auto">Cancelar</Button><Button onClick={save}>Gerar contrato</Button></div>
      </Modal>

      <Modal open={!!signOpen} onClose={() => setSignOpen(null)} title="Assinatura digital">
        <p className="mb-3 text-sm text-stone-500">Assine no quadro abaixo e confirme com seu nome.</p>
        <canvas
          ref={canvasRef}
          width={460}
          height={170}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full touch-none rounded-2xl border border-dashed border-lilac-300 bg-white"
        />
        <div className="mt-3 flex items-center gap-3">
          <button onClick={clearSig} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-medium text-stone-500 hover:bg-white">Limpar</button>
          <Input value={sigName} onChange={(e) => setSigName(e.target.value)} placeholder="Digite seu nome completo" />
        </div>
        <div className="mt-5 flex gap-3"><Button variant="ghost" onClick={() => setSignOpen(null)} className="ml-auto">Cancelar</Button><Button onClick={confirmSign}>Confirmar assinatura</Button></div>
      </Modal>
    </div>
  );
}
