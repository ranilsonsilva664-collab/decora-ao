import { useMemo, useState } from "react";
import { Card, SectionTitle, Button, Modal, Field, Input, Select, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { brl, fmtDate, uid } from "../lib/format";
import { waLink } from "../lib/helpers";
import { useToast } from "../components/Toast";
import type { Transaction, TxType } from "../lib/types";

const OUT_CATS = [
  "Compra de peças",
  "Balões",
  "Impressão de painéis",
  "Combustível / Transporte",
  "Equipe / Montagem",
  "Manutenção / Limpeza",
  "Embalagens / Acessórios",
  "Marketing / Tráfego",
  "Outros",
];

const IN_CATS = ["Locação Pegue e Monte", "Sinal de Reserva", "Taxa de Entrega", "Taxa de Montagem", "Reposição de Avaria", "Outros"];

const emptyTx = (type: TxType): Transaction => ({
  id: uid(),
  type,
  description: "",
  category: type === "entrada" ? "Locação Pegue e Monte" : "Compra de peças",
  client: "",
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
  method: "Pix",
  status: type === "entrada" ? "Pago" : "Pago",
});

export default function Finance() {
  const { transactions, setTransactions, clients, eventsList, companySettings, logAction } = useStore();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [tx, setTx] = useState<Transaction>(emptyTx("entrada"));
  const [tab, setTab] = useState<"todas" | "entrada" | "saida">("todas");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [search, setSearch] = useState("");

  const safeTransactions = transactions || [];

  const entradas = safeTransactions.filter((t) => t.type === "entrada");
  const saidas = safeTransactions.filter((t) => t.type === "saida");
  const recebido = entradas.filter((t) => t.status === "Pago").reduce((s, t) => s + t.amount, 0);
  const pendente = entradas.filter((t) => t.status === "Pendente").reduce((s, t) => s + t.amount, 0);
  const atrasado = entradas.filter((t) => t.status === "Atrasado").reduce((s, t) => s + t.amount, 0);
  const gastos = saidas.reduce((s, t) => s + t.amount, 0);
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
          t.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [safeTransactions, tab, statusFilter, search]);

  const save = () => {
    if (!tx.description.trim()) return toast("Informe a descrição do lançamento");
    if (!tx.amount || tx.amount <= 0) return toast("Informe um valor válido");

    const exists = safeTransactions.some((x) => x.id === tx.id);
    const updated = exists ? safeTransactions.map((x) => (x.id === tx.id ? tx : x)) : [tx, ...safeTransactions];
    setTransactions(updated);
    setOpen(false);
    logAction(
      exists ? "Transação Atualizada" : "Nova Movimentação Financeira",
      `${tx.type === "entrada" ? "Entrada" : "Saída"}: ${tx.description} (${brl(tx.amount)})`
    );
    toast(exists ? "Lançamento atualizado!" : "Lançamento adicionado!");
  };

  const toggleStatus = (id: string) => {
    const item = safeTransactions.find((t) => t.id === id);
    if (!item) return;

    let nextStatus: "Pago" | "Pendente" | "Atrasado" = "Pago";
    if (item.status === "Pago") nextStatus = "Pendente";
    else if (item.status === "Pendente") nextStatus = "Atrasado";
    else nextStatus = "Pago";

    setTransactions(
      safeTransactions.map((t) => (t.id === id ? { ...t, status: nextStatus } : t))
    );
    toast(`Status alterado para: ${nextStatus}`);
  };

  // REQUISITO 28: GERADOR DE RECIBO EM PDF
  const generateReceiptPdf = (t: Transaction) => {
    const w = window.open("", "_blank");
    if (!w) return;

    const logo = companySettings.logo || "";
    const compName = companySettings.name || "RAYDECOR Pegue e Monte";
    const clientData = clients.find((c) => c.name.toLowerCase() === (t.client || "").toLowerCase());

    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Recibo — ${t.client || "Cliente"}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Poppins', Arial, sans-serif; padding: 40px; color: #222; background: #fff; font-size: 13px; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; border: 1px solid #fbcfe8; border-radius: 24px; padding: 40px; box-shadow: 0 10px 30px rgba(236, 72, 153, 0.08); background: #ffffff; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px dashed #fce7f3; padding-bottom: 20px; margin-bottom: 25px; }
          .logo { height: 60px; width: 60px; object-fit: cover; border-radius: 16px; border: 1px solid #fce7f3; }
          .brand h1 { font-size: 18px; color: #db2777; font-weight: 700; }
          .brand p { font-size: 11px; color: #777; }
          .receipt-title { font-size: 22px; font-weight: 800; color: #db2777; text-align: center; margin: 15px 0 25px 0; letter-spacing: 1px; }
          .amount-box { background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 18px; padding: 20px; text-align: center; margin-bottom: 25px; }
          .amount-label { font-size: 12px; font-weight: 600; color: #9d174d; text-transform: uppercase; }
          .amount-value { font-size: 32px; font-weight: 800; color: #db2777; margin-top: 4px; }
          .details { background: #fafafa; border-radius: 16px; padding: 20px; font-size: 13px; space-y: 10px; margin-bottom: 30px; }
          .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
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
              <p><b>Recibo Nº:</b> #${t.id.slice(0, 6).toUpperCase()}</p>
              <p>Data: ${fmtDate(t.date)}</p>
            </div>
          </div>

          <div class="receipt-title">RECIBO DE PAGAMENTO</div>

          <div class="amount-box">
            <div class="amount-label">Valor Recebido</div>
            <div class="amount-value">${brl(t.amount)}</div>
          </div>

          <div class="details">
            <div class="row">
              <span style="color:#666;">Recebemos de:</span>
              <span style="font-weight:700; color:#222;">${t.client || "Cliente"}</span>
            </div>
            ${clientData?.cpf ? `<div class="row"><span style="color:#666;">CPF:</span><span>${clientData.cpf}</span></div>` : ""}
            <div class="row">
              <span style="color:#666;">Referente a:</span>
              <span style="font-weight:600; color:#222;">${t.description}</span>
            </div>
            <div class="row">
              <span style="color:#666;">Forma de Pagamento:</span>
              <span style="font-weight:600; color:#db2777;">${t.method || "Pix"}</span>
            </div>
            <div class="row">
              <span style="color:#666;">Status:</span>
              <span style="font-weight:700; color:#16a34a;">Confirmado e Quitado</span>
            </div>
          </div>

          <div class="signature-area">
            <p><b>${compName}</b></p>
            <p style="font-size:11px; color:#777;">Responsável: ${companySettings.ownerName || "A Gerência"}</p>
          </div>

          <div class="footer">
            <p>Agradecemos a sua preferência! 💕</p>
          </div>
        </div>
        <script>window.print()</script>
      </body>
      </html>
    `);
    w.document.close();
    toast("Gerando Recibo em PDF...");
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Gestão Financeira"
        subtitle="Controle de receitas, despesas, pagamentos e emissão de recibos profissionais"
        action={
          <div className="flex gap-2">
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
              className="!text-rose-500"
              onClick={() => {
                setTx(emptyTx("saida"));
                setOpen(true);
              }}
            >
              <Icon.down className="h-4 w-4" /> + Despesa
            </Button>
          </div>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="!p-4">
          <p className="text-xs font-semibold text-stone-500">Total Recebido</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{brl(recebido)}</p>
          <p className="text-[11px] text-stone-400">entradas quitadas</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-semibold text-stone-500">Total a Receber</p>
          <p className="mt-1 text-2xl font-bold text-amber-500">{brl(pendente + atrasado)}</p>
          <p className="text-[11px] text-stone-400">
            {atrasado > 0 ? `${brl(atrasado)} em atraso` : "pendentes de festas"}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-semibold text-stone-500">Total de Despesas</p>
          <p className="mt-1 text-2xl font-bold text-rose-500">{brl(gastos)}</p>
          <p className="text-[11px] text-stone-400">compras e custos</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-semibold text-stone-500">Lucro Líquido</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              lucroLiquido >= 0 ? "text-stone-800" : "text-rose-500"
            }`}
          >
            {brl(lucroLiquido)}
          </p>
          <p className="text-[11px] text-stone-400">recebido − gastos</p>
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
                className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${
                  tab === t
                    ? "bg-gradient-to-r from-nude-400 to-lilac-400 text-white shadow"
                    : "bg-white/70 text-stone-500 hover:bg-white"
                }`}
              >
                {t === "saida" ? "Despesas" : t === "entrada" ? "Receitas" : "Todas"}
              </button>
            ))}

            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="!w-auto !bg-white text-xs font-medium"
            >
              <option value="Todos">Todos os Status</option>
              <option value="Pago">Pago</option>
              <option value="Pendente">Pendente</option>
              <option value="Atrasado">Atrasado</option>
            </Select>
          </div>

          <Input
            placeholder="🔍 Buscar por descrição ou cliente..."
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
            return (
              <div
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-white/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                      isEntry ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-500"
                    }`}
                  >
                    {isEntry ? <Icon.up className="h-5 w-5" /> : <Icon.down className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-stone-800 text-sm">{t.description}</p>
                    <p className="truncate text-xs text-stone-400">
                      {t.category} {t.client ? `• ${t.client}` : ""} • {fmtDate(t.date)}{" "}
                      {t.method ? `(${t.method})` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <div className="text-right">
                    <p
                      className={`text-base font-bold ${
                        isEntry ? "text-emerald-600" : "text-rose-500"
                      }`}
                    >
                      {isEntry ? "+" : "−"}
                      {brl(t.amount)}
                    </p>
                    {isEntry && (
                      <button
                        onClick={() => toggleStatus(t.id)}
                        className={`mt-0.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          t.status === "Pago"
                            ? "bg-emerald-50 text-emerald-700"
                            : t.status === "Atrasado"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {t.status} ↻
                      </button>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    {/* Botão de Gerar Recibo em PDF (Requisito 28) */}
                    {isEntry && t.status === "Pago" && (
                      <Button
                        variant="gold"
                        className="!px-2.5 !py-1.5 text-xs"
                        onClick={() => generateReceiptPdf(t)}
                        title="Emitir Recibo em PDF"
                      >
                        <Icon.pdf className="h-4 w-4" /> Recibo
                      </Button>
                    )}

                    <button
                      onClick={() => {
                        setTx(t);
                        setOpen(true);
                      }}
                      className="rounded-xl bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-stone-500 hover:bg-white"
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

      {/* MODAL: NOVA / EDITAR TRANSAÇÃO */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={tx.type === "entrada" ? "Registrar Entrada" : "Registrar Despesa"}
        wide
      >
        <div className="space-y-4 mt-2">
          <div className="flex gap-2">
            {(["entrada", "saida"] as const).map((ty) => (
              <button
                key={ty}
                onClick={() =>
                  setTx({
                    ...tx,
                    type: ty,
                    category: ty === "entrada" ? "Locação Pegue e Monte" : "Compra de peças",
                  })
                }
                className={`flex-1 rounded-2xl py-2.5 text-sm font-semibold transition ${
                  tx.type === ty
                    ? ty === "entrada"
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                      : "bg-rose-400 text-white shadow-md shadow-rose-200"
                    : "bg-white/70 text-stone-500"
                }`}
              >
                {ty === "entrada" ? "💚 Entrada / Receita" : "💸 Saída / Despesa"}
              </button>
            ))}
          </div>

          <Field label="Descrição do Lançamento">
            <Input
              value={tx.description}
              onChange={(e) => setTx({ ...tx, description: e.target.value })}
              placeholder="Ex: Sinal de reserva festa Stitch, Compra de balões..."
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

          {tx.type === "entrada" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Cliente Vinculado">
                <Input
                  list="finClientsList"
                  value={tx.client || ""}
                  onChange={(e) => setTx({ ...tx, client: e.target.value })}
                  placeholder="Nome do cliente"
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
                  <option value="Pago">Pago / Confirmado</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Atrasado">Atrasado</option>
                </Select>
              </Field>
            </div>
          )}

          <Field label="Data da Movimentação">
            <Input
              type="date"
              value={tx.date}
              onChange={(e) => setTx({ ...tx, date: e.target.value })}
            />
          </Field>
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
