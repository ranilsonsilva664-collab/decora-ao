import { useState, useMemo } from "react";
import { useStore } from "../lib/store";
import { brl, fmtDate, uid, sameMonth } from "../lib/format";
import { waLink } from "../lib/helpers";
import { useToast } from "./Toast";
import { Icon } from "./icons";
import type { Transaction } from "../lib/types";

export interface PendingPartyReminderItem {
  key: string;
  transactionId?: string;
  contractId?: string;
  clientId?: string;
  clientName: string;
  whatsapp?: string;
  theme: string;
  partyDate: string;
  isToday: boolean;
  isPast: boolean;
  isUpcoming: boolean;
  depositPaid: number;
  remainingAmount: number;
  method?: string;
}

export function PartyPaymentReminder() {
  const {
    transactions,
    contracts,
    clients,
    updateMultipleFields,
    logAction,
  } = useStore();
  const toast = useToast();
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);
  const [selectedMethods, setSelectedMethods] = useState<Record<string, string>>({});
  const [showUpcomingList, setShowUpcomingList] = useState(true);

  const todayStr = new Date().toISOString().slice(0, 10);
  const safeTransactions = transactions || [];
  const safeContracts = contracts || [];

  // Calcula quanto já entrou no mês atual para exibir na confirmação
  const monthReceivedTotal = useMemo(() => {
    return safeTransactions
      .filter((t) => t.type === "entrada" && t.status === "Pago" && sameMonth(t.date))
      .reduce((acc, t) => acc + (t.amount || 0), 0);
  }, [safeTransactions]);

  // Identifica todas as festas com saldo em aberto (tanto de hoje, vencidas, quanto próximas)
  const allReminders = useMemo(() => {
    const items: PendingPartyReminderItem[] = [];
    const handledContractIds = new Set<string>();

    // 1. Verifica transações pendentes (Falta Pagar)
    safeTransactions.forEach((tx) => {
      if (tx.type !== "entrada" || tx.status === "Pago") return;
      const targetPartyDate = tx.partyDate || tx.date;
      if (!targetPartyDate) return;

      const linkedContract = tx.contractId
        ? safeContracts.find((c) => c.id === tx.contractId)
        : undefined;
      if (tx.contractId) handledContractIds.add(tx.contractId);

      const clientName = tx.client || linkedContract?.clientName || "Cliente";
      const matchedClient = clients.find(
        (cl) =>
          (tx.clientId && cl.id === tx.clientId) ||
          cl.name.trim().toLowerCase() === clientName.trim().toLowerCase()
      );

      const sinalTx = tx.contractId
        ? safeTransactions.find(
            (s) =>
              s.type === "entrada" &&
              s.contractId === tx.contractId &&
              (s.paymentPart === "sinal" || s.category === "Sinal de Reserva")
          )
        : undefined;

      const isToday = targetPartyDate === todayStr;
      const isPast = targetPartyDate < todayStr;
      const isUpcoming = targetPartyDate > todayStr;

      items.push({
        key: `tx-${tx.id}`,
        transactionId: tx.id,
        contractId: tx.contractId,
        clientId: tx.clientId || matchedClient?.id,
        clientName,
        whatsapp:
          linkedContract?.whatsapp ||
          linkedContract?.clientPhone ||
          matchedClient?.whatsapp ||
          matchedClient?.phone ||
          "",
        theme: linkedContract?.theme || tx.description.replace(/^.*—\s*/, "").replace(/\s*\(.*\)$/, "") || "Decoração",
        partyDate: targetPartyDate,
        isToday,
        isPast,
        isUpcoming,
        depositPaid: sinalTx ? sinalTx.amount : linkedContract?.deposit || 0,
        remainingAmount: tx.amount,
        method: tx.method || "Pix",
      });
    });

    // 2. Verifica contratos que tenham saldo restante e ainda não tenham transação quitada
    safeContracts.forEach((c) => {
      if (!c.partyDate) return;
      if (c.status === "Cancelado" || c.paymentRemainderConfirmed) return;
      if (handledContractIds.has(c.id)) return;

      const remaining = Math.max(0, (c.value || 0) - (c.deposit || 0));
      if (remaining <= 0) return;

      const alreadyPaidTx = safeTransactions.some(
        (t) =>
          t.type === "entrada" &&
          t.contractId === c.id &&
          t.paymentPart === "restante" &&
          t.status === "Pago"
      );
      if (alreadyPaidTx) return;

      const matchedClient = clients.find(
        (cl) =>
          (c.clientId && cl.id === c.clientId) ||
          cl.name.trim().toLowerCase() === c.clientName.trim().toLowerCase()
      );

      const isToday = c.partyDate === todayStr;
      const isPast = c.partyDate < todayStr;
      const isUpcoming = c.partyDate > todayStr;

      items.push({
        key: `contract-${c.id}`,
        contractId: c.id,
        clientId: c.clientId || matchedClient?.id,
        clientName: c.clientName,
        whatsapp: c.whatsapp || c.clientPhone || matchedClient?.whatsapp || matchedClient?.phone || "",
        theme: c.theme || "Decoração Pegue e Monte",
        partyDate: c.partyDate,
        isToday,
        isPast,
        isUpcoming,
        depositPaid: c.deposit || 0,
        remainingAmount: remaining,
        method: "Pix",
      });
    });

    return items.filter((it) => !dismissedKeys.includes(it.key));
  }, [safeTransactions, safeContracts, clients, todayStr, dismissedKeys]);

  // Festas de hoje ou atrasadas (urgentes de cobrança)
  const urgentReminders = useMemo(() => {
    return allReminders
      .filter((it) => it.isToday || it.isPast)
      .sort((a, b) => (a.isToday === b.isToday ? b.partyDate.localeCompare(a.partyDate) : a.isToday ? -1 : 1));
  }, [allReminders]);

  // Próximas festas agendadas (valores futuros em aberto)
  const upcomingReminders = useMemo(() => {
    return allReminders
      .filter((it) => it.isUpcoming)
      .sort((a, b) => a.partyDate.localeCompare(b.partyDate));
  }, [allReminders]);

  const totalUpcomingAmount = useMemo(() => {
    return upcomingReminders.reduce((acc, it) => acc + it.remainingAmount, 0);
  }, [upcomingReminders]);

  if (allReminders.length === 0) return null;

  const confirmReceived = async (item: PendingPartyReminderItem) => {
    const chosenMethod = selectedMethods[item.key] || item.method || "Pix";
    let updatedTransactions = [...safeTransactions];

    if (item.transactionId) {
      updatedTransactions = updatedTransactions.map((t) =>
        t.id === item.transactionId
          ? {
              ...t,
              status: "Pago" as const,
              date: todayStr, // Data de hoje para contabilizar automaticamente nas entradas do mês atual!
              method: chosenMethod,
              description: `Restante Recebido (Festa) — ${item.theme} (${item.clientName})`,
            }
          : t
      );
    } else {
      const newPaidTx: Transaction = {
        id: uid(),
        type: "entrada",
        description: `Restante Recebido (Festa) — ${item.theme} (${item.clientName})`,
        category: "Locação Pegue e Monte",
        clientId: item.clientId || "",
        client: item.clientName,
        contractId: item.contractId || "",
        paymentPart: "restante",
        partyDate: item.partyDate,
        amount: item.remainingAmount,
        date: todayStr, // Gera automaticamente na entrada do mês atual
        method: chosenMethod,
        status: "Pago",
      };
      updatedTransactions = [newPaidTx, ...updatedTransactions];
    }

    const payload: Record<string, any> = {
      transactions: updatedTransactions,
    };

    if (item.contractId) {
      payload.contracts = safeContracts.map((c) =>
        c.id === item.contractId ? { ...c, paymentRemainderConfirmed: true } : c
      );
    }

    await updateMultipleFields(payload);

    const newMonthTotal = monthReceivedTotal + item.remainingAmount;

    logAction(
      "Valor em Aberto Recebido",
      `Confirmado recebimento de ${brl(item.remainingAmount)} de ${item.clientName} (${item.theme}). Total de entradas no mês: ${brl(newMonthTotal)}`
    );

    toast(
      `✅ Recebimento de ${brl(item.remainingAmount)} confirmado! Entrou automaticamente no faturamento do mês (Total no mês: ${brl(newMonthTotal)})!`
    );
  };

  const getDaysDiffLabel = (dateStr: string) => {
    const dParty = new Date(dateStr + "T00:00:00");
    const dToday = new Date(todayStr + "T00:00:00");
    const diffDays = Math.round((dParty.getTime() - dToday.getTime()) / 86400000);
    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Amanhã";
    if (diffDays > 1) return `Em ${diffDays} dias`;
    return `${Math.abs(diffDays)} dias atrás`;
  };

  return (
    <div className="space-y-3 mb-6">
      {/* 1. LEMBRETES URGENTES: HOJE É O DIA DA FESTA OU SALDO VENCIDO */}
      {urgentReminders.map((item) => {
        const currentMethod = selectedMethods[item.key] || item.method || "Pix";
        return (
          <div
            key={item.key}
            className="animate-rise relative overflow-hidden rounded-3xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/90 to-pink-50 p-4 sm:p-5 shadow-lg shadow-amber-200/40"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-2xl text-white shadow-md shadow-amber-200">
                  🎉
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                      {item.isToday ? "🔔 HOJE É O DIA DA FESTA!" : `🔔 FESTA EM ${fmtDate(item.partyDate)} (SALDO PENDENTE)`}
                    </span>
                    <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                      Falta Pagar: {brl(item.remainingAmount)}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-extrabold text-stone-800">
                    Você já recebeu o valor em aberto de{" "}
                    <span className="text-rose-600 underline decoration-rose-300">
                      {brl(item.remainingAmount)}
                    </span>{" "}
                    da cliente {item.clientName}?
                  </h3>

                  <p className="text-xs text-stone-600">
                    🎈 <b>Tema:</b> {item.theme} • 🗓️ <b>Festa:</b> {fmtDate(item.partyDate)} •{" "}
                    <span className="text-emerald-700 font-semibold">
                      Sinal já pago: {brl(item.depositPaid)}
                    </span>{" "}
                    •{" "}
                    <span className="text-amber-800 font-bold">
                      Em aberto: {brl(item.remainingAmount)}
                    </span>
                  </p>
                  <p className="text-[11px] text-stone-500">
                    💡 Ao confirmar, o sistema muda de <b>Falta Pagar</b> para <b>Pago</b> e já soma{" "}
                    <b>+{brl(item.remainingAmount)}</b> automaticamente no faturamento deste mês!
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-amber-200/60">
                <select
                  value={currentMethod}
                  onChange={(e) =>
                    setSelectedMethods((prev) => ({ ...prev, [item.key]: e.target.value }))
                  }
                  className="rounded-xl border border-amber-300 bg-white px-2.5 py-2 text-xs font-bold text-stone-700 outline-none focus:ring-2 focus:ring-amber-400"
                  title="Forma de recebimento"
                >
                  <option value="Pix">Pix</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão de Crédito">Cartão Crédito</option>
                  <option value="Cartão de Débito">Cartão Débito</option>
                  <option value="Transferência">Transferência</option>
                </select>

                <button
                  onClick={() => confirmReceived(item)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-emerald-200 hover:opacity-95 transition active:scale-95 cursor-pointer"
                >
                  <span>✅</span> Sim, Já Recebi! (+{brl(item.remainingAmount)} no mês)
                </button>

                {item.whatsapp && (
                  <a
                    href={waLink(
                      item.whatsapp,
                      `Olá ${item.clientName}! 💕 Tudo pronto para a sua festa (${item.theme})! Passando para lembrar do saldo restante da decoração no valor de *${brl(
                        item.remainingAmount
                      )}*. Qualquer dúvida estou à disposição!`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1 rounded-2xl bg-white border border-emerald-200 px-3 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition"
                    title="Enviar lembrete amigável no WhatsApp da cliente"
                  >
                    <Icon.wa className="h-3.5 w-3.5" /> Cobrar
                  </a>
                )}

                <button
                  onClick={() => setDismissedKeys((prev) => [...prev, item.key])}
                  className="rounded-xl bg-white/70 px-2.5 py-2 text-[11px] font-semibold text-stone-500 hover:bg-white hover:text-stone-700 transition"
                  title="Lembrar mais tarde"
                >
                  Ainda não
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* 2. NOTIFICAÇÕES DE VALORES DAS PRÓXIMAS FESTAS AGENDADAS */}
      {upcomingReminders.length > 0 && (
        <div className="rounded-3xl border border-pink-200/80 bg-white/95 backdrop-blur-xl p-4 sm:p-5 shadow-md shadow-pink-100/50 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 text-white text-base shadow-sm">
                🔔
              </span>
              <div>
                <h3 className="text-sm font-black text-stone-800 flex items-center gap-2">
                  Notificações de Valores em Aberto (Próximas Festas)
                  <span className="rounded-full bg-pink-100 text-pink-700 px-2 py-0.5 text-[10px] font-bold">
                    {upcomingReminders.length} {upcomingReminders.length === 1 ? "festa" : "festas"}
                  </span>
                </h3>
                <p className="text-xs text-stone-500">
                  Total previsto a receber:{" "}
                  <b className="text-pink-600 font-extrabold">{brl(totalUpcomingAmount)}</b>
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowUpcomingList(!showUpcomingList)}
              className="text-xs font-bold text-pink-600 hover:text-pink-700 transition flex items-center gap-1 self-start sm:self-auto"
            >
              {showUpcomingList ? "Ocultar detalhes ▲" : "Ver lista de valores ▼"}
            </button>
          </div>

          {showUpcomingList && (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 pt-1">
              {upcomingReminders.map((it) => (
                <div
                  key={it.key}
                  className="rounded-2xl border border-stone-100 bg-stone-50/70 p-3 flex flex-col justify-between gap-2 hover:bg-stone-50 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1 text-[11px]">
                      <span className="font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100">
                        🗓️ {fmtDate(it.partyDate)} ({getDaysDiffLabel(it.partyDate)})
                      </span>
                      <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                        Falta: {brl(it.remainingAmount)}
                      </span>
                    </div>

                    <p className="font-bold text-stone-800 text-xs truncate mt-1">
                      {it.clientName}
                    </p>
                    <p className="text-[11px] text-stone-500 truncate">
                      Tema: <b>{it.theme}</b> • Sinal pago: {brl(it.depositPaid)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-stone-200/60">
                    <button
                      onClick={() => confirmReceived(it)}
                      className="flex-1 rounded-xl bg-emerald-500 py-1.5 px-2 text-[11px] font-bold text-white shadow-xs hover:bg-emerald-600 transition"
                      title="Dar baixa no valor se já recebeu antecipado"
                    >
                      ✅ Já Recebi
                    </button>

                    {it.whatsapp && (
                      <a
                        href={waLink(
                          it.whatsapp,
                          `Olá ${it.clientName}! 💕 Tudo bem? Estamos preparando tudo para o tema *${it.theme}* no dia *${fmtDate(
                            it.partyDate
                          )}*! Passando apenas para confirmar a reserva e lembrar do saldo restante de *${brl(
                            it.remainingAmount
                          )}*. Qualquer dúvida estou à disposição!`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-white border border-emerald-200 p-1.5 text-emerald-600 hover:bg-emerald-50 transition flex items-center justify-center"
                        title="Enviar lembrete de saldo no WhatsApp"
                      >
                        <Icon.wa className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

