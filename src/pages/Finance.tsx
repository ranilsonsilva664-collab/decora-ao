import { useMemo, useState } from "react";
import { Card, SectionTitle, Button, Modal, Field, Input, Select, Textarea, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { brl, fmtDate, uid, sameMonth, monthName } from "../lib/format";
import { waLink } from "../lib/helpers";
import { useToast } from "../components/Toast";
import type { Transaction, TxType } from "../lib/types";

const OUT_CATS = [
  "Saída com Balões",
  "Locação de Acervo com Outro Decorador",
  "Compra de peças",
  "Impressão de painéis",
  "Combustível / Transporte",
  "Equipe / Montagem",
  "Manutenção / Limpeza",
  "Embalagens / Acessórios",
  "Marketing / Tráfego",
  "Outros",
];

const IN_CATS = [
  "Locação Pegue e Monte",
  "Sinal de Reserva",
  "Taxa de Entrega",
  "Taxa de Montagem",
  "Reposição de Avaria",
  "Outros",
];

const emptyTx = (
  type: TxType,
  subtype: "baloes" | "sublocacao" | "outros" = "outros"
): Transaction => ({
  id: uid(),
  type,
  description:
    type === "saida" && subtype === "baloes"
      ? "Saída com Balões"
      : type === "saida" && subtype === "sublocacao"
      ? "Locação de Acervo com Decorador Parceiro"
      : "",
  category:
    type === "entrada"
      ? "Locação Pegue e Monte"
      : subtype === "baloes"
      ? "Saída com Balões"
      : subtype === "sublocacao"
      ? "Locação de Acervo com Outro Decorador"
      : "Compra de peças",
  client: "",
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
  method: "Pix",
  status: "Pago",
  expenseSubtype: type === "saida" ? subtype : undefined,
  partnerDecoratorName: "",
  partnerDecoratorPhone: "",
  partnerRentedItems: "",
  partnerPickupDate: new Date().toISOString().slice(0, 10),
  partnerReturnDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  balloonColors: "",
  balloonSupplier: "",
  notes: "",
});

export default function Finance() {
  const {
    transactions,
    setTransactions,
    clients,
    contracts,
    setContracts,
    companySettings,
    logAction,
  } = useStore();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [tx, setTx] = useState<Transaction>(emptyTx("entrada"));
  const [tab, setTab] = useState<"todas" | "entrada" | "saida">("todas");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [search, setSearch] = useState("");

  // Quick Balloon Expense state
  const [quickBalloonValue, setQuickBalloonValue] = useState<string>("");
  const [quickBalloonDesc, setQuickBalloonDesc] = useState<string>("");
  const [quickBalloonClient, setQuickBalloonClient] = useState<string>("");

  // Modal para Fechar Decoração direto no Financeiro (Sinal Pago + Valor em Aberto)
  const [openCloseDecoModal, setOpenCloseDecoModal] = useState(false);
  const [decoClient, setDecoClient] = useState("");
  const [decoTheme, setDecoTheme] = useState("");
  const [decoPartyDate, setDecoPartyDate] = useState(new Date().toISOString().slice(0, 10));
  const [decoTotalValue, setDecoTotalValue] = useState<number | "">("");
  const [decoDepositValue, setDecoDepositValue] = useState<number | "">("");
  const [decoMethod, setDecoMethod] = useState("Pix");

  const safeTransactions = transactions || [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthLabel = monthName(new Date().getMonth());

  const entradas = safeTransactions.filter((t) => t.type === "entrada");
  const saidas = safeTransactions.filter((t) => t.type === "saida");

  const recebidoMes = entradas
    .filter((t) => t.status === "Pago" && sameMonth(t.date))
    .reduce((s, t) => s + t.amount, 0);

  const recebido = entradas.filter((t) => t.status === "Pago").reduce((s, t) => s + t.amount, 0);
  const pendente = entradas.filter((t) => t.status === "Pendente").reduce((s, t) => s + t.amount, 0);
  const atrasado = entradas.filter((t) => t.status === "Atrasado").reduce((s, t) => s + t.amount, 0);
  const gastos = saidas.reduce((s, t) => s + t.amount, 0);
  const gastosBaloes = saidas
    .filter((t) => t.expenseSubtype === "baloes" || t.category.toLowerCase().includes("bal"))
    .reduce((s, t) => s + t.amount, 0);
  const gastosParcerias = saidas
    .filter(
      (t) =>
        t.expenseSubtype === "sublocacao" ||
        t.category.toLowerCase().includes("outro decorador") ||
        t.category.toLowerCase().includes("parceir")
    )
    .reduce((s, t) => s + t.amount, 0);

  const lucroLiquido = recebido - gastos;

  const list = useMemo(() => {
    return safeTransactions
      .filter((t) => (tab === "todas" ? true : t.type === tab))
      .filter((t) => (statusFilter === "Todos" ? true : t.status === statusFilter))
      .filter((t) => {
        const q = search.toLowerCase();
        return (
          t.description.toLowerCase().includes(q) ||
          (t.client && t.client.toLowerCase().includes(q)) ||
          (t.partnerDecoratorName && t.partnerDecoratorName.toLowerCase().includes(q)) ||
          t.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [safeTransactions, tab, statusFilter, search]);

  const save = () => {
    let finalDescription = tx.description.trim();

    if (tx.type === "saida" && tx.expenseSubtype === "baloes" && !finalDescription) {
      finalDescription = `Saída com Balões${tx.balloonColors ? ` (${tx.balloonColors})` : ""}`;
    } else if (tx.type === "saida" && tx.expenseSubtype === "sublocacao") {
      if (!tx.partnerDecoratorName?.trim()) {
        return toast("Informe o nome do decorador(a) parceiro(a)");
      }
      if (!finalDescription || finalDescription === "Locação de Acervo com Decorador Parceiro") {
        finalDescription = `Locação de Acervo — Parceiro(a): ${tx.partnerDecoratorName.trim()}${
          tx.partnerRentedItems ? ` (${tx.partnerRentedItems})` : ""
        }`;
      }
    }

    if (!finalDescription) return toast("Informe a descrição do lançamento");
    if (!tx.amount || tx.amount <= 0) return toast("Informe um valor válido maior que zero");

    const finalTx: Transaction = {
      ...tx,
      description: finalDescription,
    };

    const exists = safeTransactions.some((x) => x.id === finalTx.id);
    const updated = exists
      ? safeTransactions.map((x) => (x.id === finalTx.id ? finalTx : x))
      : [finalTx, ...safeTransactions];
    setTransactions(updated);
    setOpen(false);
    logAction(
      exists ? "Transação Atualizada" : "Nova Movimentação Financeira",
      `${finalTx.type === "entrada" ? "Entrada" : "Saída"}: ${finalTx.description} (${brl(finalTx.amount)})`
    );
    toast(exists ? "Lançamento atualizado!" : "Lançamento registrado com sucesso!");
  };

  // Lançamento rápido de Saída com Balões
  const handleQuickBalloonSubmit = () => {
    const val = Number(quickBalloonValue);
    if (!val || val <= 0) return toast("Digite o valor da saída com balões (R$)");

    const newBalloonTx: Transaction = {
      id: uid(),
      type: "saida",
      description: quickBalloonDesc.trim()
        ? `Saída com Balões — ${quickBalloonDesc.trim()}`
        : `Saída com Balões${quickBalloonClient ? ` (Festa ${quickBalloonClient})` : ""}`,
      category: "Saída com Balões",
      expenseSubtype: "baloes",
      balloonColors: quickBalloonDesc.trim(),
      client: quickBalloonClient.trim(),
      amount: val,
      date: todayStr,
      method: "Pix",
      status: "Pago",
    };

    setTransactions([newBalloonTx, ...safeTransactions]);
    setQuickBalloonValue("");
    setQuickBalloonDesc("");
    setQuickBalloonClient("");
    logAction("Saída com Balões Registrada", `${newBalloonTx.description} — ${brl(val)}`);
    toast(`🎈 Saída com balões de ${brl(val)} registrada no financeiro!`);
  };

  // Fechar Decoração Direto (Gera Sinal = Pago e Restante = Falta Pagar)
  const handleCloseDecorationSubmit = () => {
    if (!decoClient.trim()) return toast("Informe o nome da cliente");
    const total = Number(decoTotalValue) || 0;
    const deposit = Number(decoDepositValue) || 0;
    if (total <= 0) return toast("Informe o valor total da decoração");

    const remaining = Math.max(0, total - deposit);
    const matchedClient = clients.find(
      (c) => c.name.trim().toLowerCase() === decoClient.trim().toLowerCase()
    );
    const newEntries: Transaction[] = [];

    if (deposit > 0) {
      newEntries.push({
        id: uid(),
        type: "entrada",
        description: `Sinal Pago — ${decoTheme || "Decoração"} (${decoClient.trim()})`,
        category: "Sinal de Reserva",
        clientId: matchedClient?.id || "",
        client: decoClient.trim(),
        paymentPart: "sinal",
        partyDate: decoPartyDate,
        amount: deposit,
        date: todayStr,
        method: decoMethod,
        status: "Pago",
      });
    }

    if (remaining > 0) {
      newEntries.push({
        id: uid(),
        type: "entrada",
        description: `Falta Pagar (Em Aberto) — ${decoTheme || "Decoração"} (${decoClient.trim()})`,
        category: "Locação Pegue e Monte",
        clientId: matchedClient?.id || "",
        client: decoClient.trim(),
        paymentPart: "restante",
        partyDate: decoPartyDate,
        amount: remaining,
        date: decoPartyDate || todayStr,
        method: decoMethod,
        status: "Pendente",
      });
    }

    setTransactions([...newEntries, ...safeTransactions]);
    setOpenCloseDecoModal(false);
    setDecoClient("");
    setDecoTheme("");
    setDecoTotalValue("");
    setDecoDepositValue("");

    logAction(
      "Decoração Fechada no Financeiro",
      `${decoClient.trim()} (${decoTheme}) — Sinal Pago: ${brl(deposit)} | Falta Pagar: ${brl(remaining)}`
    );
    toast(
      `✅ Lançado! Sinal (${brl(deposit)}) como PAGO e Restante (${brl(remaining)}) como FALTA PAGAR!`
    );
  };

  // Confirmar recebimento de valor em aberto (Falta Pagar -> Pago e gera valor que entrou no mês)
  const confirmOpenPayment = (item: Transaction) => {
    const updated = safeTransactions.map((t) =>
      t.id === item.id
        ? {
            ...t,
            status: "Pago" as const,
            date: todayStr, // Data de hoje para contabilizar automaticamente nas entradas do mês!
            description: t.description.replace("Falta Pagar (Em Aberto)", "Restante Recebido"),
          }
        : t
    );
    setTransactions(updated);

    if (item.contractId) {
      setContracts(
        (contracts || []).map((c) =>
          c.id === item.contractId ? { ...c, paymentRemainderConfirmed: true } : c
        )
      );
    }

    const newMonthTotal = recebidoMes + item.amount;
    logAction(
      "Valor em Aberto Confirmado",
      `Recebido ${brl(item.amount)} de ${item.client || item.description}. Total entrado no mês: ${brl(newMonthTotal)}`
    );
    toast(
      `✅ Valor de ${brl(item.amount)} confirmado como PAGO! Adicionado automaticamente às entradas de ${currentMonthLabel} (Total no mês: ${brl(newMonthTotal)})!`
    );
  };

  const toggleStatus = (id: string) => {
    const item = safeTransactions.find((t) => t.id === id);
    if (!item) return;

    let nextStatus: "Pago" | "Pendente" | "Atrasado" = "Pago";
    if (item.status === "Pago") nextStatus = "Pendente";
    else if (item.status === "Pendente") nextStatus = "Pago";
    else nextStatus = "Pago";

    setTransactions(
      safeTransactions.map((t) =>
        t.id === id
          ? {
              ...t,
              status: nextStatus,
              date: nextStatus === "Pago" ? todayStr : t.date,
            }
          : t
      )
    );
    toast(
      `Status alterado para: ${nextStatus === "Pendente" ? "Falta Pagar (Em Aberto)" : nextStatus}`
    );
  };

  // REQUISITO 28: GERADOR DE RECIBO EM PDF (E COMPROVANTE DE PARCERIA)
  const generateReceiptPdf = (t: Transaction) => {
    const w = window.open("", "_blank");
    if (!w) return;

    const logo = companySettings.logo || "";
    const compName = companySettings.tradeName || companySettings.name || "Pegue e Monte";
    const clientData = clients.find((c) => c.name.toLowerCase() === (t.client || "").toLowerCase());
    const isPartnerSubrental =
      t.type === "saida" &&
      (t.expenseSubtype === "sublocacao" || t.category === "Locação de Acervo com Outro Decorador");

    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${isPartnerSubrental ? "Comprovante de Locação Parceiro" : "Recibo"} — ${
      t.partnerDecoratorName || t.client || "Cliente"
    }</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Poppins', Arial, sans-serif; padding: 40px; color: #222; background: #fff; font-size: 13px; line-height: 1.6; }
          .container { max-width: 620px; margin: 0 auto; border: 1px solid #fbcfe8; border-radius: 24px; padding: 40px; box-shadow: 0 10px 30px rgba(236, 72, 153, 0.08); background: #ffffff; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px dashed #fce7f3; padding-bottom: 20px; margin-bottom: 25px; }
          .logo { height: 60px; width: 60px; object-fit: cover; border-radius: 16px; border: 1px solid #fce7f3; }
          .brand h1 { font-size: 18px; color: #db2777; font-weight: 700; }
          .brand p { font-size: 11px; color: #777; }
          .receipt-title { font-size: 20px; font-weight: 800; color: #db2777; text-align: center; margin: 15px 0 25px 0; letter-spacing: 0.5px; text-transform: uppercase; }
          .amount-box { background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 18px; padding: 20px; text-align: center; margin-bottom: 25px; }
          .amount-label { font-size: 12px; font-weight: 600; color: #9d174d; text-transform: uppercase; }
          .amount-value { font-size: 32px; font-weight: 800; color: #db2777; margin-top: 4px; }
          .details { background: #fafafa; border-radius: 16px; padding: 20px; font-size: 13px; margin-bottom: 30px; }
          .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f0f0f0; gap: 12px; }
          .row:last-child { border-bottom: none; }
          .signature-area { text-align: center; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 15px; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #aaa; }
          @media print { body { padding: 0; } .container { border: none; box-shadow: none; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="display:flex; align-items:center; gap:12px;">
              ${logo ? `<img src="${logo}" class="logo" alt="Logo">` : ""}
              <div class="brand">
                <h1>${compName}</h1>
                <p>${companySettings.cnpjCpf ? `CNPJ/CPF: ${companySettings.cnpjCpf}` : "Pegue e Monte"}</p>
                ${companySettings.phone ? `<p>Tel/WhatsApp: ${companySettings.phone}</p>` : ""}
              </div>
            </div>
            <div style="text-align:right; font-size:11px; color:#888;">
              <p><b>Doc Nº:</b> #${t.id.slice(0, 6).toUpperCase()}</p>
              <p>Data: ${fmtDate(t.date)}</p>
            </div>
          </div>

          <div class="receipt-title">${
            isPartnerSubrental
              ? "FICHA DE LOCAÇÃO DE ACERVO (PARCERIA ENTRE DECORADORES)"
              : "RECIBO DE PAGAMENTO"
          }</div>

          <div class="amount-box">
            <div class="amount-label">${isPartnerSubrental ? "Valor da Locação Parceira" : "Valor Recebido"}</div>
            <div class="amount-value">${brl(t.amount)}</div>
          </div>

          <div class="details">
            ${
              isPartnerSubrental
                ? `
              <div class="row">
                <span style="color:#666;">Decorador(a) Parceiro(a):</span>
                <span style="font-weight:700; color:#222;">${t.partnerDecoratorName || "—"}</span>
              </div>
              ${
                t.partnerDecoratorPhone
                  ? `<div class="row"><span style="color:#666;">WhatsApp do Parceiro:</span><span>${t.partnerDecoratorPhone}</span></div>`
                  : ""
              }
              <div class="row">
                <span style="color:#666;">Peças Locadas do Acervo:</span>
                <span style="font-weight:600; color:#222; text-align:right;">${t.partnerRentedItems || t.description}</span>
              </div>
              ${
                t.client
                  ? `<div class="row"><span style="color:#666;">Festa / Cliente Destino:</span><span>${t.client}</span></div>`
                  : ""
              }
              <div class="row">
                <span style="color:#666;">Retirada / Devolução:</span>
                <span style="font-weight:600; color:#222;">${fmtDate(t.partnerPickupDate || t.date)} até ${fmtDate(
                    t.partnerReturnDate || t.date
                  )}</span>
              </div>
            `
                : `
              <div class="row">
                <span style="color:#666;">Recebemos de:</span>
                <span style="font-weight:700; color:#222;">${t.client || "Cliente"}</span>
              </div>
              ${clientData?.cpf ? `<div class="row"><span style="color:#666;">CPF:</span><span>${clientData.cpf}</span></div>` : ""}
              <div class="row">
                <span style="color:#666;">Referente a:</span>
                <span style="font-weight:600; color:#222; text-align:right;">${t.description}</span>
              </div>
            `
            }
            <div class="row">
              <span style="color:#666;">Forma de Pagamento:</span>
              <span style="font-weight:600; color:#db2777;">${t.method || "Pix"}</span>
            </div>
            <div class="row">
              <span style="color:#666;">Status:</span>
              <span style="font-weight:700; color:#16a34a;">${
                t.status === "Pago" ? "Confirmado e Quitado" : "Falta Pagar (Em Aberto)"
              }</span>
            </div>
          </div>

          <div class="signature-area">
            <p><b>${compName}</b></p>
            <p style="font-size:11px; color:#777;">Responsável: ${companySettings.ownerName || "A Gerência"}</p>
          </div>

          <div class="footer">
            <p>Documento emitido pelo sistema EventFlow CRM 💕</p>
          </div>
        </div>
        <script>window.print()</script>
      </body>
      </html>
    `);
    w.document.close();
    toast("Gerando documento em PDF...");
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Gestão Financeira Profissional"
        subtitle="Controle de sinais pagos, valores em aberto (falta pagar), saídas com balões e parcerias com outros decoradores"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => setOpenCloseDecoModal(true)}
            >
              🎉 Fechar Decoração (Sinal + Aberto)
            </Button>
            <Button
              variant="wa"
              onClick={() => {
                setTx(emptyTx("entrada"));
                setOpen(true);
              }}
            >
              <Icon.up className="h-4 w-4" /> + Entrada
            </Button>
            <Button
              variant="soft"
              className="!text-rose-600 border border-rose-200"
              onClick={() => {
                setTx(emptyTx("saida", "baloes"));
                setOpen(true);
              }}
            >
              🎈 Saída Balões
            </Button>
            <Button
              variant="soft"
              className="!text-purple-700 border border-purple-200"
              onClick={() => {
                setTx(emptyTx("saida", "sublocacao"));
                setOpen(true);
              }}
            >
              🤝 Locação Outro Decorador
            </Button>
          </div>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="!p-4 border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white">
          <p className="text-xs font-bold text-emerald-800">Entrou em {currentMonthLabel}</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-600">{brl(recebidoMes)}</p>
          <p className="text-[11px] text-emerald-600/80">recebido neste mês</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-semibold text-stone-500">Total Pago (Geral)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{brl(recebido)}</p>
          <p className="text-[11px] text-stone-400">sinais e saldos pagos</p>
        </Card>
        <Card className="!p-4 border-amber-200 bg-gradient-to-br from-amber-50/60 to-white">
          <p className="text-xs font-bold text-amber-800">Falta Pagar (Em Aberto)</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-600">{brl(pendente + atrasado)}</p>
          <p className="text-[11px] text-amber-700/80">
            {atrasado > 0 ? `${brl(atrasado)} em atraso` : "aguardando dia da festa"}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-semibold text-stone-500">Total de Saídas</p>
          <p className="mt-1 text-2xl font-bold text-rose-500">{brl(gastos)}</p>
          <p className="text-[11px] text-stone-400">
            Balões: {brl(gastosBaloes)} • Parcerias: {brl(gastosParcerias)}
          </p>
        </Card>
        <Card className="!p-4 col-span-2 sm:col-span-1">
          <p className="text-xs font-semibold text-stone-500">Lucro Líquido</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              lucroLiquido >= 0 ? "text-stone-800" : "text-rose-500"
            }`}
          >
            {brl(lucroLiquido)}
          </p>
          <p className="text-[11px] text-stone-400">pago − saídas</p>
        </Card>
      </div>

      {/* CENTRAL PROFISSIONAL DE SAÍDAS: BALÕES & LOCAÇÃO DE ACERVO COM OUTRO DECORADOR */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Card 1: Saída Rápida com Balões */}
        <Card className="border-pink-200/80 bg-gradient-to-br from-white via-pink-50/40 to-rose-50/30">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 text-xl text-white shadow-md shadow-pink-200">
                🎈
              </span>
              <div>
                <h3 className="font-extrabold text-stone-800 text-sm sm:text-base">
                  Saída com Balões
                </h3>
                <p className="text-xs text-stone-500">
                  Lance rapidamente o valor gasto com balões, gás hélio ou acessórios
                </p>
              </div>
            </div>
            <Badge color="rose">Total: {brl(gastosBaloes)}</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                Valor Gasto (R$) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={quickBalloonValue}
                onChange={(e) => setQuickBalloonValue(e.target.value)}
                placeholder="R$ 0,00"
                className="!bg-white font-bold text-rose-600"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                Cores / Detalhes
              </label>
              <Input
                value={quickBalloonDesc}
                onChange={(e) => setQuickBalloonDesc(e.target.value)}
                placeholder="Ex: Rosé, Dourado, PicPic..."
                className="!bg-white text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                Festa / Cliente (Opcional)
              </label>
              <Input
                list="finClientsListQuick"
                value={quickBalloonClient}
                onChange={(e) => setQuickBalloonClient(e.target.value)}
                placeholder="Nome da cliente"
                className="!bg-white text-xs"
              />
              <datalist id="finClientsListQuick">
                {clients.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-pink-100">
            <button
              type="button"
              onClick={() => {
                setTx(emptyTx("saida", "baloes"));
                setOpen(true);
              }}
              className="text-xs font-semibold text-pink-600 hover:underline"
            >
              Abrir formulário completo de balões →
            </button>
            <Button
              variant="primary"
              className="!py-2 !px-4 text-xs"
              onClick={handleQuickBalloonSubmit}
            >
              🎈 Lançar Saída de Balões
            </Button>
          </div>
        </Card>

        {/* Card 2: Saída com Locação de Acervo com Outro Decorador */}
        <Card className="border-purple-200/80 bg-gradient-to-br from-white via-purple-50/40 to-lilac-50/30 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-xl text-white shadow-md shadow-purple-200">
                  🤝
                </span>
                <div>
                  <h3 className="font-extrabold text-stone-800 text-sm sm:text-base">
                    Saídas com Locação de Acervo (Outro Decorador)
                  </h3>
                  <p className="text-xs text-stone-500">
                    Controle profissional de sublocação de peças, painéis e mobiliário de parceiros
                  </p>
                </div>
              </div>
              <Badge color="lilac">Total: {brl(gastosParcerias)}</Badge>
            </div>

            <div className="mt-2 rounded-2xl bg-white/80 p-3 border border-purple-100 text-xs text-stone-600 space-y-1">
              <p className="font-semibold text-purple-900">
                ✨ Gestão Profissional de Parcerias:
              </p>
              <p className="text-[11px] text-stone-500">
                Registre o nome do decorador parceiro, WhatsApp, peças alugadas, para qual cliente/festa foram usadas, data de devolução ao parceiro, valor e gere comprovante em PDF.
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-100">
            <button
              type="button"
              onClick={() => {
                setTab("saida");
                setSearch("Locação de Acervo");
              }}
              className="text-xs font-semibold text-purple-600 hover:underline"
            >
              Ver histórico de parcerias →
            </button>
            <Button
              onClick={() => {
                setTx(emptyTx("saida", "sublocacao"));
                setOpen(true);
              }}
              className="!bg-gradient-to-r !from-purple-600 !to-pink-500 !py-2 !px-4 text-xs text-white shadow-md shadow-purple-200"
            >
              🤝 + Registrar Locação com Outro Decorador
            </Button>
          </div>
        </Card>
      </div>

      {/* Tabs and Filters */}
      <Card className="!p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {(["todas", "entrada", "saida"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  tab === t
                    ? "bg-gradient-to-r from-nude-400 to-lilac-400 text-white shadow"
                    : "bg-white/70 text-stone-500 hover:bg-white"
                }`}
              >
                {t === "saida" ? "💸 Saídas / Despesas" : t === "entrada" ? "💚 Entradas / Receitas" : "Todas"}
              </button>
            ))}

            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="!w-auto !bg-white text-xs font-medium"
            >
              <option value="Todos">Todos os Status</option>
              <option value="Pago">✅ Pago</option>
              <option value="Pendente">⏳ Falta Pagar (Em Aberto)</option>
              <option value="Atrasado">⚠️ Atrasado</option>
            </Select>
          </div>

          <Input
            placeholder="🔍 Buscar por cliente, decorador parceiro ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs !bg-white text-xs"
          />
        </div>
      </Card>

      {/* Transactions List */}
      <Card className="!p-0 overflow-hidden">
        <div className="divide-y divide-stone-100">
          {list.map((t) => {
            const isEntry = t.type === "entrada";
            const isPartnerSubrental =
              !isEntry &&
              (t.expenseSubtype === "sublocacao" ||
                t.category === "Locação de Acervo com Outro Decorador");
            const isBalloon =
              !isEntry && (t.expenseSubtype === "baloes" || t.category === "Saída com Balões");

            return (
              <div
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-white/50"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg ${
                      isEntry
                        ? t.status === "Pago"
                          ? "bg-emerald-50 text-emerald-500"
                          : "bg-amber-50 text-amber-600"
                        : isPartnerSubrental
                        ? "bg-purple-100 text-purple-600"
                        : isBalloon
                        ? "bg-pink-100 text-pink-600"
                        : "bg-rose-50 text-rose-500"
                    }`}
                  >
                    {isEntry ? (
                      <Icon.up className="h-5 w-5" />
                    ) : isPartnerSubrental ? (
                      "🤝"
                    ) : isBalloon ? (
                      "🎈"
                    ) : (
                      <Icon.down className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold text-stone-800 text-sm">{t.description}</p>
                      {t.paymentPart === "sinal" && (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Sinal da Decoração
                        </span>
                      )}
                      {t.paymentPart === "restante" && (
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            t.status === "Pago"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {t.status === "Pago" ? "Saldo Restante Quitado" : "Valor em Aberto"}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-stone-500">
                      <span className="font-semibold text-stone-600">{t.category}</span>
                      {t.client ? ` • Cliente/Festa: ${t.client}` : ""} • Data: {fmtDate(t.date)}{" "}
                      {t.method ? `(${t.method})` : ""}
                    </p>

                    {/* Detalhes profissionais de Locação com Outro Decorador */}
                    {isPartnerSubrental && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-purple-50/80 px-2.5 py-1 text-[11px] text-purple-900 border border-purple-100">
                        {t.partnerDecoratorName && (
                          <span>
                            👤 <b>Decorador Parceiro:</b> {t.partnerDecoratorName}
                          </span>
                        )}
                        {t.partnerRentedItems && (
                          <span>
                            📦 <b>Peças:</b> {t.partnerRentedItems}
                          </span>
                        )}
                        {t.partnerReturnDate && (
                          <span>
                            ↩️ <b>Devolver até:</b> {fmtDate(t.partnerReturnDate)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Detalhes de Saída com Balões */}
                    {isBalloon && (t.balloonColors || t.balloonSupplier) && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-pink-50/80 px-2.5 py-1 text-[11px] text-pink-900 border border-pink-100">
                        {t.balloonColors && (
                          <span>
                            🎈 <b>Detalhes/Cores:</b> {t.balloonColors}
                          </span>
                        )}
                        {t.balloonSupplier && (
                          <span>
                            🏪 <b>Fornecedor:</b> {t.balloonSupplier}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-right">
                    <p
                      className={`text-base font-extrabold ${
                        isEntry
                          ? t.status === "Pago"
                            ? "text-emerald-600"
                            : "text-amber-600"
                          : "text-rose-500"
                      }`}
                    >
                      {isEntry ? "+" : "−"}
                      {brl(t.amount)}
                    </p>
                    <button
                      onClick={() => toggleStatus(t.id)}
                      className={`mt-0.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        t.status === "Pago"
                          ? "bg-emerald-100 text-emerald-800"
                          : t.status === "Atrasado"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {t.status === "Pago"
                        ? "✅ Pago"
                        : t.status === "Pendente"
                        ? "⏳ Falta Pagar"
                        : "⚠️ Atrasado"}{" "}
                      ↻
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {/* Botão 1-Clique para confirmar recebimento de Valor em Aberto e gerar entrada no mês */}
                    {isEntry && t.status !== "Pago" && (
                      <Button
                        variant="wa"
                        className="!px-3 !py-1.5 text-xs font-bold"
                        onClick={() => confirmOpenPayment(t)}
                        title="Confirmar que já recebeu este valor em aberto e somar nas entradas do mês"
                      >
                        ✅ Receber Agora
                      </Button>
                    )}

                    {/* Botão de Gerar Recibo ou Ficha de Parceria em PDF */}
                    {((isEntry && t.status === "Pago") || isPartnerSubrental) && (
                      <Button
                        variant="gold"
                        className="!px-2.5 !py-1.5 text-xs"
                        onClick={() => generateReceiptPdf(t)}
                        title={
                          isPartnerSubrental
                            ? "Emitir Ficha de Parceria em PDF"
                            : "Emitir Recibo em PDF"
                        }
                      >
                        <Icon.pdf className="h-4 w-4" />{" "}
                        {isPartnerSubrental ? "Ficha PDF" : "Recibo"}
                      </Button>
                    )}

                    {isPartnerSubrental && t.partnerDecoratorPhone && (
                      <a
                        href={waLink(
                          t.partnerDecoratorPhone,
                          `Olá ${t.partnerDecoratorName || ""}! Passando para falar sobre a locação das peças (${
                            t.partnerRentedItems || t.description
                          }) no valor de ${brl(t.amount)}.`
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button variant="wa" className="!px-2.5 !py-1.5 text-xs">
                          <Icon.wa className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}

                    <button
                      onClick={() => {
                        setTx(t);
                        setOpen(true);
                      }}
                      className="rounded-xl bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-stone-500 hover:bg-white border border-stone-200/60"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {list.length === 0 && (
            <p className="px-4 py-16 text-center text-sm text-stone-400">
              Nenhuma movimentação financeira encontrada 💸
            </p>
          )}
        </div>
      </Card>

      {/* MODAL: FECHAR DECORAÇÃO (SINAL PAGO + VALOR EM ABERTO) */}
      <Modal
        open={openCloseDecoModal}
        onClose={() => setOpenCloseDecoModal(false)}
        title="Fechar Decoração — Lançar Sinal (Pago) e Restante (Falta Pagar)"
        wide
      >
        <div className="space-y-4 mt-2">
          <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-amber-50 p-3.5 border border-emerald-200 text-xs text-stone-700">
            💡 Ao fechar uma decoração, o <b>Valor do Sinal</b> entra imediatamente como{" "}
            <b className="text-emerald-700">PAGO</b> no mês atual, e o <b>Valor em Aberto</b> fica
            registrado como <b className="text-amber-700">FALTA PAGAR</b> com lembrete automático no
            dia da festa agendada!
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente *">
              <Input
                list="closeDecoClients"
                value={decoClient}
                onChange={(e) => setDecoClient(e.target.value)}
                placeholder="Selecione ou digite o nome da cliente"
              />
              <datalist id="closeDecoClients">
                {clients.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Tema da Decoração *">
              <Input
                value={decoTheme}
                onChange={(e) => setDecoTheme(e.target.value)}
                placeholder="Ex: Safari Baby, Stitch, Princesas..."
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data da Festa Agendada *">
              <Input
                type="date"
                value={decoPartyDate}
                onChange={(e) => setDecoPartyDate(e.target.value)}
              />
            </Field>
            <Field label="Forma de Pagamento">
              <Select value={decoMethod} onChange={(e) => setDecoMethod(e.target.value)}>
                <option>Pix</option>
                <option>Dinheiro</option>
                <option>Cartão de Crédito</option>
                <option>Cartão de Débito</option>
                <option>Transferência</option>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Valor Total da Decoração (R$) *">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={decoTotalValue}
                onChange={(e) =>
                  setDecoTotalValue(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="0,00"
                className="font-bold text-stone-800"
              />
            </Field>
            <Field label="Valor do Sinal Recebido (R$)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={decoDepositValue}
                onChange={(e) =>
                  setDecoDepositValue(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="0,00"
                className="font-bold text-emerald-600"
              />
            </Field>
            <div className="rounded-2xl bg-amber-50 p-3 border border-amber-200 flex flex-col justify-center text-center">
              <span className="text-[10px] font-bold uppercase text-amber-700">
                Valor em Aberto (Falta Pagar)
              </span>
              <span className="text-lg font-extrabold text-amber-600">
                {brl(Math.max(0, (Number(decoTotalValue) || 0) - (Number(decoDepositValue) || 0)))}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
            <Button variant="ghost" onClick={() => setOpenCloseDecoModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCloseDecorationSubmit}>
              ✅ Confirmar e Lançar no Financeiro
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: NOVA / EDITAR TRANSAÇÃO (ENTRADAS E SAÍDAS PROFISSIONAIS) */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          tx.type === "entrada"
            ? "Registrar Entrada Financeira"
            : tx.expenseSubtype === "baloes"
            ? "🎈 Registrar Saída com Balões"
            : tx.expenseSubtype === "sublocacao"
            ? "🤝 Registrar Locação de Acervo com Outro Decorador"
            : "💸 Registrar Saída / Despesa"
        }
        wide
      >
        <div className="space-y-4 mt-2">
          {/* Tipo Principal: Entrada vs Saída */}
          <div className="flex gap-2">
            {(["entrada", "saida"] as const).map((ty) => (
              <button
                key={ty}
                type="button"
                onClick={() =>
                  setTx({
                    ...tx,
                    type: ty,
                    expenseSubtype: ty === "saida" ? tx.expenseSubtype || "baloes" : undefined,
                    category:
                      ty === "entrada"
                        ? "Locação Pegue e Monte"
                        : tx.expenseSubtype === "sublocacao"
                        ? "Locação de Acervo com Outro Decorador"
                        : "Saída com Balões",
                  })
                }
                className={`flex-1 rounded-2xl py-2.5 text-sm font-semibold transition ${
                  tx.type === ty
                    ? ty === "entrada"
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                      : "bg-rose-500 text-white shadow-md shadow-rose-200"
                    : "bg-white/70 text-stone-500"
                }`}
              >
                {ty === "entrada" ? "💚 Entrada / Receita" : "💸 Saída / Despesa"}
              </button>
            ))}
          </div>

          {/* Seletor de Subtipo de Saída (Balões | Locação com Outro Decorador | Outras Saídas) */}
          {tx.type === "saida" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-2xl bg-stone-100/80 p-2 border border-stone-200">
              <button
                type="button"
                onClick={() =>
                  setTx({
                    ...tx,
                    expenseSubtype: "baloes",
                    category: "Saída com Balões",
                    description:
                      !tx.description || tx.description.startsWith("Locação de Acervo")
                        ? "Saída com Balões"
                        : tx.description,
                  })
                }
                className={`rounded-xl py-2.5 px-3 text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                  tx.expenseSubtype === "baloes" || tx.category === "Saída com Balões"
                    ? "bg-pink-500 text-white shadow-sm"
                    : "bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                <span>🎈</span> Saída com Balões
              </button>

              <button
                type="button"
                onClick={() =>
                  setTx({
                    ...tx,
                    expenseSubtype: "sublocacao",
                    category: "Locação de Acervo com Outro Decorador",
                    description:
                      !tx.description || tx.description === "Saída com Balões"
                        ? "Locação de Acervo com Decorador Parceiro"
                        : tx.description,
                  })
                }
                className={`rounded-xl py-2.5 px-3 text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                  tx.expenseSubtype === "sublocacao" ||
                  tx.category === "Locação de Acervo com Outro Decorador"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                <span>🤝</span> Locação Outro Decorador
              </button>

              <button
                type="button"
                onClick={() =>
                  setTx({
                    ...tx,
                    expenseSubtype: "outros",
                    category: "Compra de peças",
                    description:
                      tx.description === "Saída com Balões" ||
                      tx.description === "Locação de Acervo com Decorador Parceiro"
                        ? ""
                        : tx.description,
                  })
                }
                className={`rounded-xl py-2.5 px-3 text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                  tx.expenseSubtype === "outros" &&
                  tx.category !== "Saída com Balões" &&
                  tx.category !== "Locação de Acervo com Outro Decorador"
                    ? "bg-stone-800 text-white shadow-sm"
                    : "bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                <span>📦</span> Outras Despesas
              </button>
            </div>
          )}

          {/* MODO 1 DE SAÍDA: SAÍDA COM BALÕES */}
          {tx.type === "saida" &&
            (tx.expenseSubtype === "baloes" || tx.category === "Saída com Balões") && (
              <div className="rounded-2xl bg-pink-50/70 p-4 border border-pink-200 space-y-4">
                <div className="flex items-center gap-2 text-pink-800 font-bold text-xs uppercase tracking-wider">
                  <span>🎈</span> Detalhes da Saída com Balões
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Valor Gasto com Balões (R$) *">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tx.amount || ""}
                      onChange={(e) => setTx({ ...tx, amount: +e.target.value })}
                      placeholder="0.00"
                      className="!bg-white font-extrabold text-rose-600 text-base"
                    />
                  </Field>

                  <Field label="Festa / Cliente Vinculada (Opcional)">
                    <Input
                      list="finClientsList"
                      value={tx.client || ""}
                      onChange={(e) => setTx({ ...tx, client: e.target.value })}
                      placeholder="Para qual festa foram os balões?"
                      className="!bg-white"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Cores / Tamanhos / Especificações dos Balões">
                    <Input
                      value={tx.balloonColors || ""}
                      onChange={(e) => setTx({ ...tx, balloonColors: e.target.value })}
                      placeholder="Ex: 2 pacotes Rosé Nº9, 1 Dourado Cromado, Gás Hélio..."
                      className="!bg-white"
                    />
                  </Field>

                  <Field label="Fornecedor / Loja de Festas">
                    <Input
                      value={tx.balloonSupplier || ""}
                      onChange={(e) => setTx({ ...tx, balloonSupplier: e.target.value })}
                      placeholder="Ex: Casa das Festas, Mercado Livre..."
                      className="!bg-white"
                    />
                  </Field>
                </div>
              </div>
            )}

          {/* MODO 2 DE SAÍDA: LOCAÇÃO DE ACERVO COM OUTRO DECORADOR (BEM PROFISSIONAL) */}
          {tx.type === "saida" &&
            (tx.expenseSubtype === "sublocacao" ||
              tx.category === "Locação de Acervo com Outro Decorador") && (
              <div className="rounded-2xl bg-purple-50/70 p-4 border border-purple-200 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-purple-900 font-bold text-xs uppercase tracking-wider">
                    <span>🤝</span> Ficha Profissional de Locação com Outro Decorador
                  </span>
                  <Badge color="lilac">Sublocação / Parceria</Badge>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome do Decorador(a) ou Empresa Parceira *">
                    <Input
                      value={tx.partnerDecoratorName || ""}
                      onChange={(e) => setTx({ ...tx, partnerDecoratorName: e.target.value })}
                      placeholder="Ex: Ateliê Festas & Cia / Camila Decor"
                      className="!bg-white font-semibold"
                    />
                  </Field>

                  <Field label="WhatsApp / Telefone do Decorador Parceiro">
                    <Input
                      value={tx.partnerDecoratorPhone || ""}
                      onChange={(e) => setTx({ ...tx, partnerDecoratorPhone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className="!bg-white"
                    />
                  </Field>
                </div>

                <Field label="Peças / Acervo Alugado do Parceiro *">
                  <Textarea
                    value={tx.partnerRentedItems || ""}
                    onChange={(e) => setTx({ ...tx, partnerRentedItems: e.target.value })}
                    placeholder="Descreva as peças alugadas (Ex: 1 Painel Romano, 3 Cilindros Capas Safari, 2 Pelúcias G, 4 Boleiras Douradas)..."
                    className="!bg-white"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Valor da Locação (R$) *">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tx.amount || ""}
                      onChange={(e) => setTx({ ...tx, amount: +e.target.value })}
                      placeholder="0.00"
                      className="!bg-white font-extrabold text-purple-700 text-base"
                    />
                  </Field>

                  <Field label="Data de Retirada no Parceiro">
                    <Input
                      type="date"
                      value={tx.partnerPickupDate || tx.date}
                      onChange={(e) => setTx({ ...tx, partnerPickupDate: e.target.value })}
                      className="!bg-white"
                    />
                  </Field>

                  <Field label="Data de Devolução ao Parceiro">
                    <Input
                      type="date"
                      value={tx.partnerReturnDate || tx.date}
                      onChange={(e) => setTx({ ...tx, partnerReturnDate: e.target.value })}
                      className="!bg-white"
                    />
                  </Field>
                </div>

                <Field label="Para qual Festa / Cliente foi alugado?">
                  <Input
                    list="finClientsList"
                    value={tx.client || ""}
                    onChange={(e) => setTx({ ...tx, client: e.target.value })}
                    placeholder="Selecione ou digite a cliente da festa"
                    className="!bg-white"
                  />
                </Field>
              </div>
            )}

          <Field label="Descrição do Lançamento">
            <Input
              value={tx.description}
              onChange={(e) => setTx({ ...tx, description: e.target.value })}
              placeholder="Ex: Sinal de reserva festa Stitch, Saída com balões, Locação de peças..."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria">
              <Select
                value={tx.category}
                onChange={(e) => setTx({ ...tx, category: e.target.value })}
              >
                {(tx.type === "entrada" ? IN_CATS : OUT_CATS).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>

            <Field label="Valor (R$)">
              <Input
                type="number"
                step="0.01"
                value={tx.amount || ""}
                onChange={(e) => setTx({ ...tx, amount: +e.target.value })}
                placeholder="0.00"
                className="font-bold text-stone-800"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Cliente Vinculado (Opcional)">
              <Input
                list="finClientsList"
                value={tx.client || ""}
                onChange={(e) => setTx({ ...tx, client: e.target.value })}
                placeholder="Nome da cliente"
              />
              <datalist id="finClientsList">
                {clients.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </Field>

            <Field label="Forma de Pagamento">
              <Select value={tx.method} onChange={(e) => setTx({ ...tx, method: e.target.value })}>
                <option>Pix</option>
                <option>Cartão de Crédito</option>
                <option>Cartão de Débito</option>
                <option>Dinheiro</option>
                <option>Transferência</option>
              </Select>
            </Field>

            <Field label="Status do Pagamento">
              <Select
                value={tx.status}
                onChange={(e) =>
                  setTx({ ...tx, status: e.target.value as "Pago" | "Pendente" | "Atrasado" })
                }
              >
                <option value="Pago">✅ Pago / Confirmado</option>
                <option value="Pendente">⏳ Falta Pagar (Em Aberto)</option>
                <option value="Atrasado">⚠️ Atrasado</option>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data da Movimentação">
              <Input
                type="date"
                value={tx.date}
                onChange={(e) => setTx({ ...tx, date: e.target.value })}
              />
            </Field>

            {tx.type === "entrada" && (
              <Field label="Data da Festa Agendada (para Lembrete Automático)">
                <Input
                  type="date"
                  value={tx.partyDate || tx.date}
                  onChange={(e) => setTx({ ...tx, partyDate: e.target.value })}
                />
              </Field>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {safeTransactions.some((x) => x.id === tx.id) && (
            <Button
              variant="soft"
              className="!text-rose-500"
              onClick={() => {
                if (confirm("Excluir este lançamento financeiro?")) {
                  setTransactions(safeTransactions.filter((x) => x.id !== tx.id));
                  setOpen(false);
                  toast("Lançamento removido");
                }
              }}
            >
              Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)} className="ml-auto">
            Cancelar
          </Button>
          <Button onClick={save}>Salvar Lançamento</Button>
        </div>
      </Modal>
    </div>
  );
}
