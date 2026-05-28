import { useState } from "react";
import { Card, SectionTitle, Button, Modal, Field, Input, Textarea, Select } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { brl, fmtDate, uid } from "../lib/format";
import { copy, waLink } from "../lib/helpers";
import { useToast } from "../components/Toast";
import type { Quote } from "../lib/types";

const empty = (): Quote => ({
  id: uid(),
  clientName: "",
  theme: "",
  description: "",
  value: 0,
  date: "",
  time: "",
  delivery: 0,
  deposit: 0,
  createdAt: new Date().toISOString().slice(0, 10),
});

const total = (q: Quote) => q.value + q.delivery;
const remaining = (q: Quote) => total(q) - q.deposit;

const quoteMessage = (q: Quote) =>
  `🎀 *ORÇAMENTO — Festa & Cia*\n\n` +
  `👤 Cliente: ${q.clientName || "—"}\n` +
  `🎉 Tema: ${q.theme || "—"}\n` +
  `🗓️ Data: ${fmtDate(q.date)} às ${q.time || "—"}\n\n` +
  `📝 ${q.description || "Decoração completa Pegue e Monte"}\n\n` +
  `💰 Valor da decoração: ${brl(q.value)}\n` +
  `🚚 Taxa de entrega: ${brl(q.delivery)}\n` +
  `✨ *Total: ${brl(total(q))}*\n\n` +
  `💳 Sinal (reserva): ${brl(q.deposit)}\n` +
  `📌 Restante: ${brl(remaining(q))}\n\n` +
  `Para garantir sua data, basta confirmar o sinal 💕`;

