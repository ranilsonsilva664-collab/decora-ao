import { useState } from "react";
import { Card, SectionTitle, Button, Modal, Field, Input, Select, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { brl, uid } from "../lib/format";
import { useToast } from "../components/Toast";
import type { PartyTheme, ThemeStatus, InventoryItem } from "../lib/types";

const STATUSES: ThemeStatus[] = ["Disponível", "Reservado", "Em manutenção"];
const statusColor: Record<ThemeStatus, string> = { Disponível: "green", Reservado: "gold", "Em manutenção": "amber" };
const EMOJIS = ["🩵", "🌸", "🦁", "👑", "🚀", "🌷", "🦄", "🐶", "⚽", "🧜‍♀️", "🦕", "🎀", "🌈", "🐉", "🍓"];

const emptyTheme = (): PartyTheme => ({ id: uid(), name: "", photo: "🎀", pieces: 0, invested: 0, rentals: 0, revenue: 0, status: "Disponível" });
const emptyItem = (): InventoryItem => ({ id: uid(), name: "", quantity: 1 });

export default function Inventory() {
  const { themes, setThemes, inventoryItems, setInventoryItems } = useStore();
  const toast = useToast();
  
  const [tab, setTab] = useState<"themes" | "items">("themes");

  const [openTheme, setOpenTheme] = useState(false);
  const [t, setT] = useState<PartyTheme>(emptyTheme());

  const [openItem, setOpenItem] = useState(false);
  const [item, setItem] = useState<InventoryItem>(emptyItem());

  const saveTheme = () => {
    if (!t.name.trim()) return toast("Informe o nome do tema");
    const safeThemes = themes || [];
    const exists = safeThemes.some((x) => x.id === t.id);
    setThemes(exists ? safeThemes.map((x) => (x.id === t.id ? t : x)) : [t, ...safeThemes]);
    setOpenTheme(false);
    toast(exists ? "Tema atualizado!" : "Tema adicionado!");
  };

  const saveItem = () => {
    if (!item.name.trim()) return toast("Informe o nome do item");
    if (item.quantity < 1) return toast("A quantidade deve ser maior que zero");
    const safeItems = inventoryItems || [];
    const exists = safeItems.some((x) => x.id === item.id);
    setInventoryItems(exists ? safeItems.map((x) => (x.id === item.id ? item : x)) : [item, ...safeItems]);
    setOpenItem(false);
    toast(exists ? "Item atualizado!" : "Item adicionado!");
  };

  const safeThemes = themes || [];
  const safeItems = inventoryItems || [];

  const totalInvested = safeThemes.reduce((s, t) => s + t.invested, 0);
  const totalRevenue = safeThemes.reduce((s, t) => s + t.revenue, 0);
  const totalRentals = safeThemes.reduce((s, t) => s + t.rentals, 0);

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Controle de acervo"
        subtitle="Gerencie seus temas completos e itens avulsos"
        action={
          tab === "themes" ? (
            <Button onClick={() => { setT(emptyTheme()); setOpenTheme(true); }}><Icon.plus className="h-4 w-4" /> Novo tema</Button>
          ) : (
            <Button onClick={() => { setItem(emptyItem()); setOpenItem(true); }}><Icon.plus className="h-4 w-4" /> Novo item avulso</Button>
          )
        }
      />

      <div className="flex gap-2 border-b border-white/40 pb-2">
        <button
          onClick={() => setTab("themes")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === "themes" ? "bg-white text-lilac-600 shadow-sm" : "text-stone-500 hover:bg-white/50"}`}
        >
          Temas Completos
        </button>
        <button
          onClick={() => setTab("items")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === "items" ? "bg-white text-lilac-600 shadow-sm" : "text-stone-500 hover:bg-white/50"}`}
        >
          Itens Avulsos (Peças)
        </button>
      </div>

      {tab === "themes" && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card className="text-center"><p className="text-xs text-stone-500">Investido</p><p className="mt-1 text-xl font-semibold text-stone-800">{brl(totalInvested)}</p></Card>
            <Card className="text-center"><p className="text-xs text-stone-500">Faturado</p><p className="mt-1 text-xl font-semibold text-emerald-600">{brl(totalRevenue)}</p></Card>
            <Card className="text-center"><p className="text-xs text-stone-500">Locações</p><p className="mt-1 text-xl font-semibold text-lilac-400">{totalRentals}</p></Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {safeThemes.map((item) => {
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
                  <button onClick={() => { setT(item); setOpenTheme(true); }} className="mt-3 w-full rounded-xl bg-white/70 py-2 text-xs font-medium text-stone-500 hover:bg-white">Editar tema</button>
                </Card>
              );
            })}
            {safeThemes.length === 0 && (
              <div className="col-span-full py-12 text-center text-stone-500">Nenhum tema cadastrado.</div>
            )}
          </div>
        </>
      )}

      {tab === "items" && (
        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {safeItems.map((it) => (
            <Card key={it.id} className="animate-rise flex items-center justify-between p-4">
              <div>
                <p className="font-semibold text-stone-800">{it.name}</p>
                <p className="text-xs font-medium text-lilac-500">{it.quantity} {it.quantity === 1 ? 'unidade' : 'unidades'}</p>
              </div>
              <button 
                onClick={() => { setItem(it); setOpenItem(true); }} 
                className="grid h-8 w-8 place-items-center rounded-lg bg-white/50 text-stone-500 transition hover:bg-white hover:text-stone-800"
              >
                <Icon.edit className="h-4 w-4" />
              </button>
            </Card>
          ))}
          {safeItems.length === 0 && (
            <div className="col-span-full py-12 text-center text-stone-500">Nenhum item avulso cadastrado. (Ex: Cilindros, Arcos, etc)</div>
          )}
        </div>
      )}

      <Modal open={openTheme} onClose={() => setOpenTheme(false)} title="Tema completo" wide>
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
          {safeThemes.some((x) => x.id === t.id) && (
            <Button variant="soft" className="!text-rose-500" onClick={() => { setThemes(safeThemes.filter((x) => x.id !== t.id)); setOpenTheme(false); toast("Tema removido"); }}>Excluir</Button>
          )}
          <Button variant="ghost" onClick={() => setOpenTheme(false)} className="ml-auto">Cancelar</Button>
          <Button onClick={saveTheme}>Salvar tema</Button>
        </div>
      </Modal>

      <Modal open={openItem} onClose={() => setOpenItem(false)} title="Item Avulso (Peça)">
        <div className="space-y-4 mt-2">
          <Field label="Nome do item (Ex: Arco romano, Cilindro P)">
            <Input value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} placeholder="Nome da peça" />
          </Field>
          <Field label="Quantidade disponível">
            <Input type="number" min="1" value={item.quantity || ""} onChange={(e) => setItem({ ...item, quantity: +e.target.value })} />
          </Field>
        </div>
        <div className="mt-6 flex gap-3">
          {safeItems.some((x) => x.id === item.id) && (
            <Button variant="soft" className="!text-rose-500" onClick={() => { setInventoryItems(safeItems.filter((x) => x.id !== item.id)); setOpenItem(false); toast("Item removido"); }}>Excluir</Button>
          )}
          <Button variant="ghost" onClick={() => setOpenItem(false)} className="ml-auto">Cancelar</Button>
          <Button onClick={saveItem}>Salvar item</Button>
        </div>
      </Modal>
    </div>
  );
}
