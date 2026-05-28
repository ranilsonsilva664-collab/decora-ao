import { useMemo, useState } from "react";
import { Card, SectionTitle, Button, Modal, Field, Input, Select, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { fmtDate, uid, monthName } from "../lib/format";
import { useToast } from "../components/Toast";
import type { CalendarEvent } from "../lib/types";

const empty = (): CalendarEvent => ({
  id: uid(),
  theme: "",
  clientName: "",
  date: "",
  setupTime: "",
  pickupTime: "",
  returnTime: "",
});

export default function Calendar() {
  const { events, setEvents, themes, clients } = useStore();
  const toast = useToast();
  const [cursor, setCursor] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [e, setE] = useState<CalendarEvent>(empty());

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = useMemo(() => {
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [firstDay, daysInMonth]);

  const eventsOn = (day: number) => {
    const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((ev) => ev.date === ds);
  };

  const conflict = useMemo(() => {
    if (!e.theme || !e.date) return false;
    return events.some((ev) => ev.id !== e.id && ev.date === e.date && ev.theme === e.theme);
  }, [e, events]);

  const save = () => {
    if (!e.theme || !e.date) return toast("Informe tema e data");
    if (conflict) return toast("⚠️ Tema já reservado nesta data!");
    const exists = events.some((x) => x.id === e.id);
    setEvents(exists ? events.map((x) => (x.id === e.id ? e : x)) : [e, ...events]);
    setOpen(false);
    toast(exists ? "Festa atualizada!" : "Festa agendada!");
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthEvents = events
    .filter((ev) => { const d = new Date(ev.date); return d.getMonth() === month && d.getFullYear() === year; })
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Agenda de festas"
        subtitle="Montagem, retirada e devolução organizadas"
        action={<Button onClick={() => { setE(empty()); setOpen(true); }}><Icon.plus className="h-4 w-4" /> Nova festa</Button>}
      />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-stone-500 hover:bg-white">‹</button>
          <h3 className="text-lg font-semibold text-stone-800">{monthName(month)} {year}</h3>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-stone-500 hover:bg-white">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-stone-400">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <div key={i} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const evs = eventsOn(day);
            const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = ds === todayStr;
            return (
              <button
                key={i}
                onClick={() => { setE({ ...empty(), date: ds }); setOpen(true); }}
                className={`relative min-h-[56px] rounded-xl border p-1.5 text-left transition hover:bg-white sm:min-h-[78px] ${
                  isToday ? "border-lilac-300 bg-lilac-100/40" : "border-white/60 bg-white/40"
                }`}
              >
                <span className={`text-xs font-medium ${isToday ? "text-lilac-400" : "text-stone-500"}`}>{day}</span>
                <div className="mt-1 space-y-0.5">
                  {evs.slice(0, 2).map((ev) => (
                    <span key={ev.id} className="block truncate rounded-md bg-gradient-to-r from-nude-200 to-lilac-200 px-1 py-0.5 text-[9px] font-medium text-white">{ev.theme}</span>
                  ))}
                  {evs.length > 2 && <span className="text-[9px] text-stone-400">+{evs.length - 2}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle title={`Festas de ${monthName(month)}`} />
        <div className="space-y-3">
          {monthEvents.map((ev) => (
            <div key={ev.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/60 p-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-lilac-100 text-lg">🎈</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-stone-700">{ev.theme}</p>
                <p className="text-xs text-stone-500">{ev.clientName} • {fmtDate(ev.date)}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge color="blue">🔧 Montagem {ev.setupTime}</Badge>
                <Badge color="amber">📦 Retirada {ev.pickupTime}</Badge>
                <Badge color="gray">↩️ Devolução {ev.returnTime}</Badge>
              </div>
              <button onClick={() => { setE(ev); setOpen(true); }} className="rounded-xl bg-white/70 px-3 py-1.5 text-xs font-medium text-stone-500 hover:bg-white">Editar</button>
            </div>
          ))}
          {monthEvents.length === 0 && <p className="text-sm text-stone-400">Nenhuma festa neste mês 🗓️</p>}
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Agendar festa" wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tema">
            <Select value={e.theme} onChange={(ev) => setE({ ...e, theme: ev.target.value })}>
              <option value="">Selecione...</option>
              {themes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Cliente">
            <Input list="callist" value={e.clientName} onChange={(ev) => setE({ ...e, clientName: ev.target.value })} />
            <datalist id="callist">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          </Field>
          <Field label="Data da festa"><Input type="date" value={e.date} onChange={(ev) => setE({ ...e, date: ev.target.value })} /></Field>
          <Field label="Horário de montagem"><Input type="time" value={e.setupTime} onChange={(ev) => setE({ ...e, setupTime: ev.target.value })} /></Field>
          <Field label="Horário de retirada"><Input type="time" value={e.pickupTime} onChange={(ev) => setE({ ...e, pickupTime: ev.target.value })} /></Field>
          <Field label="Devolução (data/hora)"><Input value={e.returnTime} onChange={(ev) => setE({ ...e, returnTime: ev.target.value })} placeholder="Ex: 2025-01-01 10:00" /></Field>
        </div>
        {conflict && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-500">
            ⚠️ Atenção! O tema <b>{e.theme}</b> já está reservado em {fmtDate(e.date)}.
          </div>
        )}
        <div className="mt-6 flex gap-3">
          {events.some((x) => x.id === e.id) && (
            <Button variant="soft" className="!text-rose-500" onClick={() => { setEvents(events.filter((x) => x.id !== e.id)); setOpen(false); toast("Evento removido"); }}>Excluir</Button>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)} className="ml-auto">Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </div>
      </Modal>
    </div>
  );
}