export default function Quotes() {
  const { quotes, setQuotes, themes, clients } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState<Quote>(empty());

  const save = () => {
    if (!q.clientName.trim()) return toast("Informe o cliente");
    const exists = quotes.some((x) => x.id === q.id);
    setQuotes(exists ? quotes.map((x) => (x.id === q.id ? q : x)) : [q, ...quotes]);
    setOpen(false);
    toast(exists ? "Orçamento atualizado!" : "Orçamento criado!");
  };

  const doCopy = async (item: Quote) => {
    await copy(quoteMessage(item));
    toast("Mensagem copiada!");
  };

  const generatePdf = (item: Quote) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Orçamento ${item.clientName}</title>
      <style>body{font-family:Poppins,Arial,sans-serif;padding:40px;color:#444;background:#fdfbfa}
      h1{color:#a98fe0}.box{border:1px solid #eee;border-radius:18px;padding:24px;max-width:600px;margin:auto;box-shadow:0 8px 30px -12px rgba(169,143,224,.4)}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #eee}
      .tot{font-size:20px;font-weight:700;color:#c9a45c}</style></head><body>
      <div class="box"><h1>🎀 Festa &amp; Cia</h1><p>Decoração Pegue e Monte</p><hr/>
      <p><b>Cliente:</b> ${item.clientName}</p>
      <p><b>Tema:</b> ${item.theme} &nbsp; <b>Data:</b> ${fmtDate(item.date)} ${item.time}</p>
      <p>${item.description}</p>
      <div class="row"><span>Decoração</span><span>${brl(item.value)}</span></div>
      <div class="row"><span>Taxa de entrega</span><span>${brl(item.delivery)}</span></div>
      <div class="row"><span class="tot">Total</span><span class="tot">${brl(total(item))}</span></div>
      <div class="row"><span>Sinal</span><span>${brl(item.deposit)}</span></div>
      <div class="row"><span>Restante</span><span>${brl(remaining(item))}</span></div>
      <p style="margin-top:20px;color:#a98fe0">Obrigada pela preferência! 💕</p></div>
      <script>window.print()</script></body></html>`);
    w.document.close();
    toast("Gerando PDF...");
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Orçamento rápido"
        subtitle="Crie e envie orçamentos lindos em segundos"
        action={<Button onClick={() => { setQ(empty()); setOpen(true); }}><Icon.plus className="h-4 w-4" /> Novo orçamento</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {quotes.map((item) => {
          const client = clients.find((c) => c.name === item.clientName);
          return (
            <Card key={item.id} className="animate-rise">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-stone-800">{item.clientName}</p>
                  <p className="text-xs text-stone-500">{item.theme} • {fmtDate(item.date)} {item.time}</p>
                </div>
                <span className="rounded-2xl bg-gradient-to-br from-gold-soft to-gold px-3 py-1.5 text-sm font-semibold text-white">{brl(total(item))}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-stone-600">{item.description}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-white/60 py-2"><p className="text-stone-400">Decoração</p><p className="font-semibold text-stone-700">{brl(item.value)}</p></div>
                <div className="rounded-xl bg-white/60 py-2"><p className="text-stone-400">Sinal</p><p className="font-semibold text-emerald-600">{brl(item.deposit)}</p></div>
                <div className="rounded-xl bg-white/60 py-2"><p className="text-stone-400">Restante</p><p className="font-semibold text-amber-600">{brl(remaining(item))}</p></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="gold" className="!px-3 !py-2 text-xs" onClick={() => generatePdf(item)}><Icon.pdf className="h-4 w-4" /> PDF</Button>
                {client?.whatsapp && (
                  <a href={waLink(client.whatsapp, quoteMessage(item))} target="_blank" rel="noreferrer">
                    <Button variant="wa" className="!px-3 !py-2 text-xs"><Icon.wa className="h-4 w-4" /> WhatsApp</Button>
                  </a>
                )}
                <Button variant="soft" className="!px-3 !py-2 text-xs" onClick={() => doCopy(item)}><Icon.copy className="h-4 w-4" /> Copiar</Button>
                <button onClick={() => { setQ(item); setOpen(true); }} className="ml-auto rounded-xl bg-white/70 px-3 py-2 text-xs font-medium text-stone-500 hover:bg-white">Editar</button>
              </div>
            </Card>
          );
        })}
        {quotes.length === 0 && <Card className="col-span-full text-center text-stone-400">Nenhum orçamento ainda 🧾</Card>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Orçamento" wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cliente">
            <Input list="clientlist" value={q.clientName} onChange={(e) => setQ({ ...q, clientName: e.target.value })} placeholder="Nome do cliente" />
            <datalist id="clientlist">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          </Field>
          <Field label="Tema">
            <Select value={q.theme} onChange={(e) => setQ({ ...q, theme: e.target.value })}>
              <option value="">Selecione...</option>
              {themes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </Select>
          </Field>
          <div className="sm:col-span-2"><Field label="Descrição"><Textarea value={q.description} onChange={(e) => setQ({ ...q, description: e.target.value })} placeholder="Painel, mesa decorada, arco de balões..." /></Field></div>
          <Field label="Data"><Input type="date" value={q.date} onChange={(e) => setQ({ ...q, date: e.target.value })} /></Field>
          <Field label="Horário"><Input type="time" value={q.time} onChange={(e) => setQ({ ...q, time: e.target.value })} /></Field>
          <Field label="Valor da decoração (R$)"><Input type="number" value={q.value || ""} onChange={(e) => setQ({ ...q, value: +e.target.value })} /></Field>
          <Field label="Taxa de entrega (R$)"><Input type="number" value={q.delivery || ""} onChange={(e) => setQ({ ...q, delivery: +e.target.value })} /></Field>
          <Field label="Sinal (R$)"><Input type="number" value={q.deposit || ""} onChange={(e) => setQ({ ...q, deposit: +e.target.value })} /></Field>
          <div className="grid place-content-center rounded-2xl bg-lilac-100/50 p-3 text-center">
            <p className="text-xs text-stone-500">Valor restante</p>
            <p className="text-lg font-semibold text-stone-800">{brl(remaining(q))}</p>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="ghost" onClick={() => setOpen(false)} className="ml-auto">Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </div>
      </Modal>
    </div>
  );
}
