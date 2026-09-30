import { useState, useMemo } from "react";
import { Card, SectionTitle, Button, Modal, Field, Input, Textarea, Select, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { brl, fmtDate, uid } from "../lib/format";
import { copy, waLink } from "../lib/helpers";
import { useToast } from "../components/Toast";
import type { Quote, QuoteStatus, EventRentedItem, Contract } from "../lib/types";
import { getItemAvailability, checkKitAvailability } from "../lib/availability";
import { sanitizeContract } from "../lib/firestoreUtils";

const STATUSES: QuoteStatus[] = [
  "Rascunho",
  "Enviado",
  "Aguardando cliente",
  "Aprovado",
  "Reprovado",
  "Expirado",
  "Convertido em contrato",
];

const statusColor: Record<QuoteStatus, string> = {
  Rascunho: "gray",
  Enviado: "blue",
  "Aguardando cliente": "amber",
  Aprovado: "green",
  Reprovado: "rose",
  Expirado: "gray",
  "Convertido em contrato": "lilac",
};

const emptyQuote = (): Quote => ({
  id: uid(),
  clientName: "",
  theme: "",
  description: "",
  items: [],
  value: 0,
  delivery: 0,
  assembly: 0,
  discount: 0,
  date: new Date().toISOString().slice(0, 10),
  time: "14:00",
  pickupDate: new Date().toISOString().slice(0, 10),
  pickupTime: "09:00",
  returnDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  returnTime: "12:00",
  deposit: 0,
  paymentMethod: "Pix",
  validUntil: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  status: "Rascunho",
  notes: "",
  createdAt: new Date().toISOString().slice(0, 10),
});

export default function Quotes() {
  const {
    quotes,
    setQuotes,
    clients,
    eventsList,
    inventoryItems,
    kits,
    contracts,
    setContracts,
    events,
    setEvents,
    companySettings,
    contractRules,
    logAction,
  } = useStore();

  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState<Quote>(emptyQuote());
  const [filter, setFilter] = useState<string>("Todos");
  const [search, setSearch] = useState("");

  // Item selector inside modal
  const [selType, setSelType] = useState<"item" | "kit">("item");
  const [selId, setSelId] = useState("");
  const [selQty, setSelQty] = useState(1);

  const calcSubtotal = (quote: Quote) => {
    if (quote.items && quote.items.length > 0) {
      return quote.items.reduce((acc, it) => acc + (it.subtotal || 0), 0);
    }
    return quote.value || 0;
  };

  const calcTotal = (quote: Quote) => {
    const sub = calcSubtotal(quote);
    return Math.max(0, sub + (quote.delivery || 0) + (quote.assembly || 0) - (quote.discount || 0));
  };

  const calcRemaining = (quote: Quote) => {
    return Math.max(0, calcTotal(quote) - (quote.deposit || 0));
  };

  const filteredQuotes = useMemo(() => {
    return quotes
      .filter((item) => (filter === "Todos" ? true : item.status === filter))
      .filter((item) => {
        const query = search.toLowerCase();
        return (
          item.clientName.toLowerCase().includes(query) ||
          item.theme.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [quotes, filter, search]);

  const quoteMessage = (item: Quote) =>
    `🎀 *ORÇAMENTO — ${companySettings.tradeName || "RAYDECOR"}*\n\n` +
    `👤 *Cliente:* ${item.clientName || "—"}\n` +
    `🎉 *Tema:* ${item.theme || "—"}\n` +
    `🗓️ *Data da Festa:* ${fmtDate(item.date)} às ${item.time || "—"}\n` +
    `📦 *Retirada:* ${fmtDate(item.pickupDate || item.date)}\n` +
    `↩️ *Devolução:* ${fmtDate(item.returnDate || item.date)}\n\n` +
    `📝 *Itens inclusos:*\n` +
    (item.items && item.items.length > 0
      ? item.items.map((it) => `• ${it.name} (${it.quantity}x) — ${brl(it.subtotal)}`).join("\n")
      : `• ${item.description || "Decoração completa Pegue e Monte"}`) +
    `\n\n` +
    `💰 *Subtotal decoração:* ${brl(calcSubtotal(item))}\n` +
    (item.delivery ? `🚚 *Taxa de entrega:* ${brl(item.delivery)}\n` : "") +
    (item.assembly ? `🔧 *Montagem:* ${brl(item.assembly)}\n` : "") +
    (item.discount ? `🏷️ *Desconto especial:* -${brl(item.discount)}\n` : "") +
    `✨ *VALOR TOTAL: ${brl(calcTotal(item))}*\n\n` +
    `💳 *Sinal (reserva):* ${brl(item.deposit)}\n` +
    `📌 *Saldo restante:* ${brl(calcRemaining(item))}\n\n` +
    (companySettings.pixKey ? `🔑 *Chave PIX:* ${companySettings.pixKey} (${companySettings.pixType})\n\n` : "") +
    `Para garantir suas peças para esta data, confirme o comprovante do sinal 💕`;

  // Add Item to Quote with Real-Time Availability Validation
  const addItemToQuote = () => {
    if (!selId) return toast("Selecione uma peça ou kit");
    if (selQty < 1) return toast("Quantidade deve ser maior que 0");

    const pDate = q.pickupDate || q.date;
    const rDate = q.returnDate || q.date;

    if (selType === "item") {
      const found = inventoryItems.find((i) => i.id === selId);
      if (!found) return;

      const avail = getItemAvailability(selId, pDate, rDate, inventoryItems, kits, eventsList);
      if (avail.available < selQty) {
        return toast(
          `⚠️ Atenção! Existem apenas ${avail.available} unidades disponíveis de "${found.name}" para este período.`
        );
      }

      const unitPrice = found.rentalPrice || 0;
      const newItem: EventRentedItem = {
        type: "item",
        id: selId,
        name: found.name,
        quantity: selQty,
        unitPrice,
        subtotal: unitPrice * selQty,
      };

      const newItems = [...(q.items || []), newItem];
      setQ({ ...q, items: newItems, value: newItems.reduce((acc, it) => acc + it.subtotal, 0) });
    } else {
      const foundKit = kits.find((k) => k.id === selId);
      if (!foundKit) return;

      const checkKit = checkKitAvailability(selId, selQty, pDate, rDate, inventoryItems, kits, eventsList);
      if (!checkKit.ok && checkKit.shortages.length > 0) {
        const first = checkKit.shortages[0];
        return toast(
          `⚠️ Indisponível! O kit precisa de ${first.needed}x "${first.itemName}", mas há apenas ${first.available} disponíveis para este período.`
        );
      }

      const unitPrice = foundKit.rentalPrice || 0;
      const newItem: EventRentedItem = {
        type: "kit",
        id: selId,
        name: `Kit: ${foundKit.name}`,
        quantity: selQty,
        unitPrice,
        subtotal: unitPrice * selQty,
      };

      const newItems = [...(q.items || []), newItem];
      setQ({ ...q, items: newItems, value: newItems.reduce((acc, it) => acc + it.subtotal, 0) });
    }

    setSelId("");
    setSelQty(1);
    toast("Item adicionado ao orçamento com estoque verificado! ✅");
  };

  const removeItemFromQuote = (index: number) => {
    const copy = [...(q.items || [])];
    copy.splice(index, 1);
    setQ({ ...q, items: copy, value: copy.reduce((acc, it) => acc + it.subtotal, 0) });
  };

  const save = () => {
    if (!q.clientName.trim()) return toast("Informe o cliente");
    const exists = quotes.some((x) => x.id === q.id);
    const updated = exists ? quotes.map((x) => (x.id === q.id ? q : x)) : [q, ...quotes];
    setQuotes(updated);
    setOpen(false);
    logAction(
      exists ? "Orçamento Atualizado" : "Novo Orçamento Criado",
      `${q.clientName} - ${q.theme} (Total: ${brl(calcTotal(q))})`
    );
    toast(exists ? "Orçamento atualizado!" : "Orçamento criado!");
  };

  // REQUISITO 18: TRANSFORMAR ORÇAMENTO EM CONTRATO
  const transformToContract = (item: Quote) => {
    const client = clients.find(
      (c) =>
        (item.clientId && c.id === item.clientId) ||
        c.name.trim().toLowerCase() === (item.clientName || "").trim().toLowerCase()
    );

    const newContract: Contract = sanitizeContract({
      id: uid(),
      clientId: item.clientId || client?.id || "",
      clientName: item.clientName || "",
      whatsapp: client?.whatsapp || client?.phone || "",
      cpf: client?.cpf || "",
      quoteId: item.id || "",
      eventId: item.eventId || "",
      partyDate: item.date,
      theme: item.theme,
      items: item.items || [],
      value: calcTotal(item),
      deposit: item.deposit || 0,
      delivery: item.delivery || 0,
      assembly: item.assembly || 0,
      discount: item.discount || 0,
      pickupDate: item.pickupDate || item.date,
      pickupTime: item.pickupTime || "09:00",
      returnDate: item.returnDate || item.date,
      returnTime: item.returnTime || "12:00",
      signed: false,
      signature: "",
      status: "Pendente",
      customTerms: companySettings.terms || contractRules || "",
      createdAt: new Date().toISOString().slice(0, 10),
    });

    // Update quote status to "Convertido em contrato"
    const updatedQuotes = quotes.map((x) =>
      x.id === item.id ? { ...x, status: "Convertido em contrato" as const } : x
    );
    setQuotes(updatedQuotes);

    // Add new contract
    setContracts([newContract, ...contracts]);

    // REQUISITO: Automaticamente ir para a agenda na data preenchida
    if (newContract.partyDate) {
      const alreadyScheduled = (events || []).some(
        (ev) =>
          ev.date === newContract.partyDate &&
          ev.clientName.trim().toLowerCase() === newContract.clientName.trim().toLowerCase()
      );
      if (!alreadyScheduled) {
        const calEv = {
          id: uid(),
          theme: newContract.theme || "Decoração Pegue e Monte",
          clientName: newContract.clientName,
          date: newContract.partyDate,
          setupTime: newContract.pickupTime || "09:00",
          pickupTime: newContract.pickupTime || "09:00",
          returnTime: newContract.returnTime || "12:00",
        };
        setEvents([calEv, ...(events || [])]);
      }
    }

    logAction(
      "Orçamento Convertido em Contrato",
      `Orçamento de ${item.clientName} transformado no contrato #${newContract.id}`
    );
    toast("✨ Contrato gerado e agendado no calendário com sucesso!");
  };

  const doCopy = async (item: Quote) => {
    await copy(quoteMessage(item));
    toast("Mensagem copiada para o WhatsApp!");
  };

  // REQUISITO 23: GERAR PDF PROFISSIONAL DE ORÇAMENTO
  const generatePdf = (item: Quote) => {
    const w = window.open("", "_blank");
    if (!w) return;

    const logo = companySettings.logo || "";
    const compName = companySettings.name || "RAYDECOR Pegue e Monte";
    const subtotalVal = calcSubtotal(item);
    const totalVal = calcTotal(item);
    const depositVal = item.deposit || 0;
    const remainingVal = calcRemaining(item);

    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Orçamento — ${item.clientName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Poppins', Arial, sans-serif; padding: 30px; color: #333; background: #fff; font-size: 13px; line-height: 1.5; }
          .container { max-width: 700px; margin: 0 auto; border: 1px solid #f0e6fa; border-radius: 20px; padding: 35px; box-shadow: 0 10px 30px rgba(217, 70, 239, 0.08); }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #fae8ff; padding-bottom: 20px; margin-bottom: 25px; }
          .logo { height: 60px; width: 60px; object-fit: cover; border-radius: 14px; border: 1px solid #fce7f3; }
          .brand h1 { font-size: 20px; color: #ec4899; font-weight: 700; }
          .brand p { font-size: 11px; color: #888; }
          .badge { background: #fdf2f8; color: #db2777; padding: 6px 12px; border-radius: 999px; font-weight: 600; font-size: 11px; text-transform: uppercase; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 12px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #faf8fd; padding: 15px; border-radius: 14px; }
          .info-item b { color: #555; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { text-align: left; background: #fdf2f8; color: #db2777; padding: 8px 10px; font-size: 11px; font-weight: 600; border-radius: 6px; }
          td { padding: 10px; border-bottom: 1px solid #f5f5f5; font-size: 12px; }
          .total-box { margin-top: 25px; border-top: 2px solid #fae8ff; padding-top: 15px; }
          .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
          .grand-total { font-size: 18px; font-weight: 700; color: #db2777; margin-top: 6px; border-top: 1px dashed #ddd; padding-top: 8px; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 15px; }
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
                <p>Decoração Pegue e Monte • Festas e Eventos</p>
                ${companySettings.phone ? `<p>Contato: ${companySettings.phone}</p>` : ""}
              </div>
            </div>
            <div class="badge">Orçamento #${item.id.slice(0, 6).toUpperCase()}</div>
          </div>

          <div class="section">
            <div class="section-title">Dados do Cliente e Festa</div>
            <div class="info-grid">
              <div class="info-item"><b>Cliente:</b> ${item.clientName}</div>
              <div class="info-item"><b>Tema:</b> ${item.theme}</div>
              <div class="info-item"><b>Data da Festa:</b> ${fmtDate(item.date)} às ${item.time || "14:00"}</div>
              <div class="info-item"><b>Retirada:</b> ${fmtDate(item.pickupDate || item.date)}</div>
              <div class="info-item"><b>Devolução:</b> ${fmtDate(item.returnDate || item.date)}</div>
              <div class="info-item"><b>Validade:</b> Até ${fmtDate(item.validUntil || item.date)}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Itens e Composição da Decoração</div>
            ${
              item.items && item.items.length > 0
                ? `
              <table>
                <thead>
                  <tr>
                    <th>Item / Kit</th>
                    <th style="text-align:center;">Qtd</th>
                    <th style="text-align:right;">Valor Un.</th>
                    <th style="text-align:right;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${item.items
                    .map(
                      (it) => `
                    <tr>
                      <td><b>${it.name}</b></td>
                      <td style="text-align:center;">${it.quantity}x</td>
                      <td style="text-align:right;">${brl(it.unitPrice)}</td>
                      <td style="text-align:right;"><b>${brl(it.subtotal)}</b></td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            `
                : `<p style="padding:10px; background:#faf8fd; border-radius:10px;">${
                    item.description || "Decoração Completa Pegue e Monte"
                  }</p>`
            }
          </div>

          <div class="total-box">
            <div class="total-row"><span>Subtotal da Decoração</span><span>${brl(subtotalVal)}</span></div>
            ${item.delivery ? `<div class="total-row"><span>Taxa de Entrega / Frete</span><span>${brl(item.delivery)}</span></div>` : ""}
            ${item.assembly ? `<div class="total-row"><span>Taxa de Montagem</span><span>${brl(item.assembly)}</span></div>` : ""}
            ${item.discount ? `<div class="total-row" style="color:#e11d48;"><span>Desconto Concedido</span><span>-${brl(item.discount)}</span></div>` : ""}
            <div class="total-row grand-total"><span>Valor Total</span><span>${brl(totalVal)}</span></div>
            <div class="total-row" style="margin-top:10px; color:#16a34a; font-weight:600;"><span>Sinal para Reserva da Data</span><span>${brl(depositVal)}</span></div>
            <div class="total-row" style="color:#d97706; font-weight:600;"><span>Saldo Restante na Retirada</span><span>${brl(remainingVal)}</span></div>
          </div>

          ${
            companySettings.pixKey
              ? `
            <div style="margin-top:20px; background:#f0fdf4; border:1px solid #bbf7d0; padding:12px 16px; border-radius:12px; font-size:12px;">
              <b>Dados para Pagamento via PIX:</b><br>
              Chave: <b>${companySettings.pixKey}</b> (${companySettings.pixType}) • Favorecido: <b>${companySettings.ownerName || compName}</b>
            </div>
          `
              : ""
          }

          <div class="footer">
            <p>Obrigada por escolher a ${compName}! Feito com amor 💕</p>
          </div>
        </div>
        <script>window.print()</script>
      </body>
      </html>
    `);
    w.document.close();
    toast("Gerando PDF do orçamento...");
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Orçamentos Inteligentes"
        subtitle="Crie orçamentos com estoque em tempo real e transforme em contratos com 1 clique"
        action={
          <Button
            onClick={() => {
              setQ(emptyQuote());
              setOpen(true);
            }}
          >
            <Icon.plus className="h-4 w-4" /> Novo Orçamento
          </Button>
        }
      />

      {/* Filter and Search */}
      <Card className="!p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="🔍 Buscar por cliente ou tema..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs !bg-white"
          />
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {["Todos", ...STATUSES].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === s
                    ? "bg-gradient-to-r from-nude-400 to-lilac-400 text-white shadow"
                    : "bg-white/70 text-stone-500 hover:bg-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Quotes Cards Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {filteredQuotes.map((item) => {
          const client = clients.find(
            (c) => c.name.toLowerCase() === item.clientName.toLowerCase()
          );
          const totalVal = calcTotal(item);
          const remVal = calcRemaining(item);

          return (
            <Card key={item.id} className="animate-rise flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-bold text-stone-800 text-base">{item.clientName}</h3>
                    <p className="text-xs text-stone-500">
                      {item.theme} • {fmtDate(item.date)} às {item.time || "14:00"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-2xl bg-gradient-to-br from-gold-soft to-gold px-3 py-1 text-sm font-bold text-white shadow-sm">
                      {brl(totalVal)}
                    </span>
                    <Badge color={statusColor[item.status || "Rascunho"]}>
                      {item.status || "Rascunho"}
                    </Badge>
                  </div>
                </div>

                {/* Items preview */}
                <div className="mt-3 rounded-2xl bg-white/60 p-3 text-xs space-y-1">
                  {item.items && item.items.length > 0 ? (
                    item.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-stone-600">
                        <span className="truncate">
                          • {it.name} ({it.quantity}x)
                        </span>
                        <span className="font-semibold text-stone-800 ml-2">{brl(it.subtotal)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="line-clamp-2 text-stone-600">
                      {item.description || "Decoração Pegue e Monte"}
                    </p>
                  )}
                </div>

                {/* Numbers breakdown */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-white/60 py-2">
                    <p className="text-stone-400 text-[10px]">Subtotal</p>
                    <p className="font-bold text-stone-700">{brl(calcSubtotal(item))}</p>
                  </div>
                  <div className="rounded-xl bg-white/60 py-2">
                    <p className="text-stone-400 text-[10px]">Sinal</p>
                    <p className="font-bold text-emerald-600">{brl(item.deposit || 0)}</p>
                  </div>
                  <div className="rounded-xl bg-white/60 py-2">
                    <p className="text-stone-400 text-[10px]">Restante</p>
                    <p className="font-bold text-amber-600">{brl(remVal)}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-2">
                {/* Botão de Transformar em Contrato (Requisito 18) */}
                {item.status !== "Convertido em contrato" && (
                  <Button
                    variant="primary"
                    className="!py-1.5 !px-3 text-xs w-full sm:w-auto"
                    onClick={() => transformToContract(item)}
                  >
                    📑 Transformar em Contrato
                  </Button>
                )}

                <Button
                  variant="gold"
                  className="!px-3 !py-1.5 text-xs"
                  onClick={() => generatePdf(item)}
                >
                  <Icon.pdf className="h-4 w-4" /> PDF
                </Button>

                {client?.whatsapp && (
                  <a
                    href={waLink(client.whatsapp, quoteMessage(item))}
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
                  onClick={() => doCopy(item)}
                >
                  <Icon.copy className="h-4 w-4" /> Copiar
                </Button>

                <button
                  onClick={() => {
                    setQ(item);
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

        {filteredQuotes.length === 0 && (
          <Card className="col-span-full text-center text-stone-400 py-12">
            Nenhum orçamento encontrado 🧾
          </Card>
        )}
      </div>

      {/* MODAL: CRIAR / EDITAR ORÇAMENTO */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={quotes.some((x) => x.id === q.id) ? "Editar Orçamento" : "Novo Orçamento"}
        wide
      >
        <div className="space-y-4 mt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente">
              <Input
                list="clientlist"
                value={q.clientName}
                onChange={(e) => {
                  const name = e.target.value;
                  const found = clients.find((c) => c.name.toLowerCase() === name.toLowerCase());
                  setQ({
                    ...q,
                    clientName: name,
                    clientId: found ? found.id : q.clientId,
                  });
                }}
                placeholder="Selecione ou digite o cliente"
              />
              <datalist id="clientlist">
                {clients.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </Field>

            <Field label="Tema da Festa">
              <Input
                value={q.theme}
                onChange={(e) => setQ({ ...q, theme: e.target.value })}
                placeholder="Ex: Stitch, Safari, Arco-íris..."
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data do Evento">
              <Input
                type="date"
                value={q.date}
                onChange={(e) => setQ({ ...q, date: e.target.value })}
              />
            </Field>
            <Field label="Horário">
              <Input
                type="time"
                value={q.time || ""}
                onChange={(e) => setQ({ ...q, time: e.target.value })}
              />
            </Field>
          </div>

          {/* Period for Availability Check */}
          <div className="rounded-2xl bg-lilac-50/60 p-3 border border-lilac-200/80 space-y-2">
            <p className="text-[11px] font-bold text-lilac-700 uppercase tracking-wider">
              Período de Bloqueio das Peças (Retirada até Devolução):
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data Retirada">
                <Input
                  type="date"
                  value={q.pickupDate || q.date}
                  onChange={(e) => setQ({ ...q, pickupDate: e.target.value })}
                  className="!bg-white text-xs"
                />
              </Field>
              <Field label="Data Devolução">
                <Input
                  type="date"
                  value={q.returnDate || q.date}
                  onChange={(e) => setQ({ ...q, returnDate: e.target.value })}
                  className="!bg-white text-xs"
                />
              </Field>
            </div>
          </div>

          {/* Add Pieces / Kits from Acervo with Real Availability */}
          <div className="rounded-2xl bg-white/70 p-4 border border-white/80 space-y-3">
            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Incluir Itens ou Kits do Acervo no Orçamento:
            </h4>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="w-28">
                <Select
                  value={selType}
                  onChange={(e) => setSelType(e.target.value as "item" | "kit")}
                  className="!bg-white text-xs"
                >
                  <option value="item">Peça</option>
                  <option value="kit">Kit</option>
                </Select>
              </div>

              <div className="flex-1">
                <Select
                  value={selId}
                  onChange={(e) => setSelId(e.target.value)}
                  className="!bg-white text-xs"
                >
                  <option value="">Selecione...</option>
                  {selType === "item"
                    ? inventoryItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.code ? `[${it.code}] ` : ""}
                          {it.name} — {brl(it.rentalPrice || 0)} (Estoque: {it.quantity})
                        </option>
                      ))
                    : kits.map((k) => (
                        <option key={k.id} value={k.id}>
                          🎁 {k.name} — {brl(k.rentalPrice || 0)}
                        </option>
                      ))}
                </Select>
              </div>

              <div className="w-20">
                <Input
                  type="number"
                  min="1"
                  value={selQty}
                  onChange={(e) => setSelQty(Math.max(1, +e.target.value))}
                  placeholder="Qtd"
                  className="!bg-white text-xs"
                />
              </div>

              <Button onClick={addItemToQuote} className="!py-2 text-xs">
                + Incluir
              </Button>
            </div>

            {/* List of items already in quote */}
            <div className="divide-y divide-stone-100 rounded-xl bg-white overflow-hidden border border-stone-100">
              {(q.items || []).map((it, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                  <div>
                    <span className="font-semibold text-stone-800">{it.name}</span>
                    <span className="text-stone-400 ml-2">({brl(it.unitPrice)} un.)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lilac-500">{it.quantity}x</span>
                    <span className="font-bold text-stone-800">{brl(it.subtotal)}</span>
                    <button
                      onClick={() => removeItemFromQuote(idx)}
                      className="text-rose-400 hover:text-rose-600 ml-2"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {(q.items || []).length === 0 && (
                <p className="p-3 text-center text-xs text-stone-400">
                  Nenhum item do acervo adicionado. Adicione acima ou use a descrição manual.
                </p>
              )}
            </div>
          </div>

          <Field label="Descrição manual ou detalhes adicionais">
            <Textarea
              value={q.description || ""}
              onChange={(e) => setQ({ ...q, description: e.target.value })}
              placeholder="Painel romano, mesa cilindro, arco de balões..."
            />
          </Field>

          {/* Pricing & Fees breakdown */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Subtotal Itens (R$)">
              <Input
                type="number"
                step="0.01"
                value={q.value || ""}
                onChange={(e) => setQ({ ...q, value: +e.target.value })}
              />
            </Field>
            <Field label="Taxa de Entrega / Frete (R$)">
              <Input
                type="number"
                step="0.01"
                value={q.delivery || ""}
                onChange={(e) => setQ({ ...q, delivery: +e.target.value })}
              />
            </Field>
            <Field label="Taxa de Montagem (R$)">
              <Input
                type="number"
                step="0.01"
                value={q.assembly || ""}
                onChange={(e) => setQ({ ...q, assembly: +e.target.value })}
              />
            </Field>
            <Field label="Desconto (R$)">
              <Input
                type="number"
                step="0.01"
                value={q.discount || ""}
                onChange={(e) => setQ({ ...q, discount: +e.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Sinal de Reserva (R$)">
              <Input
                type="number"
                step="0.01"
                value={q.deposit || ""}
                onChange={(e) => setQ({ ...q, deposit: +e.target.value })}
                className="font-bold text-emerald-600"
              />
            </Field>

            <Field label="Status do Orçamento">
              <Select
                value={q.status || "Rascunho"}
                onChange={(e) => setQ({ ...q, status: e.target.value as QuoteStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex flex-col justify-center rounded-2xl bg-lilac-100/50 p-3 text-center">
              <span className="text-[10px] font-semibold text-stone-500 uppercase">
                Saldo Restante a Cobrar
              </span>
              <span className="text-lg font-bold text-stone-800">{brl(calcRemaining(q))}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {quotes.some((x) => x.id === q.id) && (
            <Button
              variant="soft"
              className="!text-rose-500"
              onClick={() => {
                if (confirm("Remover este orçamento?")) {
                  setQuotes(quotes.filter((x) => x.id !== q.id));
                  setOpen(false);
                  toast("Orçamento removido");
                }
              }}
            >
              Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)} className="ml-auto">
            Cancelar
          </Button>
          <Button onClick={save}>Salvar Orçamento</Button>
        </div>
      </Modal>
    </div>
  );
}
