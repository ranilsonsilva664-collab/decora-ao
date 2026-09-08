import { Card, SectionTitle, Badge, Button } from "../components/ui";
import { BarChart, DualLineChart, HBars } from "../components/charts";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { brl, brlShort, fmtDate, monthName, sameMonth } from "../lib/format";
import type { Page } from "../App";

function ClickableStat({
  label,
  value,
  hint,
  emoji,
  trend,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  emoji: string;
  trend?: "up" | "down";
  onClick?: () => void;
}) {
  return (
    <Card
      className={`animate-rise transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-lilac-100 ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
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
      <p className="mt-4 text-2xl font-bold tracking-tight text-stone-800">{value}</p>
      <p className="text-xs font-medium text-stone-500">{label}</p>
    </Card>
  );
}

export default function Dashboard({ go }: { go: (p: Page) => void }) {
  const {
    clients,
    themes,
    transactions,
    eventsList,
    inventoryItems,
    quotes,
    contracts,
    formSubmissions,
    companySettings,
  } = useStore();

  const safeTransactions = transactions || [];
  const safeEvents = eventsList || [];
  const safeItems = inventoryItems || [];

  const monthTx = safeTransactions.filter((t) => sameMonth(t.date));
  const entradas = monthTx.filter((t) => t.type === "entrada");
  const saidas = monthTx.filter((t) => t.type === "saida");
  const faturamento = entradas.filter((t) => t.status === "Pago").reduce((s, t) => s + t.amount, 0);
  const gastos = saidas.reduce((s, t) => s + t.amount, 0);
  const lucro = faturamento - gastos;

  const pendentes = safeTransactions
    .filter((t) => t.type === "entrada" && t.status === "Pendente")
    .reduce((s, t) => s + t.amount, 0);

  const atrasados = safeTransactions
    .filter((t) => t.type === "entrada" && t.status === "Atrasado")
    .reduce((s, t) => s + t.amount, 0);

  // Acervo stats
  const totalPecas = safeItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
  const pecasManutencao = safeItems.reduce((acc, it) => acc + (it.inMaintenance || 0), 0);
  const pecasDanificadas = safeItems.reduce((acc, it) => acc + (it.damaged || 0) + (it.lost || 0), 0);

  // Upcoming operations (next 7 days)
  const todayStr = new Date().toISOString().slice(0, 10);
  const next7DaysStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const upcomingEvents = safeEvents
    .filter((ev) => ev.date >= todayStr && ev.status !== "Cancelado")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const upcomingPickups = safeEvents
    .filter(
      (ev) =>
        (ev.pickupDate || ev.date) >= todayStr &&
        (ev.pickupDate || ev.date) <= next7DaysStr &&
        ev.status === "Confirmado"
    )
    .sort((a, b) => (a.pickupDate || a.date).localeCompare(b.pickupDate || b.date));

  const upcomingReturns = safeEvents
    .filter(
      (ev) =>
        (ev.returnDate || ev.date) >= todayStr &&
        (ev.returnDate || ev.date) <= next7DaysStr &&
        ev.status === "Retirado"
    )
    .sort((a, b) => (a.returnDate || a.date).localeCompare(b.returnDate || b.date));

  const contractsPendingSign = contracts.filter((c) => !c.signed);
  const contractsSigned = contracts.filter((c) => c.signed);
  const newFormSubmissions = (formSubmissions || []).filter((s) => s.status === "Novo");

  // 6-month chart data
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: monthName(d.getMonth()) };
  });

  const sumBy = (type: "entrada" | "saida", key: string) =>
    safeTransactions
      .filter((t) => {
        const d = new Date(t.date);
        return t.type === type && t.status === "Pago" && `${d.getFullYear()}-${d.getMonth()}` === key;
      })
      .reduce((s, t) => s + t.amount, 0);

  const inData = months.map((m) => sumBy("entrada", m.key));
  const outData = months.map((m) => sumBy("saida", m.key));
  const profitData = months.map((_, i) => inData[i] - outData[i]);

  const topThemes = [...themes]
    .sort((a, b) => b.rentals - a.rentals)
    .slice(0, 5)
    .map((t) => ({ label: t.name, value: t.rentals, emoji: t.photo }));

  return (
    <div className="space-y-6">
      <div className="animate-fade flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-lilac-500 uppercase tracking-wider">
            {companySettings.tradeName || "RAYDECOR"} • Pegue e Monte ✨
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-stone-800 sm:text-3xl">
            Painel Operacional & Financeiro
          </h1>
          <p className="mt-0.5 text-xs text-stone-500">
            Acompanhe o status do acervo, retiradas, devoluções e recebimentos em tempo real.
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => go("events")} variant="soft" className="!py-2 text-xs">
            📦 Retiradas & Devoluções
          </Button>
          <Button onClick={() => go("quotes")} className="!py-2 text-xs">
            <Icon.plus className="h-4 w-4" /> Novo Orçamento
          </Button>
        </div>
      </div>

      {/* Alerta de formulários recebidos (Requisito 14) */}
      {newFormSubmissions.length > 0 && (
        <div
          onClick={() => go("forms")}
          className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-200 cursor-pointer animate-rise transition hover:opacity-95"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">💌</span>
            <div>
              <p className="font-bold text-sm">
                Você recebeu {newFormSubmissions.length} novo(s) formulário(s) de cliente(s)!
              </p>
              <p className="text-xs text-white/80">
                Toque aqui para visualizar os dados e gerar os orçamentos.
              </p>
            </div>
          </div>
          <span className="rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold">Ver Formulários →</span>
        </div>
      )}

      {/* Main Financial Stats (Requisito 1 - Clicáveis) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ClickableStat
          label="Faturamento do Mês"
          value={brl(faturamento)}
          emoji="💰"
          trend="up"
          hint="Mês atual"
          onClick={() => go("finance")}
        />
        <ClickableStat
          label="Lucro do Mês"
          value={brl(lucro)}
          emoji="📈"
          trend={lucro >= 0 ? "up" : "down"}
          hint="Líquido"
          onClick={() => go("finance")}
        />
        <ClickableStat
          label="Gastos do Mês"
          value={brl(gastos)}
          emoji="🧾"
          onClick={() => go("finance")}
        />
        <ClickableStat
          label="Pagamentos Pendentes"
          value={brl(pendentes + atrasados)}
          emoji="⏳"
          hint={atrasados > 0 ? `${brl(atrasados)} atrasado` : undefined}
          trend={atrasados > 0 ? "down" : undefined}
          onClick={() => go("finance")}
        />
      </div>

      {/* Acervo & Operações Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ClickableStat
          label="Total Peças no Acervo"
          value={`${totalPecas} un.`}
          emoji="📦"
          hint={`${safeItems.length} tipos`}
          onClick={() => go("stock")}
        />
        <ClickableStat
          label="Peças em Manutenção"
          value={`${pecasManutencao} un.`}
          emoji="🔧"
          onClick={() => go("stock")}
        />
        <ClickableStat
          label="Peças Danificadas"
          value={`${pecasDanificadas} un.`}
          emoji="⚠️"
          onClick={() => go("stock")}
        />
        <ClickableStat
          label="Contratos Assinados"
          value={`${contractsSigned.length}`}
          emoji="✍️"
          hint={`${contractsPendingSign.length} pendentes`}
          onClick={() => go("contracts")}
        />
      </div>

      {/* Upcoming Operational Alerts (Retiradas e Devoluções Próximas) */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Retiradas Próximas */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle
              title="Retiradas Próximas (7 dias)"
              subtitle="Peças que os clientes devem vir retirar"
            />
            <span className="rounded-full bg-lilac-100 text-lilac-700 px-2 py-0.5 text-xs font-bold">
              {upcomingPickups.length}
            </span>
          </div>
          <div className="space-y-2">
            {upcomingPickups.map((ev) => (
              <div
                key={ev.id}
                onClick={() => go("events")}
                className="flex items-center justify-between p-3 rounded-2xl bg-white/60 border border-stone-100 text-xs hover:bg-white transition cursor-pointer"
              >
                <div>
                  <p className="font-bold text-stone-800">{ev.clientName}</p>
                  <p className="text-stone-500">
                    Tema: {ev.theme} • {fmtDate(ev.pickupDate || ev.date)} às{" "}
                    {ev.pickupTime || "09:00"}
                  </p>
                </div>
                <Badge color="amber">Aguardando Retirada</Badge>
              </div>
            ))}
            {upcomingPickups.length === 0 && (
              <p className="py-4 text-center text-xs text-stone-400">
                Nenhuma retirada agendada para os próximos 7 dias.
              </p>
            )}
          </div>
        </Card>

        {/* Devoluções Próximas */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle
              title="Devoluções Próximas (7 dias)"
              subtitle="Peças em uso com previsão de devolução"
            />
            <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-bold">
              {upcomingReturns.length}
            </span>
          </div>
          <div className="space-y-2">
            {upcomingReturns.map((ev) => (
              <div
                key={ev.id}
                onClick={() => go("events")}
                className="flex items-center justify-between p-3 rounded-2xl bg-white/60 border border-stone-100 text-xs hover:bg-white transition cursor-pointer"
              >
                <div>
                  <p className="font-bold text-stone-800">{ev.clientName}</p>
                  <p className="text-stone-500">
                    Tema: {ev.theme} • Previsto para {fmtDate(ev.returnDate || ev.date)}
                  </p>
                </div>
                <Badge color="lilac">Em Uso / Retirado</Badge>
              </div>
            ))}
            {upcomingReturns.length === 0 && (
              <p className="py-4 text-center text-xs text-stone-400">
                Nenhuma devolução pendente para os próximos 7 dias.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Entradas x Saídas" subtitle="Histórico dos últimos 6 meses" />
          <DualLineChart
            labels={months.map((m) => m.label)}
            series={[
              { name: "Entradas", color: "#ec4899", data: inData },
              { name: "Saídas", color: "#9ca3af", data: outData },
            ]}
          />
        </Card>
        <Card>
          <div className="flex items-center justify-between mb-2">
            <SectionTitle title="Temas Mais Alugados" />
            <button
              onClick={() => go("inventory")}
              className="text-xs font-semibold text-pink-600 hover:text-pink-800 transition"
            >
              Ver Acervo →
            </button>
          </div>
          <HBars data={topThemes} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Lucro Líquido Mensal" subtitle="Resultado financeiro por mês" />
          <BarChart
            data={months.map((m, i) => ({ label: m.label, value: Math.max(profitData[i], 0) }))}
            color="#db2777"
          />
        </Card>
        <Card>
          <SectionTitle title="Próximas Festas" subtitle="Cronograma de eventos" />
          <div className="space-y-3">
            {upcomingEvents.map((e) => (
              <div
                key={e.id}
                onClick={() => go("events")}
                className="flex items-center gap-3 rounded-2xl bg-white/60 p-3 hover:bg-white transition cursor-pointer"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-pink-100 text-lg">
                  🎈
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-700">{e.theme}</p>
                  <p className="truncate text-xs text-stone-500">{e.clientName}</p>
                </div>
                <Badge color="lilac">{fmtDate(e.date)}</Badge>
              </div>
            ))}
            {upcomingEvents.length === 0 && (
              <p className="text-xs text-stone-400 py-4 text-center">Sem festas agendadas.</p>
            )}
            <Button variant="soft" className="w-full text-xs" onClick={() => go("calendar")}>
              Ver Calendário Completo
            </Button>
          </div>
        </Card>
      </div>

      <p className="pb-2 text-center text-xs text-stone-400">
        Total recebido acumulado:{" "}
        {brlShort(
          safeTransactions
            .filter((t) => t.type === "entrada" && t.status === "Pago")
            .reduce((s, t) => s + t.amount, 0)
        )}{" "}
        • {companySettings.tradeName || "RAYDECOR"} Pegue e Monte 💕
      </p>
    </div>
  );
}
