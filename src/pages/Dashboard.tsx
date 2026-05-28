import { Card, SectionTitle, Badge, Button } from "../components/ui";
import { BarChart, DualLineChart, HBars } from "../components/charts";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { brl, brlShort, fmtDate, monthName, sameMonth } from "../lib/format";
import type { Page } from "../App";

function Stat({
  label,
  value,
  hint,
  emoji,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  emoji: string;
  trend?: "up" | "down";
}) {
  return (
    <Card className="animate-rise">
      <div className="flex items-start justify-between">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-nude-100 to-lilac-100 text-xl">
          {emoji}
        </div>
        {trend && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${
              trend === "up" ? "text-emerald-500" : "text-rose-400"
            }`}
          >
            {trend === "up" ? <Icon.up className="h-3.5 w-3.5" /> : <Icon.down className="h-3.5 w-3.5" />}
            {hint}
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-stone-800">{value}</p>
      <p className="text-sm text-stone-500">{label}</p>
    </Card>
  );
}

export default function Dashboard({ go }: { go: (p: Page) => void }) {
  const { clients, themes, transactions, events, contracts } = useStore();

  const monthTx = transactions.filter((t) => sameMonth(t.date));
  const entradas = monthTx.filter((t) => t.type === "entrada");
  const saidas = monthTx.filter((t) => t.type === "saida");
  const faturamento = entradas.filter((t) => t.status === "Pago").reduce((s, t) => s + t.amount, 0);
  const gastos = saidas.reduce((s, t) => s + t.amount, 0);
  const lucro = faturamento - gastos;
  const pendentes = transactions
    .filter((t) => t.type === "entrada" && t.status === "Pendente")
    .reduce((s, t) => s + t.amount, 0);
  const novosClientes = clients.filter((c) => sameMonth(c.createdAt)).length;
  const festasAgendadas = clients.filter((c) => c.status === "Agendado" || c.status === "Pago sinal").length;

  // 6-month series
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: monthName(d.getMonth()) };
  });
  const sumBy = (type: "entrada" | "saida", key: string) =>
    transactions
      .filter((t) => {
        const d = new Date(t.date);
        return t.type === type && `${d.getFullYear()}-${d.getMonth()}` === key;
      })
      .reduce((s, t) => s + t.amount, 0);
  const inData = months.map((m) => sumBy("entrada", m.key));
  const outData = months.map((m) => sumBy("saida", m.key));
  const profitData = months.map((_, i) => inData[i] - outData[i]);

  const topThemes = [...themes].sort((a, b) => b.rentals - a.rentals).slice(0, 5).map((t) => ({ label: t.name, value: t.rentals, emoji: t.photo }));

  const upcoming = [...events].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);

  const shortcuts: { label: string; emoji: string; page: Page; variant?: "gold" | "wa" }[] = [
    { label: "Novo cliente", emoji: "👤", page: "clients" },
    { label: "Novo orçamento", emoji: "🧾", page: "quotes" },
    { label: "Gerar contrato", emoji: "📑", page: "contracts" },
    { label: "Novo gasto", emoji: "💸", page: "finance" },
    { label: "WhatsApp", emoji: "💬", page: "messages", variant: "wa" },
    { label: "Agenda", emoji: "🗓️", page: "calendar", variant: "gold" },
  ];

  return (
    <div className="space-y-6">
      <div className="animate-fade">
        <p className="text-sm font-medium text-lilac-400">Bem-vinda de volta ✨</p>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-800 sm:text-3xl">
          Painel da <span className="text-gradient">Festa &amp; Cia</span>
        </h1>
        <p className="mt-1 text-sm text-stone-500">Sua decoração Pegue e Monte organizada num só lugar.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Faturamento do mês" value={brl(faturamento)} emoji="💰" trend="up" hint="+12%" />
        <Stat label="Lucro do mês" value={brl(lucro)} emoji="📈" trend="up" hint="+8%" />
        <Stat label="Gastos do mês" value={brl(gastos)} emoji="🧾" trend="down" hint="-3%" />
        <Stat label="Pagamentos pendentes" value={brl(pendentes)} emoji="⏳" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Festas agendadas" value={String(festasAgendadas)} emoji="🎉" />
        <Stat label="Clientes novos" value={String(novosClientes)} emoji="🌸" />
        <Stat label="Contratos fechados" value={String(contracts.length)} emoji="✍️" />
        <Stat label="Temas no acervo" value={String(themes.length)} emoji="🎀" />
      </div>

      {/* Shortcuts */}
      <Card>
        <SectionTitle title="Atalhos rápidos" subtitle="Faça em segundos o que mais importa" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              onClick={() => go(s.page)}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-white/70 bg-white/60 p-3 text-center transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-lilac-100"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-nude-100 to-lilac-100 text-xl transition group-hover:scale-110">
                {s.emoji}
              </span>
              <span className="text-[11px] font-medium leading-tight text-stone-600">{s.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Entradas x Saídas" subtitle="Últimos 6 meses" />
          <DualLineChart
            labels={months.map((m) => m.label)}
            series={[
              { name: "Entradas", color: "#a98fe0", data: inData },
              { name: "Saídas", color: "#d18a7a", data: outData },
            ]}
          />
        </Card>
        <Card>
          <SectionTitle title="Temas mais alugados" />
          <HBars data={topThemes} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Lucro mensal" subtitle="Resultado líquido por mês" />
          <BarChart data={months.map((m, i) => ({ label: m.label, value: Math.max(profitData[i], 0) }))} color="#c9a45c" />
        </Card>
        <Card>
          <SectionTitle title="Próximas festas" />
          <div className="space-y-3">
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-2xl bg-white/60 p-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-lilac-100 text-lg">🎈</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-700">{e.theme}</p>
                  <p className="truncate text-xs text-stone-500">{e.clientName}</p>
                </div>
                <Badge color="lilac">{fmtDate(e.date)}</Badge>
              </div>
            ))}
            {upcoming.length === 0 && <p className="text-sm text-stone-400">Sem festas próximas.</p>}
            <Button variant="soft" className="w-full" onClick={() => go("calendar")}>
              Ver agenda completa
            </Button>
          </div>
        </Card>
      </div>

      <p className="pb-2 text-center text-xs text-stone-400">
        Total recebido (geral): {brlShort(transactions.filter((t) => t.type === "entrada" && t.status === "Pago").reduce((s, t) => s + t.amount, 0))} • feito com 💕
      </p>
    </div>
  );
}
