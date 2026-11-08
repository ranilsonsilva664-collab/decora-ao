import type { Contract, Transaction, Client, PublicFormSubmission, EventModel } from "./types";
import { uid } from "./format";

/**
 * Recursively sanitizes any data before saving to Firestore.
 * - Strips all `undefined` values so Firestore setDoc / updateDoc never rejects
 * - Ensures arrays contain no undefined elements
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) return null as unknown as T;
  if (data === null || typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result as T;
}

/**
 * Guarantees a Contract object is always complete with no undefined fields,
 * preventing any Firestore write failure and ensuring reliable public signing.
 */
export function sanitizeContract(c: Partial<Contract>): Contract {
  const nowStr = new Date().toISOString().slice(0, 10);
  return {
    id: (c.id || Math.random().toString(36).slice(2, 10)).trim(),
    clientId: c.clientId || "",
    clientName: (c.clientName || "").trim(),
    whatsapp: (c.whatsapp || c.clientPhone || "").trim(),
    clientPhone: (c.clientPhone || c.whatsapp || "").trim(),
    cpf: (c.cpf || "").trim(),
    email: (c.email || "").trim(),
    cep: (c.cep || "").trim(),
    address: (c.address || "").trim(),
    number: (c.number || "").trim(),
    complement: (c.complement || "").trim(),
    neighborhood: (c.neighborhood || "").trim(),
    city: (c.city || "").trim(),
    state: (c.state || "").trim(),
    quoteId: c.quoteId || "",
    eventId: c.eventId || "",
    eventType: (c.eventType || "").trim(),
    birthdayPerson: (c.birthdayPerson || "").trim(),
    age: (c.age || "").trim(),
    partyDate: c.partyDate || nowStr,
    partyTime: (c.partyTime || "").trim(),
    partyLocation: (c.partyLocation || "").trim(),
    notes: (c.notes || "").trim(),
    theme: (c.theme || "").trim(),
    items: Array.isArray(c.items) ? c.items : [],
    value: Number(c.value) || 0,
    deposit: Number(c.deposit) || 0,
    delivery: Number(c.delivery) || 0,
    assembly: Number(c.assembly) || 0,
    discount: Number(c.discount) || 0,
    pickupDate: c.pickupDate || c.partyDate || nowStr,
    pickupTime: c.pickupTime || "09:00",
    returnDate: c.returnDate || c.partyDate || nowStr,
    returnTime: c.returnTime || "12:00",
    signed: Boolean(c.signed),
    signature: (c.signature || "").trim(),
    signatureImage: c.signatureImage || "",
    signedAt: c.signedAt || "",
    signerIp: c.signerIp || "",
    status: c.status || "Pendente",
    paymentRemainderConfirmed: Boolean(c.paymentRemainderConfirmed),
    createdAt: c.createdAt || nowStr,
    customTerms: c.customTerms || "",
  };
}

/**
 * Enriches a Contract with all available Client, PublicFormSubmission, and EventModel data
 * so that the PDF always displays 100% of the client's info (from WhatsApp to party address).
 */
export function enrichContractData(
  contract: Contract,
  clients: Client[] = [],
  formSubmissions: PublicFormSubmission[] = [],
  eventsList: EventModel[] = []
): Contract {
  const cleanName = (contract.clientName || "").trim().toLowerCase();
  const cleanCpf = (contract.cpf || "").replace(/\D/g, "");

  const matchedClient = clients.find(
    (cl) =>
      (contract.clientId && cl.id === contract.clientId) ||
      (cleanCpf && cl.cpf && cl.cpf.replace(/\D/g, "") === cleanCpf) ||
      (cleanName && cl.name.trim().toLowerCase() === cleanName)
  );

  const matchedSub = formSubmissions.find(
    (s) =>
      (s.contractId && s.contractId === contract.id) ||
      (contract.clientId && s.clientId === contract.clientId) ||
      (cleanCpf && s.cpf && s.cpf.replace(/\D/g, "") === cleanCpf) ||
      (cleanName && s.clientName.trim().toLowerCase() === cleanName)
  );

  const matchedEvent = eventsList.find(
    (ev) =>
      (contract.eventId && ev.id === contract.eventId) ||
      (contract.id && ev.contractId === contract.id) ||
      (cleanName &&
        ev.clientName.trim().toLowerCase() === cleanName &&
        ev.date === contract.partyDate)
  );

  const fallbackAddressParts = [
    contract.address || matchedSub?.address || matchedClient?.address || "",
    contract.number || matchedSub?.number || matchedClient?.number
      ? `nº ${contract.number || matchedSub?.number || matchedClient?.number}`
      : "",
    contract.complement || matchedSub?.complement || matchedClient?.complement || "",
    contract.neighborhood || matchedSub?.neighborhood || matchedClient?.neighborhood || "",
    contract.city || matchedSub?.city || matchedClient?.city || "",
    contract.state || matchedSub?.state || matchedClient?.state || "",
  ]
    .filter(Boolean)
    .join(", ");

  return sanitizeContract({
    ...contract,
    clientId: contract.clientId || matchedClient?.id || matchedSub?.clientId || "",
    whatsapp:
      contract.whatsapp ||
      contract.clientPhone ||
      matchedSub?.whatsapp ||
      matchedClient?.whatsapp ||
      matchedClient?.phone ||
      "",
    clientPhone:
      contract.clientPhone ||
      contract.whatsapp ||
      matchedSub?.whatsapp ||
      matchedClient?.phone ||
      matchedClient?.whatsapp ||
      "",
    cpf: contract.cpf || matchedSub?.cpf || matchedClient?.cpf || "",
    email: contract.email || matchedSub?.email || matchedClient?.email || "",
    cep: contract.cep || matchedSub?.cep || matchedClient?.cep || "",
    address: contract.address || matchedSub?.address || matchedClient?.address || "",
    number: contract.number || matchedSub?.number || matchedClient?.number || "",
    complement: contract.complement || matchedSub?.complement || matchedClient?.complement || "",
    neighborhood:
      contract.neighborhood || matchedSub?.neighborhood || matchedClient?.neighborhood || "",
    city: contract.city || matchedSub?.city || matchedClient?.city || "",
    state: contract.state || matchedSub?.state || matchedClient?.state || "",
    eventType: contract.eventType || matchedSub?.eventType || matchedEvent?.type || "Festa / Evento",
    birthdayPerson:
      contract.birthdayPerson || matchedSub?.birthdayPerson || matchedEvent?.birthdayPerson || "",
    age: contract.age || matchedSub?.age || matchedEvent?.age || matchedClient?.age || "",
    partyTime: contract.partyTime || matchedSub?.eventTime || matchedEvent?.time || "14:00",
    partyLocation:
      contract.partyLocation ||
      matchedSub?.eventLocation ||
      matchedEvent?.location ||
      fallbackAddressParts ||
      "",
    notes: contract.notes || matchedSub?.notes || matchedEvent?.notes || matchedClient?.notes || "",
  });
}

