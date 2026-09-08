import { useState, useMemo } from "react";
import { Card, SectionTitle, Button, Modal, Field, Input, Textarea, Select, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { uid, brl, fmtDate } from "../lib/format";
import { useToast } from "../components/Toast";
import type {
  EventModel,
  EventType,
  EventStatus,
  EventRentedItem,
  ReturnCheckItem,
} from "../lib/types";

const EVENT_TYPES: EventType[] = [
  "Aniversário",
  "Chá revelação",
  "Chá de bebê",
  "Batizado",
  "Casamento",
  "Formatura",
  "Evento empresarial",
  "Outro",
];

const emptyEvent = (): EventModel => ({
  id: uid(),
  clientId: "",
  clientName: "",
  type: "Aniversário",
  birthdayPerson: "",
  age: "",
  theme: "",
  date: new Date().toISOString().slice(0, 10),
  time: "14:00",
  location: "",
  pickupDate: new Date().toISOString().slice(0, 10),
  pickupTime: "09:00",
  returnDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  returnTime: "12:00",
  status: "Confirmado",
  items: [],
  notes: "",
  createdAt: new Date().toISOString(),
});

export default function Events() {
  const {
    eventsList,
    setEventsList,
    clients,
    inventoryItems,
    setInventoryItems,
    kits,
    logAction,
  } = useStore();

  const toast = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [openModal, setOpenModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventModel>(emptyEvent());

  // Checkflows
  const [pickupModalEvent, setPickupModalEvent] = useState<EventModel | null>(null);
  const [pickupResp, setPickupResp] = useState("");
  const [pickupNotes, setPickupNotes] = useState("");

  const [returnModalEvent, setReturnModalEvent] = useState<EventModel | null>(null);
  const [returnResp, setReturnResp] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [conferItems, setConferItems] = useState<ReturnCheckItem[]>([]);

  // Item selector for adding to event
  const [selItemType, setSelItemType] = useState<"item" | "kit">("item");
  const [selItemId, setSelItemId] = useState("");
  const [selItemQty, setSelItemQty] = useState(1);

  const safeEvents = eventsList || [];

  const filteredEvents = useMemo(() => {
    return safeEvents
      .filter((ev) => {
        const matchSearch =
          ev.clientName.toLowerCase().includes(search.toLowerCase()) ||
          ev.theme.toLowerCase().includes(search.toLowerCase()) ||
          (ev.birthdayPerson && ev.birthdayPerson.toLowerCase().includes(search.toLowerCase()));

        const matchStatus = statusFilter === "Todos" ? true : ev.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [safeEvents, search, statusFilter]);

  // Save Event
  const saveEvent = () => {
    if (!editingEvent.clientName.trim()) return toast("Informe o cliente");
    if (!editingEvent.date) return toast("Informe a data do evento");

    const exists = safeEvents.some((x) => x.id === editingEvent.id);
    const updated = exists
      ? safeEvents.map((x) => (x.id === editingEvent.id ? editingEvent : x))
      : [editingEvent, ...safeEvents];

    setEventsList(updated);
    setOpenModal(false);
    logAction(
      exists ? "Evento Atualizado" : "Novo Evento Criado",
      `${editingEvent.clientName} - ${editingEvent.theme} em ${fmtDate(editingEvent.date)}`
    );
    toast(exists ? "Evento atualizado!" : "Evento cadastrado!");
  };

  const addItemToEvent = () => {
    if (!selItemId) return toast("Selecione um item ou kit");
    if (selItemQty < 1) return toast("Quantidade inválida");

    let name = "";
    let unitPrice = 0;

    if (selItemType === "item") {
      const found = inventoryItems.find((i) => i.id === selItemId);
      if (!found) return;
      name = found.name;
      unitPrice = found.rentalPrice || 0;
    } else {
      const found = kits.find((k) => k.id === selItemId);
      if (!found) return;
      name = `Kit: ${found.name}`;
      unitPrice = found.rentalPrice || 0;
    }

    const newItem: EventRentedItem = {
      type: selItemType,
      id: selItemId,
      name,
      quantity: selItemQty,
      unitPrice,
      subtotal: unitPrice * selItemQty,
    };

    setEditingEvent({
      ...editingEvent,
      items: [...(editingEvent.items || []), newItem],
    });

    setSelItemId("");
    setSelItemQty(1);
    toast("Item incluído no evento!");
  };

  const removeItemFromEvent = (index: number) => {
    const copy = [...(editingEvent.items || [])];
    copy.splice(index, 1);
    setEditingEvent({ ...editingEvent, items: copy });
  };

  // RETIRADA FLOW
  const startPickupFlow = (ev: EventModel) => {
    setPickupModalEvent(ev);
    setPickupResp(ev.pickupCheck?.responsible || ev.clientName);
    setPickupNotes(ev.pickupCheck?.notes || "");
  };

  const confirmPickup = () => {
    if (!pickupModalEvent) return;

    const updatedEvent: EventModel = {
      ...pickupModalEvent,
      status: "Retirado",
      pickupCheck: {
        checked: true,
        date: new Date().toISOString(),
        responsible: pickupResp,
        notes: pickupNotes,
        itemsDelivered: (pickupModalEvent.items || []).map((it) => ({
          itemId: it.id,
          name: it.name,
          quantity: it.quantity,
        })),
      },
    };

    setEventsList(safeEvents.map((ev) => (ev.id === updatedEvent.id ? updatedEvent : ev)));
    setPickupModalEvent(null);
    logAction(
      "Retirada Confirmada",
      `Evento ${updatedEvent.theme} de ${updatedEvent.clientName} retirado por ${pickupResp}`
    );
    toast("Retirada confirmada! Peças em uso. 📦");
  };

  // DEVOLUÇÃO & CONFERÊNCIA FLOW
  const startReturnFlow = (ev: EventModel) => {
    setReturnModalEvent(ev);
    setReturnResp(ev.clientName);
    setReturnNotes("");

    // Initialize checklist items
    const initialItems: ReturnCheckItem[] = (ev.items || []).map((it) => ({
      itemId: it.id,
      name: it.name,
      deliveredQty: it.quantity,
      returnedQty: it.quantity,
      damagedQty: 0,
      maintenanceQty: 0,
      lostQty: 0,
      status: "OK",
      notes: "",
    }));

    setConferItems(initialItems);
  };

  const confirmReturn = () => {
    if (!returnModalEvent) return;

    // 1. Update items in inventory (add damaged, maintenance, lost counters)
    let updatedInventory = [...inventoryItems];

    for (const conf of conferItems) {
      if (conf.damagedQty > 0 || conf.maintenanceQty > 0 || conf.lostQty > 0) {
        updatedInventory = updatedInventory.map((inv) => {
          if (inv.id === conf.itemId) {
            return {
              ...inv,
              inMaintenance: (inv.inMaintenance || 0) + (conf.maintenanceQty || 0),
              damaged: (inv.damaged || 0) + (conf.damagedQty || 0),
              lost: (inv.lost || 0) + (conf.lostQty || 0),
            };
          }
          return inv;
        });
      }
    }

    setInventoryItems(updatedInventory);

    // 2. Mark event as Finalizado
    const updatedEvent: EventModel = {
      ...returnModalEvent,
      status: "Finalizado",
      returnCheck: {
        checked: true,
        date: new Date().toISOString(),
        responsible: returnResp,
        notes: returnNotes,
        itemsReturned: conferItems,
      },
    };

    setEventsList(safeEvents.map((ev) => (ev.id === updatedEvent.id ? updatedEvent : ev)));
    setReturnModalEvent(null);

    logAction(
      "Conferência de Devolução Concluída",
      `Evento ${updatedEvent.theme} de ${updatedEvent.clientName} conferido e finalizado. Acervo liberado!`
    );
    toast("Devolução conferida com sucesso! Acervo liberado. ✨");
  };

  const setAllItemsOk = () => {
    setConferItems(
      conferItems.map((c) => ({
        ...c,
        returnedQty: c.deliveredQty,
        damagedQty: 0,
        maintenanceQty: 0,
        lostQty: 0,
        status: "OK",
      }))
    );
    toast("Todos os itens marcados como 100% OK!");
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Gestão de Eventos"
        subtitle="Acompanhe desde a reserva até a retirada, devolução e conferência do acervo"
        action={
          <Button
            onClick={() => {
              setEditingEvent(emptyEvent());
              setOpenModal(true);
            }}
          >
            <Icon.plus className="h-4 w-4" /> Novo Evento
          </Button>
        }
      />

      {/* Filters Bar */}
      <Card className="!p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Icon.dashboard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              className="pl-9 !bg-white"
              placeholder="Buscar por cliente, tema ou aniversariante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="!w-auto !bg-white text-xs font-medium"
            >
              <option value="Todos">Todos os status</option>
              <option value="Confirmado">Confirmados / Reservados</option>
              <option value="Retirado">Retirados / Em uso</option>
              <option value="Devolvido">Aguardando Conferência</option>
              <option value="Finalizado">Finalizados</option>
              <option value="Cancelado">Cancelados</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Events List */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredEvents.map((ev) => {
          const totalItemsCount = (ev.items || []).reduce((acc, it) => acc + it.quantity, 0);

          let statusBadgeColor = "blue";
          if (ev.status === "Confirmado") statusBadgeColor = "amber";
          if (ev.status === "Retirado") statusBadgeColor = "lilac";
          if (ev.status === "Finalizado") statusBadgeColor = "green";
          if (ev.status === "Cancelado") statusBadgeColor = "gray";

          return (
            <Card key={ev.id} className="animate-rise flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-lilac-500">
                      {ev.type}
                    </span>
                    <h3 className="font-bold text-stone-800 text-base">{ev.theme || "Tema a definir"}</h3>
                    <p className="text-xs text-stone-500">{ev.clientName}</p>
                  </div>
                  <Badge color={statusBadgeColor}>{ev.status}</Badge>
                </div>

                {ev.birthdayPerson && (
                  <p className="text-xs text-stone-600 mb-2">
                    🎂 Aniversariante: <b>{ev.birthdayPerson}</b> {ev.age ? `(${ev.age})` : ""}
                  </p>
                )}

                <div className="space-y-1 rounded-2xl bg-white/60 p-3 text-xs text-stone-600">
                  <p>
                    🗓️ <b>Data da Festa:</b> {fmtDate(ev.date)} às {ev.time || "14:00"}
                  </p>
                  <p>
                    📦 <b>Retirada:</b> {fmtDate(ev.pickupDate)} às {ev.pickupTime || "09:00"}
                  </p>
                  <p>
                    ↩️ <b>Devolução:</b> {fmtDate(ev.returnDate)} às {ev.returnTime || "12:00"}
                  </p>
                  {ev.location && <p className="truncate">📍 {ev.location}</p>}
                </div>

                <div className="mt-2 text-xs text-stone-500 flex justify-between items-center px-1">
                  <span>Peças no evento:</span>
                  <span className="font-bold text-stone-700">{totalItemsCount} peças</span>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-2">
                {ev.status === "Confirmado" && (
                  <Button
                    variant="primary"
                    className="flex-1 !py-2 text-xs"
                    onClick={() => startPickupFlow(ev)}
                  >
                    📦 Confirmar Retirada
                  </Button>
                )}

                {ev.status === "Retirado" && (
                  <Button
                    variant="wa"
                    className="flex-1 !py-2 text-xs"
                    onClick={() => startReturnFlow(ev)}
                  >
                    ↩️ Fazer Devolução / Conferência
                  </Button>
                )}

                <button
                  onClick={() => {
                    setEditingEvent(ev);
                    setOpenModal(true);
                  }}
                  className="rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-white shadow-sm"
                >
                  Editar
                </button>
              </div>
            </Card>
          );
        })}

        {filteredEvents.length === 0 && (
          <div className="col-span-full py-16 text-center text-stone-400">
            <span className="text-4xl block mb-2">🎉</span>
            <p className="font-medium text-base text-stone-600">Nenhum evento encontrado</p>
            <p className="text-xs text-stone-400 mt-1">
              Cadastre um novo evento ou crie orçamentos para preencher o cronograma.
            </p>
          </div>
        )}
      </div>

      {/* MODAL: CRIAR / EDITAR EVENTO */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={safeEvents.some((x) => x.id === editingEvent.id) ? "Editar Evento" : "Novo Evento"}
        wide
      >
        <div className="space-y-4 mt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente">
              <Input
                list="evClientsList"
                value={editingEvent.clientName}
                onChange={(e) => {
                  const name = e.target.value;
                  const cl = clients.find((c) => c.name.toLowerCase() === name.toLowerCase());
                  setEditingEvent({
                    ...editingEvent,
                    clientName: name,
                    clientId: cl ? cl.id : editingEvent.clientId,
                  });
                }}
                placeholder="Selecione ou digite o cliente"
              />
              <datalist id="evClientsList">
                {clients.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </Field>

            <Field label="Tipo de Evento">
              <Select
                value={editingEvent.type}
                onChange={(e) => setEditingEvent({ ...editingEvent, type: e.target.value as EventType })}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tema">
              <Input
                value={editingEvent.theme}
                onChange={(e) => setEditingEvent({ ...editingEvent, theme: e.target.value })}
                placeholder="Ex: Stitch Rosa, Safari, Barbie..."
              />
            </Field>
            <Field label="Aniversariante (opcional)">
              <Input
                value={editingEvent.birthdayPerson || ""}
                onChange={(e) => setEditingEvent({ ...editingEvent, birthdayPerson: e.target.value })}
                placeholder="Nome da criança / anfitrião"
              />
            </Field>
            <Field label="Idade">
              <Input
                value={editingEvent.age || ""}
                onChange={(e) => setEditingEvent({ ...editingEvent, age: e.target.value })}
                placeholder="Ex: 5 anos"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data da Festa">
              <Input
                type="date"
                value={editingEvent.date}
                onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
              />
            </Field>
            <Field label="Horário da Festa">
              <Input
                type="time"
                value={editingEvent.time || ""}
                onChange={(e) => setEditingEvent({ ...editingEvent, time: e.target.value })}
              />
            </Field>
          </div>

          {/* Availability Dates (Retirada até Devolução) */}
          <div className="rounded-2xl bg-lilac-50/50 p-4 border border-lilac-200/60 space-y-3">
            <p className="text-xs font-bold text-lilac-700 uppercase tracking-wider">
              Período de Bloqueio do Acervo (Retirada até Devolução)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Data Retirada">
                <Input
                  type="date"
                  value={editingEvent.pickupDate}
                  onChange={(e) => setEditingEvent({ ...editingEvent, pickupDate: e.target.value })}
                  className="!bg-white"
                />
              </Field>
              <Field label="Hora Retirada">
                <Input
                  type="time"
                  value={editingEvent.pickupTime}
                  onChange={(e) => setEditingEvent({ ...editingEvent, pickupTime: e.target.value })}
                  className="!bg-white"
                />
              </Field>
              <Field label="Data Devolução">
                <Input
                  type="date"
                  value={editingEvent.returnDate}
                  onChange={(e) => setEditingEvent({ ...editingEvent, returnDate: e.target.value })}
                  className="!bg-white"
                />
              </Field>
              <Field label="Hora Devolução">
                <Input
                  type="time"
                  value={editingEvent.returnTime}
                  onChange={(e) => setEditingEvent({ ...editingEvent, returnTime: e.target.value })}
                  className="!bg-white"
                />
              </Field>
            </div>
          </div>

          <Field label="Endereço / Local da Festa">
            <Input
              value={editingEvent.location || ""}
              onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
              placeholder="Rua, número, salão ou condomínio..."
            />
          </Field>

          {/* Rented Items Selector */}
          <div className="rounded-2xl bg-white/70 p-4 border border-white/80 space-y-3">
            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Peças e Kits Vinculados a este Evento:
            </h4>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="w-28">
                <Select
                  value={selItemType}
                  onChange={(e) => setSelItemType(e.target.value as "item" | "kit")}
                  className="!bg-white text-xs"
                >
                  <option value="item">Peça</option>
                  <option value="kit">Kit</option>
                </Select>
              </div>
              <div className="flex-1">
                <Select
                  value={selItemId}
                  onChange={(e) => setSelItemId(e.target.value)}
                  className="!bg-white text-xs"
                >
                  <option value="">Selecione...</option>
                  {selItemType === "item"
                    ? inventoryItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.code ? `[${it.code}] ` : ""}
                          {it.name} (R$ {it.rentalPrice || 0})
                        </option>
                      ))
                    : kits.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name} (R$ {k.rentalPrice || 0})
                        </option>
                      ))}
                </Select>
              </div>
              <div className="w-20">
                <Input
                  type="number"
                  min="1"
                  value={selItemQty}
                  onChange={(e) => setSelItemQty(Math.max(1, +e.target.value))}
                  placeholder="Qtd"
                  className="!bg-white text-xs"
                />
              </div>
              <Button onClick={addItemToEvent} className="!py-2 text-xs">
                + Incluir
              </Button>
            </div>

            <div className="divide-y divide-stone-100 rounded-xl bg-white overflow-hidden border border-stone-100">
              {(editingEvent.items || []).map((it, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                  <div>
                    <span className="font-semibold text-stone-800">{it.name}</span>
                    <span className="text-stone-400 ml-2">({brl(it.unitPrice)} cada)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lilac-500">{it.quantity}x</span>
                    <span className="font-bold text-stone-700">{brl(it.subtotal)}</span>
                    <button
                      onClick={() => removeItemFromEvent(idx)}
                      className="text-rose-400 hover:text-rose-600 ml-2"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {(editingEvent.items || []).length === 0 && (
                <p className="p-3 text-center text-xs text-stone-400">
                  Nenhuma peça vinculada a este evento ainda.
                </p>
              )}
            </div>
          </div>

          <Field label="Status do Evento">
            <Select
              value={editingEvent.status}
              onChange={(e) => setEditingEvent({ ...editingEvent, status: e.target.value as EventStatus })}
            >
              <option value="Confirmado">Confirmado / Reservado</option>
              <option value="Retirado">Retirado / Em uso</option>
              <option value="Devolvido">Devolvido (aguarda conferência)</option>
              <option value="Finalizado">Finalizado / Acervo liberado</option>
              <option value="Cancelado">Cancelado</option>
            </Select>
          </Field>

          <Field label="Observações">
            <Textarea
              value={editingEvent.notes || ""}
              onChange={(e) => setEditingEvent({ ...editingEvent, notes: e.target.value })}
              placeholder="Detalhes adicionais, cores de balões, pedidos especiais..."
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setOpenModal(false)}>
            Cancelar
          </Button>
          <Button onClick={saveEvent}>Salvar Evento</Button>
        </div>
      </Modal>

      {/* MODAL: FLUXO DE RETIRADA */}
      <Modal
        open={!!pickupModalEvent}
        onClose={() => setPickupModalEvent(null)}
        title="Confirmar Retirada de Peças"
      >
        {pickupModalEvent && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-lilac-50 p-3 text-xs text-lilac-700">
              <p>
                <b>Cliente:</b> {pickupModalEvent.clientName}
              </p>
              <p>
                <b>Evento:</b> {pickupModalEvent.theme} ({fmtDate(pickupModalEvent.date)})
              </p>
            </div>

            <p className="text-xs font-semibold text-stone-600">Peças a entregar para o cliente:</p>
            <div className="divide-y divide-stone-100 rounded-xl bg-white p-2 border border-stone-100 text-xs">
              {(pickupModalEvent.items || []).map((it, idx) => (
                <div key={idx} className="flex justify-between py-1.5">
                  <span className="font-medium text-stone-800">{it.name}</span>
                  <span className="font-bold text-lilac-500">{it.quantity} un.</span>
                </div>
              ))}
            </div>

            <Field label="Responsável pela Retirada (Nome de quem buscou)">
              <Input
                value={pickupResp}
                onChange={(e) => setPickupResp(e.target.value)}
                placeholder="Ex: Mariana ou motorista de app"
              />
            </Field>

            <Field label="Observações da Retirada">
              <Input
                value={pickupNotes}
                onChange={(e) => setPickupNotes(e.target.value)}
                placeholder="Ex: Peças conferidas sem avarias na saída"
              />
            </Field>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setPickupModalEvent(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmPickup}>Confirmar Retirada (Mudar para Em Uso)</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: FLUXO DE DEVOLUÇÃO E CONFERÊNCIA */}
      <Modal
        open={!!returnModalEvent}
        onClose={() => setReturnModalEvent(null)}
        title="Conferência de Devolução do Acervo"
        wide
      >
        {returnModalEvent && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-emerald-50 p-3 text-xs text-emerald-800">
              <div>
                <p>
                  <b>Cliente:</b> {returnModalEvent.clientName}
                </p>
                <p>
                  <b>Evento:</b> {returnModalEvent.theme} ({fmtDate(returnModalEvent.date)})
                </p>
              </div>
              <Button variant="wa" className="!py-1.5 !px-3 text-xs" onClick={setAllItemsOk}>
                ✅ Tudo OK em 1 Clique
              </Button>
            </div>

            <p className="text-xs font-semibold text-stone-700">
              Conferência detalhada item por item:
            </p>

            <div className="divide-y divide-stone-100 rounded-2xl bg-white overflow-hidden border border-stone-200">
              {conferItems.map((item, idx) => (
                <div key={idx} className="p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between font-semibold text-stone-800">
                    <span>{item.name}</span>
                    <span className="text-stone-500">Retirado: {item.deliveredQty} un.</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Field label="Devolvido OK">
                      <Input
                        type="number"
                        min="0"
                        value={item.returnedQty}
                        onChange={(e) => {
                          const copy = [...conferItems];
                          copy[idx].returnedQty = +e.target.value;
                          setConferItems(copy);
                        }}
                        className="text-emerald-600 font-bold"
                      />
                    </Field>
                    <Field label="Danificado">
                      <Input
                        type="number"
                        min="0"
                        value={item.damagedQty}
                        onChange={(e) => {
                          const copy = [...conferItems];
                          copy[idx].damagedQty = +e.target.value;
                          setConferItems(copy);
                        }}
                        className="text-rose-500 font-bold"
                      />
                    </Field>
                    <Field label="Requer Reparo">
                      <Input
                        type="number"
                        min="0"
                        value={item.maintenanceQty}
                        onChange={(e) => {
                          const copy = [...conferItems];
                          copy[idx].maintenanceQty = +e.target.value;
                          setConferItems(copy);
                        }}
                        className="text-amber-500 font-bold"
                      />
                    </Field>
                    <Field label="Faltando / Perdido">
                      <Input
                        type="number"
                        min="0"
                        value={item.lostQty}
                        onChange={(e) => {
                          const copy = [...conferItems];
                          copy[idx].lostQty = +e.target.value;
                          setConferItems(copy);
                        }}
                        className="text-stone-400 font-bold"
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Responsável pelo Recebimento">
                <Input
                  value={returnResp}
                  onChange={(e) => setReturnResp(e.target.value)}
                  placeholder="Nome de quem conferiu"
                />
              </Field>
              <Field label="Observações da Devolução">
                <Input
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Ex: Peças limpas, arranhão na base do cilindro P..."
                />
              </Field>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setReturnModalEvent(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmReturn}>
                Finalizar Conferência & Liberar Acervo
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
