import { useMemo, useState } from "react";
import { Card, SectionTitle, Button, Modal, Field, Input, Select, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { brl, fmtDate, uid } from "../lib/format";
import { useToast } from "../components/Toast";
import type { Transaction, TxType } from "../lib/types";

const OUT_CATS = ["Compra de peças", "Balões", "Impressão", "Combustível", "Funcionários", "Manutenção", "Investimentos"];
const IN_CATS = ["Locação", "Taxa de entrega", "Outros"];

const empty = (type: TxType): Transaction => ({
  id: uid(),
  type,
  description: "",
  category: type === "entrada" ? "Locação" : "Compra de peças",
  client: "",
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
  method: "Pix",
  status: type === "entrada" ? "Pendente" : "Pago",
});

export default function Finance() {
  const { transactions, setTransactions, clients } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [tx, setTx] = useState<Transaction>(empty("entrada"));
  const [tab, setTab] = useState<"todas" | "entrada" | "saida">("todas");

  const entradas = transactions.filter((t) => t.type === "entrada");
  const saidas = transactions.filter((t) => t.type === "saida");
  const recebido = entradas.filter((t) => t.status === "Pago").reduce((s, t) => s + t.amount, 0);
  const pendente = entradas.filter((t) => t.status === "Pendente").reduce((s, t) => s + t.amount, 0);
  const gastos = saidas.reduce((s, t) => s + t.amount, 0);
  const lucroBruto = recebido;
  const lucroLiquido = recebido - gastos;

  const list = useMemo(
    () => transactions.filter((t) => (tab === "todas" ? true : t.type === tab)).sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, tab],
  );

  const save = () => {
    if (!tx.description.trim()) return toast("Informe a descrição");
    const exists = transactions.some((x) => x.id === tx.id);
    setTransactions(exists ? transactions.map((x) => (x.id === tx.id ? tx : x)) : [tx, ...transactions]);
    setOpen(false);
    toast(exists ? "Lançamento atualizado!" : "Lançamento adicionado!");
  };

  const togglePaid = (id: string) =>
    setTransactions(transactions.map((t) => (t.id === id ? { ...t, status: t.status === "Pago" ? "Pendente" : "Pago" } : t)));

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Controle financeiro"
        subtitle="Entradas, saídas e lucros automáticos"
        action={
          <div className="flex gap-2">
            <Button variant="wa" onClick={() => { setTx(empty("entrada")); setOpen(true); }}><Icon.up className="h-4 w-4" /> Entrada</Button>
            <Button onClick={() => { setTx(empty("saida")); setOpen(true); }}><Icon.down className="h-4 w-4" /> Saída</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><p className="text-xs text-stone-500">Total recebido</p><p className="mt-1 text-xl font-semibold text-emerald-600">{brl(recebido)}</p></Card>
        <Card><p className="text-xs text-stone-500">Total de gastos</p><p className="mt-1 text-xl font-semibold text-rose-400">{brl(gastos)}</p></Card>
        <Card><p className="text-xs text-stone-500">Lucro bruto</p><p className="mt-1 text-xl font-semibold text-stone-800">{brl(lucroBruto)}</p></Card>
        <Card><p className="text-xs text-stone-500">Lucro líquido</p><p className={`mt-1 text-xl font-semibold ${lucroLiquido >= 0 ? "text-gold" : "text-rose-500"}`}>{brl(lucroLiquido)}</p></Card>
      </div>

      <Card className="!p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {(["todas", "entrada", "saida"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition ${tab === t ? "bg-gradient-to-r from-nude-400 to-lilac-400 text-white shadow" : "bg-white/70 text-stone-500 hover:bg-white"}`}>{t === "saida" ? "saídas" : t}</button>
            ))}
          </div>
          {pendente > 0 && <Badge color="amber">⏳ {brl(pendente)} a receber</Badge>}
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="divide-y divide-stone-100/70">
          {list.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-white/50">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${t.type === "entrada" ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-400"}`}>
                {t.type === "entrada" ? <Icon.up className="h-4 w-4" /> : <Icon.down className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-700">{t.description}</p>
                <p className="truncate text-xs text-stone-400">{t.category}{t.client ? ` • ${t.client}` : ""} • {fmtDate(t.date)}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${t.type === "entrada" ? "text-emerald-600" : "text-rose-400"}`}>{t.type === "entrada" ? "+" : "−"}{brl(t.amount)}</p>
                {t.type === "entrada" && (
                  <button onClick={() => togglePaid(t.id)} className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${t.status === "Pago" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{t.status}</button>
                )}
              </div>
              <button onClick={() => { setTx(t); setOpen(true); }} className="hidden shrink-0 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs text-stone-400 hover:bg-white sm:block">✎</button>
            </div>
          ))}
          {list.length === 0 && <p className="px-4 py-10 text-center text-sm text-stone-400">Nenhum lançamento 💸</p>}
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={tx.type === "entrada" ? "Nova entrada" : "Nova saída"} wide>
        <div className="mb-4 flex gap-2">
          {(["entrada", "saida"] as const).map((ty) => (
            <button key={ty} onClick={() => setTx({ ...tx, type: ty, category: ty === "entrada" ? "Locação" : "Compra de peças" })} className={`flex-1 rounded-2xl py-2.5 text-sm font-medium transition ${tx.type === ty ? (ty === "entrada" ? "bg-emerald-500 text-white" : "bg-rose-400 text-white") : "bg-white/70 text-stone-500"}`}>{ty === "entrada" ? "💚 Entrada" : "💸 Saída"}</button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Descrição"><Input value={tx.description} onChange={(e) => setTx({ ...tx, description: e.target.value })} placeholder="Ex: Sinal festa Stitch" /></Field></div>
          <Field label="Categoria">
            <Select value={tx.category} onChange={(e) => setTx({ ...tx, category: e.target.value })}>
              {(tx.type === "entrada" ? IN_CATS : OUT_CATS).map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Valor (R$)"><Input type="number" value={tx.amount || ""} onChange={(e) => setTx({ ...tx, amount: +e.target.value })} /></Field>
          {tx.type === "entrada" && (
            <>
              <Field label="Cliente">
                <Input list="finclients" value={tx.client} onChange={(e) => setTx({ ...tx, client: e.target.value })} />
                <datalist id="finclients">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
              </Field>
              <Field label="Forma de pagamento"><Select value={tx.method} onChange={(e) => setTx({ ...tx, method: e.target.value })}><option>Pix</option><option>Cartão</option><option>Dinheiro</option><option>Transferência</option></Select></Field>
              <Field label="Status"><Select value={tx.status} onChange={(e) => setTx({ ...tx, status: e.target.value as "Pago" | "Pendente" })}><option>Pago</option><option>Pendente</option></Select></Field>
            </>
          )}
          <Field label="Data"><Input type="date" value={tx.date} onChange={(e) => setTx({ ...tx, date: e.target.value })} /></Field>
        </div>
        <div className="mt-6 flex gap-3">
          {transactions.some((x) => x.id === tx.id) && <Button variant="soft" className="!text-rose-500" onClick={() => { setTransactions(transactions.filter((x) => x.id !== tx.id)); setOpen(false); toast("Lançamento removido"); }}>Excluir</Button>}
          <Button variant="ghost" onClick={() => setOpen(false)} className="ml-auto">Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </div>
      </Modal>
    </div>
  );
}
