import { useState } from "react";
import { Card, SectionTitle, Button, Modal, Field, Input, Select, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { brl, uid } from "../lib/format";
import { useToast } from "../components/Toast";
import type { PartyTheme, ThemeStatus } from "../lib/types";

const STATUSES: ThemeStatus[] = ["Disponível", "Reservado", "Em manutenção"];
const statusColor: Record<ThemeStatus, string> = { Disponível: "green", Reservado: "gold", "Em manutenção": "amber" };
const EMOJIS = ["🩵", "🌸", "🦁", "👑", "🚀", "🌷", "🦄", "🐶", "⚽", "🧜‍♀️", "🦕", "🎀", "🌈", "🐉", "🍓"];

const empty = (): PartyTheme => ({ id: uid(), name: "", photo: "🎀", pieces: 0, invested: 0, rentals: 0, revenue: 0, status: "Disponível" });

export default function Inventory() {
  const { themes, setThemes } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [t, setT] = useState<PartyTheme>(empty());

  const save = () => {
    if (!t.name.trim()) return toast("Informe o nome do tema");
    const exists = themes.some((x) => x.id === t.id);
    setThemes(exists ? themes.map((x) => (x.id === t.id ? t : x)) : [t, ...themes]);
    setOpen(false);
    toast(exists ? "Tema atualizado!" : "Tema adicionado!");
  };

  const totalInvested = themes.reduce((s, t) => s + t.invested, 0);
  const totalRevenue = themes.reduce((s, t) => s + t.revenue, 0);
  const totalRentals = themes.reduce((s, t) => s + t.rentals, 0);

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Controle de acervo"
        subtitle="Gerencie seus temas e o retorno de cada um"
        action={<Button onClick={() => { setT(empty()); setOpen(true); }}><Icon.plus className="h-4 w-4" /> Novo tema</Button>}
      />

      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center"><p className="text-xs text-stone-500">Investido</p><p className="mt-1 text-xl font-semibold text-stone-800">{brl(totalInvested)}</p></Card>
        <Card className="text-center"><p className="text-xs text-stone-500">Faturado</p><p className="mt-1 text-xl font-semibold text-emerald-600">{brl(totalRevenue)}</p></Card>
        <Card className="text-center"><p className="text-xs text-stone-500">Locações</p><p className="mt-1 text-xl font-semibold text-lilac-400">{totalRentals}</p></Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((item) => {
          const roi = item.invested ? ((item.revenue - item.invested) / item.invested) * 100 : 0;
          return (
            <Card key={item.id} className="animate-rise">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-nude-100 to-lilac-100 text-3xl">{item.photo}</span>
                  <div>
                    <p className="font-semibold text-stone-800">{item.name}</p>
                    <p className="text-xs text-stone-500">{item.pieces} peças</p>
                  </div>
                </div>
                <Badge color={statusColor[item.status]}>{item.status}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-white/60 p-2.5"><p className="text-xs text-stone-400">Investimento</p><p className="font-semibold text-stone-700">{brl(item.invested)}</p></div>
                <div className="rounded-xl bg-white/60 p-2.5"><p className="text-xs text-stone-400">Já faturou</p><p className="font-semibold text-emerald-600">{brl(item.revenue)}</p></div>
                <div className="rounded-xl bg-white/60 p-2.5"><p className="text-xs text-stone-400">Locações</p><p className="font-semibold text-lilac-400">{item.rentals}x</p></div>
                <div className="rounded-xl bg-white/60 p-2.5"><p className="text-xs text-stone-400">Retorno</p><p className="font-semibold text-gold">{roi.toFixed(0)}%</p></div>
              </div>
              <button onClick={() => { setT(item); setOpen(true); }} className="mt-3 w-full rounded-xl bg-white/70 py-2 text-xs font-medium text-stone-500 hover:bg-white">Editar tema</button>
            </Card>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Tema do acervo" wide>
        <Field label="Ícone do tema">
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((em) => (
              <button key={em} onClick={() => setT({ ...t, photo: em })} className={`grid h-11 w-11 place-items-center rounded-xl text-xl transition ${t.photo === em ? "bg-gradient-to-br from-nude-300 to-lilac-300 scale-105" : "bg-white/70 hover:bg-white"}`}>{em}</button>
            ))}
          </div>
        </Field>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Nome do tema"><Input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} placeholder="Ex: Stitch" /></Field>
          <Field label="Quantidade de peças"><Input type="number" value={t.pieces || ""} onChange={(e) => setT({ ...t, pieces: +e.target.value })} /></Field>
          <Field label="Valor investido (R$)"><Input type="number" value={t.invested || ""} onChange={(e) => setT({ ...t, invested: +e.target.value })} /></Field>
          <Field label="Valor faturado (R$)"><Input type="number" value={t.revenue || ""} onChange={(e) => setT({ ...t, revenue: +e.target.value })} /></Field>
          <Field label="Quantidade de locações"><Input type="number" value={t.rentals || ""} onChange={(e) => setT({ ...t, rentals: +e.target.value })} /></Field>
          <Field label="Status"><Select value={t.status} onChange={(e) => setT({ ...t, status: e.target.value as ThemeStatus })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        </div>
        <div className="mt-6 flex gap-3">
          {themes.some((x) => x.id === t.id) && (
            <Button variant="soft" className="!text-rose-500" onClick={() => { setThemes(themes.filter((x) => x.id !== t.id)); setOpen(false); toast("Tema removido"); }}>Excluir</Button>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)} className="ml-auto">Cancelar</Button>
          <Button onClick={save}>Salvar tema</Button>
        </div>
      </Modal>
    </div>
  );
}
