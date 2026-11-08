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
  depositPaid: number;
  remainingAmount: number;
  method?: string;
}

export function PartyPaymentReminder() {
  const {
    transactions,
    setTransactions,
    contracts,
    setContracts,
    clients,
    logAction,
  } = useStore();
  const toast = useToast();
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);
  const [selectedMethods, setSelectedMethods] = useState<Record<string, string>>({});

  const todayStr = new Date().toISOString().slice(0, 10);
  const safeTransactions = transactions || [];
  const safeContracts = contracts || [];

  // Calcula quanto já entrou no mês atual para exibir na confirmação
  const monthReceivedTotal = useMemo(() => {
    return safeTransactions
      .filter((t) => t.type === "entrada" && t.status === "Pago" && sameMonth(t.date))
      .reduce((acc, t) => acc + (t.amount || 0), 0);
  }, [safeTransactions]);

  // Identifica festas agendadas para hoje (ou cuja data já chegou) que possuem valor em aberto ("Falta Pagar")
  const pendingReminders = useMemo(() => {
    const items: PendingPartyReminderItem[] = [];
    const handledContractIds = new Set<string>();

    // 1. Verifica transações pendentes (Falta Pagar) cuja data da festa é hoje ou já chegou
    safeTransactions.forEach((tx) => {
      if (tx.type !== "entrada" || tx.status === "Pago") return;
      const targetPartyDate = tx.partyDate || tx.date;
      if (!targetPartyDate || targetPartyDate > todayStr) return;

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
        isToday: targetPartyDate === todayStr,
        depositPaid: sinalTx ? sinalTx.amount : linkedContract?.deposit || 0,
        remainingAmount: tx.amount,
        method: tx.method || "Pix",
      });
    });

    // 2. Verifica contratos agendados para hoje (ou data já chegada) que tenham saldo restante e ainda não tenham transação quitada
    safeContracts.forEach((c) => {
      if (!c.partyDate || c.partyDate > todayStr) return;
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

      items.push({
        key: `contract-${c.id}`,
        contractId: c.id,
        clientId: c.clientId || matchedClient?.id,
        clientName: c.clientName,
        whatsapp: c.whatsapp || c.clientPhone || matchedClient?.whatsapp || matchedClient?.phone || "",
        theme: c.theme || "Decoração Pegue e Monte",
        partyDate: c.partyDate,
        isToday: c.partyDate === todayStr,
        depositPaid: c.deposit || 0,
        remainingAmount: remaining,
        method: "Pix",
      });
    });

    // Ordena priorizando as festas de HOJE primeiro
    return items
      .filter((it) => !dismissedKeys.includes(it.key))
      .sort((a, b) => (a.isToday === b.isToday ? b.partyDate.localeCompare(a.partyDate) : a.isToday ? -1 : 1));
  }, [safeTransactions, safeContracts, clients, todayStr, dismissedKeys]);

  if (pendingReminders.length === 0) return null;

  const confirmReceived = (item: PendingPartyReminderItem) => {
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

    setTransactions(updatedTransactions);

    if (item.contractId) {
      setContracts(
        safeContracts.map((c) =>
          c.id === item.contractId ? { ...c, paymentRemainderConfirmed: true } : c
        )
      );
    }

    const newMonthTotal = monthReceivedTotal + item.remainingAmount;

    logAction(
      "Valor em Aberto Recebido no Dia da Festa",
      `Confirmado recebimento de ${brl(item.remainingAmount)} de ${item.clientName} (${item.theme}). Total de entradas no mês: ${brl(newMonthTotal)}`
    );

    toast(
      `✅ Recebimento de ${brl(item.remainingAmount)} confirmado! Entrou automaticamente no faturamento do mês (Total no mês: ${brl(newMonthTotal)})!`
    );
  };

  return (
    <div className="space-y-3 mb-5">
      {pendingReminders.map((item) => {
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
                      {item.isToday ? "🔔 HOJE É O DIA DA FESTA!" : `🔔 LEMBRETE DE FESTA (${fmtDate(item.partyDate)})`}
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
                    <b>+{brl(item.remainingAmount)}</b> automaticamente nas entradas deste mês!
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
                      `Olá ${item.clientName}! 💕 Tudo pronto para a festa de hoje (${item.theme})! Passando para lembrar do saldo restante da decoração no valor de *${brl(
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
    </div>
  );
}

