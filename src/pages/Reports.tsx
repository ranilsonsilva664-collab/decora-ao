import { useState, useMemo } from "react";
import { Card, SectionTitle, Button, Badge } from "../components/ui";
import { useStore } from "../lib/store";
import { brl, fmtDate } from "../lib/format";
import { Icon } from "../components/icons";

export default function Reports() {
  const { transactions, inventoryItems, kits, eventsList, clients } = useStore();

  const [period, setPeriod] = useState<"all" | "month" | "year">("all");

  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentYearPrefix = `${now.getFullYear()}`;

  // Filter transactions by period
  const filteredTx = useMemo(() => {
    return transactions.filter((t) => {
      if (period === "month") return t.date.startsWith(currentMonthPrefix);
      if (period === "year") return t.date.startsWith(currentYearPrefix);
      return true;
    });
  }, [transactions, period, currentMonthPrefix, currentYearPrefix]);

  const faturamento = filteredTx
    .filter((t) => t.type === "entrada" && t.status === "Pago")
    .reduce((s, t) => s + t.amount, 0);

  const despesas = filteredTx.filter((t) => t.type === "saida").reduce((s, t) => s + t.amount, 0);
  const lucro = faturamento - despesas;

  // Most rented items ranking
  const itemRentalStats = useMemo(() => {
    const stats: Record<string, { name: string; count: number; totalRev: number }> = {};

    for (const ev of eventsList || []) {
      if (ev.status === "Cancelado") continue;
      for (const it of ev.items || []) {
        if (it.type === "item") {
          if (!stats[it.id]) {
            stats[it.id] = { name: it.name, count: 0, totalRev: 0 };
          }
          stats[it.id].count += it.quantity;
          stats[it.id].totalRev += it.subtotal || 0;
        }
      }
    }

    return Object.entries(stats)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [eventsList]);

  // Idle / least used items
  const idleItems = useMemo(() => {
    const rentedIds = new Set(itemRentalStats.map((s) => s.id));
    return inventoryItems.filter((it) => !rentedIds.has(it.id));
  }, [inventoryItems, itemRentalStats]);

  // Items currently damaged or in maintenance
  const damagedOrMaintenance = useMemo(() => {
    return inventoryItems.filter(
      (it) => (it.inMaintenance || 0) > 0 || (it.damaged || 0) > 0 || (it.lost || 0) > 0
    );
  }, [inventoryItems]);

  // Recurrent clients (more than 1 event)
  const recurrentClients = useMemo(() => {
    const clientEventCounts: Record<string, number> = {};
    for (const ev of eventsList || []) {
      const name = ev.clientName;
      clientEventCounts[name] = (clientEventCounts[name] || 0) + 1;
    }

    return Object.entries(clientEventCounts)
      .filter(([_, count]) => count > 1)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [eventsList]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Relatórios e Indicadores Gerenciais"
        subtitle="Métricas operacionais e financeiras reais para tomada de decisão"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setPeriod("month")}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                period === "month" ? "bg-lilac-500 text-white" : "bg-white/70 text-stone-600"
              }`}
            >
              Este Mês
            </button>
            <button
              onClick={() => setPeriod("year")}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                period === "year" ? "bg-lilac-500 text-white" : "bg-white/70 text-stone-600"
              }`}
            >
              Este Ano
            </button>
            <button
              onClick={() => setPeriod("all")}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                period === "all" ? "bg-lilac-500 text-white" : "bg-white/70 text-stone-600"
              }`}
            >
              Todo o Período
            </button>
          </div>
        }
      />

      {/* Financial Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="!p-5">
          <p className="text-xs font-semibold text-stone-500">Faturamento Real ({period})</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{brl(faturamento)}</p>
          <p className="text-[11px] text-stone-400 mt-1">Total de locações recebidas</p>
        </Card>
        <Card className="!p-5">
          <p className="text-xs font-semibold text-stone-500">Despesas e Compras ({period})</p>
          <p className="mt-2 text-2xl font-bold text-rose-500">{brl(despesas)}</p>
          <p className="text-[11px] text-stone-400 mt-1">Gastos operacionais</p>
        </Card>
        <Card className="!p-5">
          <p className="text-xs font-semibold text-stone-500">Resultado Líquido ({period})</p>
          <p
            className={`mt-2 text-2xl font-bold ${
              lucro >= 0 ? "text-stone-800" : "text-rose-600"
            }`}
          >
            {brl(lucro)}
          </p>
          <p className="text-[11px] text-stone-400 mt-1">Lucro no período</p>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Most Rented Items */}
        <Card>
          <SectionTitle
            title="Peças Mais Alugadas"
            subtitle="Itens com maior giro no seu Pegue e Monte"
          />
          <div className="space-y-2 mt-3">
            {itemRentalStats.slice(0, 7).map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/60 border border-stone-100 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-lilac-100 text-lilac-700 font-bold text-[10px]">
                    {idx + 1}º
                  </span>
                  <span className="font-semibold text-stone-800">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-lilac-600">{item.count} locações</span>
                  <span className="block text-[10px] text-stone-400">{brl(item.totalRev)}</span>
                </div>
              </div>
            ))}
            {itemRentalStats.length === 0 && (
              <p className="py-6 text-center text-xs text-stone-400">
                Ainda não há dados suficientes de locações.
              </p>
            )}
          </div>
        </Card>

        {/* Recurrent Clients */}
        <Card>
          <SectionTitle
            title="Clientes Recorrentes"
            subtitle="Clientes fiéis que realizaram mais de uma festa"
          />
          <div className="space-y-2 mt-3">
            {recurrentClients.map((c, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/60 border border-stone-100 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">👑</span>
                  <span className="font-semibold text-stone-800">{c.name}</span>
                </div>
                <Badge color="green">{c.count} festas realizadas</Badge>
              </div>
            ))}
            {recurrentClients.length === 0 && (
              <p className="py-6 text-center text-xs text-stone-400">
                Ainda não há clientes com mais de 1 festa registrada.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Damaged and in maintenance */}
        <Card>
          <SectionTitle
            title="Avarias e Manutenção"
            subtitle="Peças fora de circulação ou que necessitam de reparo"
          />
          <div className="space-y-2 mt-3">
            {damagedOrMaintenance.map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/60 border border-stone-100 text-xs"
              >
                <div>
                  <p className="font-semibold text-stone-800">{it.name}</p>
                  <p className="text-[10px] text-stone-400">Estoque total: {it.quantity} un.</p>
                </div>
                <div className="flex gap-1.5">
                  {(it.inMaintenance || 0) > 0 && (
                    <span className="rounded-md bg-amber-50 text-amber-600 px-2 py-0.5 text-[10px] font-bold">
                      {it.inMaintenance} manutenção
                    </span>
                  )}
                  {(it.damaged || 0) > 0 && (
                    <span className="rounded-md bg-rose-50 text-rose-600 px-2 py-0.5 text-[10px] font-bold">
                      {it.damaged} danificado
                    </span>
                  )}
                  {(it.lost || 0) > 0 && (
                    <span className="rounded-md bg-stone-100 text-stone-600 px-2 py-0.5 text-[10px] font-bold">
                      {it.lost} perdido
                    </span>
                  )}
                </div>
              </div>
            ))}
            {damagedOrMaintenance.length === 0 && (
              <p className="py-6 text-center text-xs text-stone-400">
                🎉 Nenhuma peça em manutenção ou danificada no momento!
              </p>
            )}
          </div>
        </Card>

        {/* Idle / Low usage pieces */}
        <Card>
          <SectionTitle
            title="Peças Ociosas / Pouco Utilizadas"
            subtitle="Itens do acervo que ainda não foram alugados"
          />
          <div className="space-y-2 mt-3 max-h-72 overflow-y-auto">
            {idleItems.slice(0, 10).map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/60 border border-stone-100 text-xs"
              >
                <div>
                  <p className="font-semibold text-stone-800">{it.name}</p>
                  <p className="text-[10px] text-stone-400">{it.category || "Geral"}</p>
                </div>
                <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500 font-semibold">
                  0 locações
                </span>
              </div>
            ))}
            {idleItems.length === 0 && (
              <p className="py-6 text-center text-xs text-stone-400">
                Todas as peças do acervo já foram alugadas pelo menos uma vez!
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