/**
 * Synchronizes a closed decoration (Contract/Quote) with the financial transactions list:
 * - Sinal (deposit) -> status "Pago" (paid today so it counts in current month's entries)
 * - Valor em Aberto (value - deposit) -> status "Pendente" ("Falta Pagar"), scheduled for partyDate
 */
export function syncContractFinancials(
  contract: Contract,
  existingTransactions: Transaction[],
  paymentMethod = "Pix"
): Transaction[] {
  const safeList = [...(existingTransactions || [])];
  const total = Math.max(0, Number(contract.value) || 0);
  const deposit = Math.max(0, Number(contract.deposit) || 0);
  const remaining = Math.max(0, total - deposit);
  const todayStr = new Date().toISOString().slice(0, 10);

  if (total <= 0 && deposit <= 0) {
    return safeList;
  }

  // Find existing Sinal transaction for this contract/quote
  const sinalIdx = safeList.findIndex(
    (t) =>
      t.type === "entrada" &&
      ((t.contractId && t.contractId === contract.id) ||
        (contract.quoteId && t.quoteId && t.quoteId === contract.quoteId)) &&
      (t.paymentPart === "sinal" || t.category === "Sinal de Reserva")
  );

  if (deposit > 0) {
    const sinalTx: Transaction = {
      id: sinalIdx >= 0 ? safeList[sinalIdx].id : uid(),
      type: "entrada",
      description: `Sinal Pago — ${contract.theme || "Decoração"} (${contract.clientName})`,
      category: "Sinal de Reserva",
      clientId: contract.clientId || "",
      client: contract.clientName,
      contractId: contract.id,
      quoteId: contract.quoteId || "",
      eventId: contract.eventId || "",
      paymentPart: "sinal",
      partyDate: contract.partyDate,
      amount: deposit,
      date: sinalIdx >= 0 ? safeList[sinalIdx].date : todayStr,
      method: sinalIdx >= 0 ? safeList[sinalIdx].method || paymentMethod : paymentMethod,
      status: "Pago",
    };

    if (sinalIdx >= 0) {
      safeList[sinalIdx] = sinalTx;
    } else {
      safeList.unshift(sinalTx);
    }
  } else if (sinalIdx >= 0) {
    safeList.splice(sinalIdx, 1);
  }

  // Find existing Restante (Valor em Aberto / Falta Pagar) transaction for this contract/quote
  const restIdx = safeList.findIndex(
    (t) =>
      t.type === "entrada" &&
      ((t.contractId && t.contractId === contract.id) ||
        (contract.quoteId && t.quoteId && t.quoteId === contract.quoteId)) &&
      (t.paymentPart === "restante" ||
        (t.category === "Locação Pegue e Monte" && t.paymentPart !== "sinal"))
  );

  if (remaining > 0) {
    const alreadyPaid = restIdx >= 0 && safeList[restIdx].status === "Pago";
    const restTx: Transaction = {
      id: restIdx >= 0 ? safeList[restIdx].id : uid(),
      type: "entrada",
      description: alreadyPaid
        ? `Restante Recebido — ${contract.theme || "Decoração"} (${contract.clientName})`
        : `Falta Pagar (Em Aberto) — ${contract.theme || "Decoração"} (${contract.clientName})`,
      category: "Locação Pegue e Monte",
      clientId: contract.clientId || "",
      client: contract.clientName,
      contractId: contract.id,
      quoteId: contract.quoteId || "",
      eventId: contract.eventId || "",
      paymentPart: "restante",
      partyDate: contract.partyDate,
      amount: remaining,
      date: alreadyPaid ? safeList[restIdx].date : contract.partyDate || todayStr,
      method: restIdx >= 0 ? safeList[restIdx].method || paymentMethod : paymentMethod,
      status: alreadyPaid ? "Pago" : "Pendente",
    };

    if (restIdx >= 0) {
      safeList[restIdx] = restTx;
    } else {
      safeList.unshift(restTx);
    }
  } else if (restIdx >= 0 && safeList[restIdx].status !== "Pago") {
    safeList.splice(restIdx, 1);
  }

  return safeList;
}
