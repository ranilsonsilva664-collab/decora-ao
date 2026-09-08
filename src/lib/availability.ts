import type { InventoryItem, Kit, EventModel, EventRentedItem } from "./types";

export interface ItemAvailabilityResult {
  itemId: string;
  itemName: string;
  total: number;
  inMaintenance: number;
  damaged: number;
  lost: number;
  unusable: number;
  baseUsable: number;
  reservedInPeriod: number;
  available: number;
}

export interface KitShortage {
  itemId: string;
  itemName: string;
  needed: number;
  available: number;
  missing: number;
}

export interface KitAvailabilityResult {
  ok: boolean;
  shortages: KitShortage[];
}

/**
 * Normaliza datas para YYYY-MM-DD para comparação precisa de períodos
 */
function normalizeDate(dateStr?: string): string {
  if (!dateStr) return "";
  return dateStr.slice(0, 10);
}

/**
 * Verifica se dois intervalos de datas se sobrepõem: [startA, endA] e [startB, endB]
 */
export function datesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const sA = normalizeDate(startA);
  const eA = normalizeDate(endA || startA);
  const sB = normalizeDate(startB);
  const eB = normalizeDate(endB || startB);

  if (!sA || !eA || !sB || !eB) return false;
  return sA <= eB && eA >= sB;
}

/**
 * Calcula a quantidade de um item alugada dentro de uma lista de itens alugados (incluindo desdobramento de kits)
 */
export function countItemInRentedList(
  itemId: string,
  rentedItems: EventRentedItem[],
  kits: Kit[]
): number {
  let count = 0;
  for (const rent of rentedItems) {
    if (rent.type === "item" && rent.id === itemId) {
      count += rent.quantity || 0;
    } else if (rent.type === "kit") {
      const kit = kits.find((k) => k.id === rent.id);
      if (kit && kit.items) {
        const component = kit.items.find((c) => c.itemId === itemId);
        if (component) {
          count += (component.quantity || 0) * (rent.quantity || 0);
        }
      }
    }
  }
  return count;
}

/**
 * Calcula a disponibilidade detalhada de uma peça individual para um período específico
 */
export function getItemAvailability(
  itemId: string,
  startDate: string,
  endDate: string,
  inventoryItems: InventoryItem[],
  kits: Kit[],
  eventsList: EventModel[],
  excludeEventId?: string
): ItemAvailabilityResult {
  const item = inventoryItems.find((i) => i.id === itemId);
  const name = item ? item.name : "Item desconhecido";
  const total = item ? item.quantity || 0 : 0;
  const inMaintenance = item ? item.inMaintenance || 0 : 0;
  const damaged = item ? item.damaged || 0 : 0;
  const lost = item ? item.lost || 0 : 0;
  const unusable = inMaintenance + damaged + lost;
  const baseUsable = Math.max(0, total - unusable);

  let reservedInPeriod = 0;

  if (startDate) {
    const sDate = normalizeDate(startDate);
    const eDate = normalizeDate(endDate || startDate);

    for (const ev of eventsList) {
      if (excludeEventId && ev.id === excludeEventId) continue;
      // Eventos cancelados ou já finalizados não bloqueiam acervo
      if (ev.status === "Cancelado" || ev.status === "Finalizado") continue;

      const evStart = normalizeDate(ev.pickupDate || ev.date);
      const evEnd = normalizeDate(ev.returnDate || ev.date);

      if (datesOverlap(sDate, eDate, evStart, evEnd)) {
        reservedInPeriod += countItemInRentedList(itemId, ev.items || [], kits);
      }
    }
  }

  const available = Math.max(0, baseUsable - reservedInPeriod);

  return {
    itemId,
    itemName: name,
    total,
    inMaintenance,
    damaged,
    lost,
    unusable,
    baseUsable,
    reservedInPeriod,
    available,
  };
}

/**
 * Valida se um Kit possui todas as suas peças disponíveis para o período desejado
 */
export function checkKitAvailability(
  kitId: string,
  kitQuantity: number,
  startDate: string,
  endDate: string,
  inventoryItems: InventoryItem[],
  kits: Kit[],
  eventsList: EventModel[],
  excludeEventId?: string
): KitAvailabilityResult {
  const kit = kits.find((k) => k.id === kitId);
  if (!kit || !kit.items || kit.items.length === 0) {
    return { ok: true, shortages: [] };
  }

  const shortages: KitShortage[] = [];

  for (const comp of kit.items) {
    const needed = (comp.quantity || 0) * (kitQuantity || 1);
    const avail = getItemAvailability(
      comp.itemId,
      startDate,
      endDate,
      inventoryItems,
      kits,
      eventsList,
      excludeEventId
    );

    if (avail.available < needed) {
      shortages.push({
        itemId: comp.itemId,
        itemName: comp.itemName,
        needed,
        available: avail.available,
        missing: needed - avail.available,
      });
    }
  }

  return {
    ok: shortages.length === 0,
    shortages,
  };
}

/**
 * Retorna todos os períodos e eventos em que uma peça está ocupada para exibição em calendário
 */
export function getItemReservations(
  itemId: string,
  inventoryItems: InventoryItem[],
  kits: Kit[],
  eventsList: EventModel[]
): Array<{
  eventId: string;
  clientName: string;
  theme: string;
  pickupDate: string;
  returnDate: string;
  status: string;
  quantity: number;
}> {
  const result: Array<{
    eventId: string;
    clientName: string;
    theme: string;
    pickupDate: string;
    returnDate: string;
    status: string;
    quantity: number;
  }> = [];

  for (const ev of eventsList) {
    if (ev.status === "Cancelado" || ev.status === "Finalizado") continue;
    const qty = countItemInRentedList(itemId, ev.items || [], kits);
    if (qty > 0) {
      result.push({
        eventId: ev.id,
        clientName: ev.clientName,
        theme: ev.theme,
        pickupDate: ev.pickupDate || ev.date,
        returnDate: ev.returnDate || ev.date,
        status: ev.status,
        quantity: qty,
      });
    }
  }

  return result.sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
}
