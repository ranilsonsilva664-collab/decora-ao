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

export interface KitDateAvailability {
  kitId: string;
  kitName: string;
  isAvailable: boolean;
  totalQty: number;
  rentedQty: number;
  remainingQty: number;
  label: string;
  statusColor: "green" | "red" | "amber";
  reason?: string;
}

/**
 * Calcula a disponibilidade exata de um Kit / Tema de Decoração Completa para uma data específica.
 * Reconhece se o tema/kit está locado em Contratos ativos, Eventos na Agenda ou se peças do kit estão esgotadas.
 */
export function getKitAvailabilityForDate(
  kit: Kit,
  targetDate: string,
  contracts: any[] = [],
  eventsList: EventModel[] = [],
  inventoryItems: InventoryItem[] = [],
  allKits: Kit[] = []
): KitDateAvailability {
  const totalQty = Math.max(1, kit.quantity || 1);
  const cleanTarget = normalizeDate(targetDate);

  if (!cleanTarget) {
    return {
      kitId: kit.id,
      kitName: kit.name,
      isAvailable: true,
      totalQty,
      rentedQty: 0,
      remainingQty: totalQty,
      label: totalQty === 1 ? "Disponível" : `${totalQty} un. disponíveis`,
      statusColor: "green",
    };
  }

  const kitNameLower = (kit.name || "").trim().toLowerCase();
  let rentedContractsCount = 0;
  const rentingClients: string[] = [];

  // 1. Contratos ativos na data
  for (const c of contracts) {
    if (c.status === "Cancelado") continue;
    const cStart = normalizeDate(c.pickupDate || c.partyDate);
    const cEnd = normalizeDate(c.returnDate || c.partyDate);

    if (datesOverlap(cleanTarget, cleanTarget, cStart, cEnd)) {
      const cTheme = (c.theme || "").trim().toLowerCase();
      // Match by exact or substring theme name
      const matchesTheme = cTheme && (cTheme === kitNameLower || kitNameLower.includes(cTheme) || cTheme.includes(kitNameLower));
      
      // Also match if contract has items mentioning this kit
      const matchesItem = Array.isArray(c.items) && c.items.some((it: any) => 
        (it.id === kit.id) || ((it.name || "").trim().toLowerCase() === kitNameLower)
      );

      if (matchesTheme || matchesItem) {
        rentedContractsCount += 1;
        if (c.clientName) rentingClients.push(c.clientName);
      }
    }
  }

  // 2. Eventos da agenda ativos na data
  let rentedEventsCount = 0;
  for (const ev of eventsList) {
    if (ev.status === "Cancelado" || ev.status === "Finalizado") continue;
    const evStart = normalizeDate(ev.pickupDate || ev.date);
    const evEnd = normalizeDate(ev.returnDate || ev.date);

    if (datesOverlap(cleanTarget, cleanTarget, evStart, evEnd)) {
      const evTheme = (ev.theme || "").trim().toLowerCase();
      const matchesTheme = evTheme && (evTheme === kitNameLower || kitNameLower.includes(evTheme) || evTheme.includes(kitNameLower));
      const matchesKitInItems = (ev.items || []).some(
        (it) => it.type === "kit" && (it.id === kit.id || it.name.trim().toLowerCase() === kitNameLower)
      );

      if (matchesTheme || matchesKitInItems) {
        // Evita duplicar se for o mesmo evento/contrato
        const alreadyCountedInContracts = rentingClients.some(
          (cl) => cl.toLowerCase() === (ev.clientName || "").toLowerCase()
        );
        if (!alreadyCountedInContracts) {
          rentedEventsCount += 1;
        }
      }
    }
  }

  let totalRented = rentedContractsCount + rentedEventsCount;

  // 3. Checagem de peças individuais do kit (se o kit for composto por peças do acervo)
  if (kit.items && kit.items.length > 0 && inventoryItems.length > 0) {
    const kitAvail = checkKitAvailability(
      kit.id,
      1,
      cleanTarget,
      cleanTarget,
      inventoryItems,
      allKits.length > 0 ? allKits : [kit],
      eventsList
    );

    if (!kitAvail.ok && totalRented === 0) {
      // Peças faltantes no acervo para essa data
      const missingDetails = kitAvail.shortages.map((s) => s.itemName).join(", ");
      return {
        kitId: kit.id,
        kitName: kit.name,
        isAvailable: false,
        totalQty,
        rentedQty: totalQty,
        remainingQty: 0,
        label: "Indisponível nesta data",
        statusColor: "red",
        reason: `Peças em uso nesta data: ${missingDetails}`,
      };
    }
  }

  const remainingQty = Math.max(0, totalQty - totalRented);
  const isAvailable = remainingQty > 0;

  let label = "Disponível";
  let statusColor: "green" | "red" | "amber" = "green";

  if (!isAvailable) {
    label = "Indisponível nesta data";
    statusColor = "red";
  } else if (totalRented > 0 && remainingQty > 0) {
    label = `${remainingQty} de ${totalQty} disponíveis`;
    statusColor = "amber";
  } else {
    label = totalQty === 1 ? "Disponível para esta data" : `${totalQty} un. disponíveis`;
    statusColor = "green";
  }

  return {
    kitId: kit.id,
    kitName: kit.name,
    isAvailable,
    totalQty,
    rentedQty: totalRented,
    remainingQty,
    label,
    statusColor,
  };
}
