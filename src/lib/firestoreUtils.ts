import type { Contract } from "./types";

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
    cpf: (c.cpf || "").trim(),
    quoteId: c.quoteId || "",
    eventId: c.eventId || "",
    partyDate: c.partyDate || nowStr,
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
    createdAt: c.createdAt || nowStr,
    customTerms: c.customTerms || "",
  };
}
