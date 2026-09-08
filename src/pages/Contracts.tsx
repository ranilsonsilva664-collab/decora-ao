import { useRef, useState } from "react";
import { Card, SectionTitle, Button, Modal, Field, Input, Select, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { brl, fmtDate, uid } from "../lib/format";
import { copy, waLink } from "../lib/helpers";
import { useToast } from "../components/Toast";
import type { Contract, ContractStatus } from "../lib/types";

export default function Contracts() {
  const {
    contracts,
    setContracts,
    clients,
    themes,
    companySettings,
    contractRules,
    setContractRules,
    tenantId,
    logAction,
  } = useStore();

  const toast = useToast();
  const [open, setOpen] = useState(false);

  const emptyContract = (): Contract => ({
    id: uid(),
    clientName: "",
    cpf: "",
    partyDate: new Date().toISOString().slice(0, 10),
    theme: "",
    items: [],
    value: 0,
    deposit: 0,
    delivery: 0,
    assembly: 0,
    discount: 0,
    pickupDate: new Date().toISOString().slice(0, 10),
    pickupTime: "09:00",
    returnDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    returnTime: "12:00",
    signed: false,
    signature: "",
    status: "Pendente",
    createdAt: new Date().toISOString().slice(0, 10),
    customTerms: companySettings.terms || contractRules,
  });

  const [c, setC] = useState<Contract>(emptyContract());
  const [signOpen, setSignOpen] = useState<Contract | null>(null);
  const [sigName, setSigName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const getSignLink = (contractId: string) =>
    `${window.location.origin}/assinar/${tenantId}/${contractId}`;

  const contractText = (item: Contract) => {
    const signUrl = getSignLink(item.id);
    return (
      `📑 *CONTRATO DE LOCAÇÃO — ${companySettings.tradeName || "RAYDECOR"}*\n\n` +
      `👤 *Contratante:* ${item.clientName} (CPF ${item.cpf || "—"})\n` +
      `🎉 *Tema:* ${item.theme} • Festa em ${fmtDate(item.partyDate)}\n` +
      `📦 *Retirada:* ${fmtDate(item.pickupDate || item.partyDate)}\n` +
      `↩️ *Devolução:* ${fmtDate(item.returnDate || item.partyDate)}\n\n` +
      `💰 *Valor total:* ${brl(item.value)}\n` +
      `💳 *Sinal (reserva):* ${brl(item.deposit)}\n` +
      `📌 *Saldo restante:* ${brl(item.value - item.deposit)}\n\n` +
      (item.signed
        ? `✍️ *Status: ASSINADO DIGITALMENTE* por ${item.signature}\nData: ${
            item.signedAt ? fmtDate(item.signedAt) : "Confirmado"
          }`
        : `✍️ *Para assinar pelo celular, clique no link abaixo:*\n${signUrl}`)
    );
  };

  const save = () => {
    if (!c.clientName.trim()) return toast("Informe a cliente");
    const exists = contracts.some((x) => x.id === c.id);
    const updated = exists ? contracts.map((x) => (x.id === c.id ? c : x)) : [c, ...contracts];
    setContracts(updated);
    setOpen(false);
    logAction(
      exists ? "Contrato Atualizado" : "Novo Contrato Gerado",
      `${c.clientName} - ${c.theme} (${brl(c.value)})`
    );
    toast(exists ? "Contrato atualizado!" : "Contrato gerado com sucesso!");
  };

  // Canvas Handlers
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
    ctx.strokeStyle = "#4a044e";
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
    if (!sigName.trim() && signOpen) return toast("Digite o nome completo para assinar");
    if (!signOpen) return;

    setContracts(
      contracts.map((x) =>
        x.id === signOpen.id
          ? {
              ...x,
              signed: true,
              signature: sigName.trim(),
              signedAt: new Date().toISOString(),
              status: "Assinado" as ContractStatus,
            }
          : x
      )
    );
    logAction("Contrato Assinado", `Contrato #${signOpen.id} assinado por ${sigName.trim()}`);
    setSignOpen(null);
    setSigName("");
    toast("Contrato assinado digitalmente! ✍️");
  };

  // REQUISITO 23: GERAR PDF PROFISSIONAL DE CONTRATO
  const generateContractPdf = (item: Contract) => {
    const w = window.open("", "_blank");
    if (!w) return;

    const logo = companySettings.logo || "";
    const compName = companySettings.name || "RAYDECOR Pegue e Monte";
    const signUrl = getSignLink(item.id);

    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Contrato — ${item.clientName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Poppins', Arial, sans-serif; padding: 30px; color: #222; background: #fff; font-size: 12px; line-height: 1.6; }
          .container { max-width: 760px; margin: 0 auto; border: 1px solid #fae8ff; border-radius: 20px; padding: 40px; box-shadow: 0 10px 30px rgba(217, 70, 239, 0.08); }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #fae8ff; padding-bottom: 20px; margin-bottom: 25px; }
          .logo { height: 64px; width: 64px; object-fit: cover; border-radius: 14px; border: 1px solid #fce7f3; }
          .brand h1 { font-size: 20px; color: #ec4899; font-weight: 700; }
          .brand p { font-size: 11px; color: #777; }
          .badge { background: #fdf2f8; color: #db2777; padding: 6px 14px; border-radius: 999px; font-weight: 700; font-size: 11px; text-transform: uppercase; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 12px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; border-left: 3px solid #ec4899; padding-left: 8px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #faf8fd; padding: 14px; border-radius: 14px; }
          .grid-item b { color: #444; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { text-align: left; background: #fdf2f8; color: #db2777; padding: 8px 10px; font-size: 11px; font-weight: 600; border-radius: 6px; }
          td { padding: 8px 10px; border-bottom: 1px solid #f5f5f5; font-size: 11px; }
          .terms-box { background: #faf8fd; border: 1px solid #f3e8ff; padding: 15px; border-radius: 14px; font-size: 11px; color: #555; white-space: pre-line; line-height: 1.6; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 40px; padding-top: 20px; }
          .sig-box { text-align: center; border-top: 1px solid #ccc; padding-top: 10px; }
          .sig-stamp { display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; padding: 6px 16px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-bottom: 10px; }
          @media print { body { padding: 0; } .container { border: none; box-shadow: none; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="display:flex; align-items:center; gap:15px;">
              ${logo ? `<img src="${logo}" class="logo" alt="Logo">` : ""}
              <div class="brand">
                <h1>${compName}</h1>
                <p>Instrumento Particular de Locação de Bens Móveis Pegue e Monte</p>
                ${companySettings.cnpjCpf ? `<p>CNPJ/CPF: ${companySettings.cnpjCpf}</p>` : ""}
              </div>
            </div>
            <div class="badge">Contrato #${item.id.slice(0, 6).toUpperCase()}</div>
          </div>

          <div class="section">
            <div class="section-title">1. Partes Contratantes</div>
            <div class="grid">
              <div class="grid-item"><b>LOCADORA:</b> ${compName}</div>
              <div class="grid-item"><b>RESPONSÁVEL:</b> ${companySettings.ownerName || "A Gerência"}</div>
              <div class="grid-item"><b>LOCATÁRIA:</b> ${item.clientName}</div>
              <div class="grid-item"><b>CPF DA CLIENTE:</b> ${item.cpf || "Não informado"}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">2. Objeto e Cronograma da Locação</div>
            <div class="grid">
              <div class="grid-item"><b>Tema Contratado:</b> ${item.theme}</div>
              <div class="grid-item"><b>Data do Evento:</b> ${fmtDate(item.partyDate)}</div>
              <div class="grid-item"><b>Data de Retirada:</b> ${fmtDate(item.pickupDate || item.partyDate)} às ${item.pickupTime || "09:00"}</div>
              <div class="grid-item"><b>Data de Devolução:</b> ${fmtDate(item.returnDate || item.partyDate)} às ${item.returnTime || "12:00"}</div>
            </div>

            ${
              item.items && item.items.length > 0
                ? `
              <table style="margin-top:15px;">
                <thead>
                  <tr>
                    <th>Peça / Material Alugado</th>
                    <th style="text-align:center;">Qtd</th>
                    <th style="text-align:right;">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  ${item.items
                    .map(
                      (it) => `
                    <tr>
                      <td><b>${it.name}</b></td>
                      <td style="text-align:center;">${it.quantity}x</td>
                      <td style="text-align:right;">${brl(it.subtotal)}</td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            `
                : ""
            }
          </div>

          <div class="section">
            <div class="section-title">3. Valores e Condições de Pagamento</div>
            <div class="grid">
              <div class="grid-item"><b>Valor Total da Locação:</b> ${brl(item.value)}</div>
              <div class="grid-item"><b>Sinal Pago (Reserva):</b> ${brl(item.deposit)}</div>
              <div class="grid-item"><b>Saldo Restante na Retirada:</b> ${brl(item.value - item.deposit)}</div>
              <div class="grid-item"><b>Forma de Pagamento:</b> Pix / Dinheiro / Cartão</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">4. Cláusulas e Termos de Uso e Conservação</div>
            <div class="terms-box">
              ${item.customTerms || companySettings.terms || contractRules}
            </div>
          </div>

          <div class="signatures">
            <div class="sig-box">
              <p><b>${compName}</b></p>
              <p style="font-size:10px; color:#888;">Locadora</p>
            </div>
            <div class="sig-box">
              ${
                item.signed
                  ? `
                <div class="sig-stamp">✓ ASSINADO DIGITALMENTE</div>
                <p><b>${item.signature}</b></p>
                <p style="font-size:10px; color:#666;">Data: ${
                  item.signedAt ? fmtDate(item.signedAt) : "Confirmado"
                }</p>
              `
                  : `
                <p style="margin-top:20px;">_________________________________________</p>
                <p><b>${item.clientName}</b></p>
                <p style="font-size:10px; color:#888;">Locatária</p>
              `
              }
            </div>
          </div>
        </div>
        <script>window.print()</script>
      </body>
      </html>
    `);
    w.document.close();
    toast("Gerando PDF do contrato...");
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Contratos & Assinatura Digital"
        subtitle="Emissão de contratos profissionais com assinatura pelo celular e geração de PDF"
        action={
          <Button
            onClick={() => {
              setC(emptyContract());
              setOpen(true);
            }}
          >
            <Icon.plus className="h-4 w-4" /> Novo Contrato
          </Button>
        }
      />

      {/* Contracts List */}
      <div className="grid gap-4 lg:grid-cols-2">
        {contracts.map((item) => {
          const client = clients.find(
            (cl) => cl.name.toLowerCase() === item.clientName.toLowerCase()
          );
          const signUrl = getSignLink(item.id);

          return (
            <Card key={item.id} className="animate-rise flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-bold text-stone-800 text-base">{item.clientName}</h3>
                    <p className="text-xs text-stone-500">
                      CPF: {item.cpf || "Não informado"} • Tema: {item.theme}
                    </p>
                  </div>
                  {item.signed ? (
                    <Badge color="green">✍️ Assinado</Badge>
                  ) : (
                    <Badge color="amber">Aguardando Assinatura</Badge>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-white/60 py-2">
                    <p className="text-stone-400 text-[10px]">Data Festa</p>
                    <p className="font-semibold text-stone-700">{fmtDate(item.partyDate)}</p>
                  </div>
                  <div className="rounded-xl bg-white/60 py-2">
                    <p className="text-stone-400 text-[10px]">Valor Total</p>
                    <p className="font-semibold text-stone-700">{brl(item.value)}</p>
                  </div>
                  <div className="rounded-xl bg-white/60 py-2">
                    <p className="text-stone-400 text-[10px]">Sinal Pago</p>
                    <p className="font-semibold text-emerald-600">{brl(item.deposit)}</p>
                  </div>
                </div>

                {item.signed && (
                  <div className="mt-3 rounded-2xl bg-emerald-50/80 p-2.5 text-center text-xs text-emerald-700 border border-emerald-100">
                    ✓ Assinado digitalmente por <b>{item.signature}</b>{" "}
                    {item.signedAt ? `(${fmtDate(item.signedAt)})` : ""}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center gap-2">
                {!item.signed && (
                  <Button
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => {
                      setSignOpen(item);
                      setTimeout(clearSig, 50);
                    }}
                  >
                    ✍️ Assinar no App
                  </Button>
                )}

                <Button
                  variant="gold"
                  className="!px-3 !py-1.5 text-xs"
                  onClick={() => generateContractPdf(item)}
                >
                  <Icon.pdf className="h-4 w-4" /> Gerar PDF
                </Button>

                {client?.whatsapp && (
                  <a
                    href={waLink(client.whatsapp, contractText(item))}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="wa" className="!px-3 !py-1.5 text-xs">
                      <Icon.wa className="h-4 w-4" /> WhatsApp
                    </Button>
                  </a>
                )}

                <Button
                  variant="soft"
                  className="!px-3 !py-1.5 text-xs"
                  onClick={async () => {
                    await copy(signUrl);
                    toast("Link de assinatura copiado!");
                  }}
                >
                  <Icon.copy className="h-4 w-4" /> Link Assinatura
                </Button>

                <button
                  onClick={() => {
                    setC(item);
                    setOpen(true);
                  }}
                  className="ml-auto rounded-xl bg-white/70 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-white"
                >
                  Editar
                </button>
              </div>
            </Card>
          );
        })}

        {contracts.length === 0 && (
          <Card className="col-span-full text-center text-stone-400 py-12">
            Nenhum contrato gerado ainda 📑
          </Card>
        )}
      </div>

      {/* Regras Padrão de Contrato */}
      <Card>
        <SectionTitle
          title="Cláusulas e Regras Padrão de Contrato"
          subtitle="Estes termos são inseridos automaticamente em novos contratos"
        />
        <textarea
          className="w-full rounded-2xl border border-white/80 bg-white/60 p-4 text-xs text-stone-700 outline-none focus:ring-2 focus:ring-lilac-400 font-mono leading-relaxed"
          rows={7}
          value={contractRules}
          onChange={(e) => setContractRules(e.target.value)}
        />
      </Card>

      {/* MODAL: NOVO / EDITAR CONTRATO */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={contracts.some((x) => x.id === c.id) ? "Editar Contrato" : "Gerar Contrato"}
        wide
      >
        <div className="space-y-4 mt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da Cliente">
              <Input
                list="cclist"
                value={c.clientName}
                onChange={(e) => {
                  const name = e.target.value;
                  const found = clients.find((cl) => cl.name.toLowerCase() === name.toLowerCase());
                  setC({
                    ...c,
                    clientName: name,
                    cpf: found?.cpf || c.cpf,
                    clientId: found?.id || c.clientId,
                  });
                }}
                placeholder="Selecione ou digite a cliente"
              />
              <datalist id="cclist">
                {clients.map((cl) => (
                  <option key={cl.id} value={cl.name} />
                ))}
              </datalist>
            </Field>

            <Field label="CPF da Cliente">
              <Input
                value={c.cpf || ""}
                onChange={(e) => setC({ ...c, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data da Festa">
              <Input
                type="date"
                value={c.partyDate}
                onChange={(e) => setC({ ...c, partyDate: e.target.value })}
              />
            </Field>
            <Field label="Tema Contratado">
              <Input
                list="cthemelist"
                value={c.theme}
                onChange={(e) => setC({ ...c, theme: e.target.value })}
                placeholder="Nome do tema"
              />
              <datalist id="cthemelist">
                {themes.map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data Retirada das Peças">
              <Input
                type="date"
                value={c.pickupDate || c.partyDate}
                onChange={(e) => setC({ ...c, pickupDate: e.target.value })}
              />
            </Field>
            <Field label="Data Devolução Prevista">
              <Input
                type="date"
                value={c.returnDate || c.partyDate}
                onChange={(e) => setC({ ...c, returnDate: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor Total do Contrato (R$)">
              <Input
                type="number"
                step="0.01"
                value={c.value || ""}
                onChange={(e) => setC({ ...c, value: +e.target.value })}
              />
            </Field>
            <Field label="Valor do Sinal (R$)">
              <Input
                type="number"
                step="0.01"
                value={c.deposit || ""}
                onChange={(e) => setC({ ...c, deposit: +e.target.value })}
              />
            </Field>
          </div>

          <Field label="Termos e Cláusulas Específicas do Contrato">
            <textarea
              className="w-full rounded-2xl border border-white/80 bg-white/60 p-4 text-xs text-stone-700 outline-none focus:ring-2 focus:ring-lilac-400 font-mono leading-relaxed"
              rows={6}
              value={c.customTerms || ""}
              onChange={(e) => setC({ ...c, customTerms: e.target.value })}
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {contracts.some((x) => x.id === c.id) && (
            <Button
              variant="soft"
              className="!text-rose-500"
              onClick={() => {
                if (confirm("Remover este contrato?")) {
                  setContracts(contracts.filter((x) => x.id !== c.id));
                  setOpen(false);
                  toast("Contrato removido");
                }
              }}
            >
              Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)} className="ml-auto">
            Cancelar
          </Button>
          <Button onClick={save}>Salvar Contrato</Button>
        </div>
      </Modal>

      {/* MODAL: ASSINATURA DIGITAL NO APP */}
      <Modal open={!!signOpen} onClose={() => setSignOpen(null)} title="Assinatura Digital no Celular">
        <p className="mb-3 text-xs text-stone-500">
          A cliente pode assinar diretamente na tela com o dedo ou caneta stylus.
        </p>
        <canvas
          ref={canvasRef}
          width={440}
          height={160}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full touch-none rounded-2xl border-2 border-dashed border-lilac-300 bg-white"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={clearSig}
            className="rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-white"
          >
            Limpar
          </button>
          <Input
            value={sigName}
            onChange={(e) => setSigName(e.target.value)}
            placeholder="Digite o nome completo da cliente"
          />
        </div>
        <div className="mt-5 flex gap-3">
          <Button variant="ghost" onClick={() => setSignOpen(null)} className="ml-auto">
            Cancelar
          </Button>
          <Button onClick={confirmSign}>Confirmar Assinatura</Button>
        </div>
      </Modal>
    </div>
  );
}
