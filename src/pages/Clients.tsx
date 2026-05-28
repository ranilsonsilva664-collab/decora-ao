import { useMemo, useState } from "react";
import { Card, SectionTitle, Badge, Button, Modal, Field, Input, Textarea, Select } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { fmtDate, uid } from "../lib/format";
import { waLink, igLink } from "../lib/helpers";
import { useToast } from "../components/Toast";
import type { Client, ClientStatus } from "../lib/types";

const STATUSES: ClientStatus[] = [
  "Novo orçamento",
  "Aguardando resposta",
  "Contrato enviado",
  "Pago sinal",
  "Agendado",
  "Finalizado",
];

const statusColor: Record<ClientStatus, string> = {
  "Novo orçamento": "blue",
  "Aguardando resposta": "amber",
  "Contrato enviado": "lilac",
  "Pago sinal": "gold",
  Agendado: "green",
  Finalizado: "gray",
};

const empty = (): Client => ({
  id: uid(),
  name: "",
  whatsapp: "",
  instagram: "",
  partyDate: "",
  theme: "",
  age: "",
  address: "",
  notes: "",
  photos: [],
  status: "Novo orçamento",
  createdAt: new Date().toISOString().slice(0, 10),
});

export default function Clients() {
  const { clients, setClients, themes } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client>(empty());
  const [filter, setFilter] = useState<string>("Todos");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      clients
        .filter((c) => (filter === "Todos" ? true : c.status === filter))
        .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [clients, filter, search],
  );

  const save = () => {
    if (!editing.name.trim()) {
      toast("Informe o nome do cliente");
      return;
    }
    const exists = clients.some((c) => c.id === editing.id);
    setClients(exists ? clients.map((c) => (c.id === editing.id ? editing : c)) : [editing, ...clients]);
    setOpen(false);
    toast(exists ? "Cliente atualizado!" : "Cliente cadastrado!");
  };

  const onPhotos = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 4).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () =>
        setEditing((p) => ({ ...p, photos: [...p.photos, reader.result as string].slice(0, 8) }));
      reader.readAsDataURL(f);
    });
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Clientes"
        subtitle={`${clients.length} clientes cadastrados`}
        action={
          <Button onClick={() => { setEditing(empty()); setOpen(true); }}>
            <Icon.plus className="h-4 w-4" /> Novo cliente
          </Button>
        }
      />

      <Card className="!p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input placeholder="🔍 Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {["Todos", ...STATUSES].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  filter === s ? "bg-gradient-to-r from-nude-400 to-lilac-400 text-white shadow" : "bg-white/70 text-stone-500 hover:bg-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => (
          <Card key={c.id} className="animate-rise group">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-nude-200 to-lilac-200 text-lg font-semibold text-white">
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold text-stone-800">{c.name}</p>
                  <p className="text-xs text-stone-500">{c.theme || "Sem tema"} • {c.age || "—"}</p>
                </div>
              </div>
              <Badge color={statusColor[c.status]}>{c.status}</Badge>
            </div>

            <div className="mt-4 space-y-1.5 text-sm text-stone-600">
              <p>🗓️ {fmtDate(c.partyDate)}</p>
              {c.address && <p className="truncate">📍 {c.address}</p>}
              {c.notes && <p className="line-clamp-2 text-xs text-stone-500">📝 {c.notes}</p>}
            </div>

            {c.photos.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {c.photos.map((p, i) => (
                  <img key={i} src={p} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {c.whatsapp && (
                <a href={waLink(c.whatsapp, `Oii ${c.name}! 💕`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 transition hover:bg-emerald-100">
                  <Icon.wa className="h-4 w-4" /> WhatsApp
                </a>
              )}
              {c.instagram && (
                <a href={igLink(c.instagram)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-500 transition hover:bg-rose-100">
                  <Icon.ig className="h-4 w-4" /> Instagram
                </a>
              )}
              <button onClick={() => { setEditing(c); setOpen(true); }} className="ml-auto inline-flex items-center gap-1 rounded-xl bg-white/70 px-3 py-1.5 text-xs font-medium text-stone-500 transition hover:bg-white">
                Editar
              </button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="col-span-full text-center text-stone-400">Nenhum cliente encontrado 🌸</Card>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={clients.some((c) => c.id === editing.id) ? "Editar cliente" : "Novo cliente"} wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do cliente"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex: Mariana Lopes" /></Field>
          <Field label="WhatsApp (com DDD)"><Input value={editing.whatsapp} onChange={(e) => setEditing({ ...editing, whatsapp: e.target.value })} placeholder="5511999999999" /></Field>
          <Field label="Instagram"><Input value={editing.instagram} onChange={(e) => setEditing({ ...editing, instagram: e.target.value })} placeholder="@usuario" /></Field>
          <Field label="Data da festa"><Input type="date" value={editing.partyDate} onChange={(e) => setEditing({ ...editing, partyDate: e.target.value })} /></Field>
          <Field label="Tema da festa">
            <Select value={editing.theme} onChange={(e) => setEditing({ ...editing, theme: e.target.value })}>
              <option value="">Selecione...</option>
              {themes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Idade do aniversariante"><Input value={editing.age} onChange={(e) => setEditing({ ...editing, age: e.target.value })} placeholder="Ex: 5 anos" /></Field>
          <div className="sm:col-span-2"><Field label="Endereço"><Input value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} placeholder="Rua, número, cidade" /></Field></div>
          <div className="sm:col-span-2"><Field label="Observações"><Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Preferências, cores, detalhes..." /></Field></div>
          <Field label="Status">
            <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as ClientStatus })}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Fotos e referências">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-lilac-300 bg-lilac-100/40 px-4 py-5 text-sm text-lilac-400 transition hover:bg-lilac-100/70">
                <Icon.up className="h-4 w-4" /> Enviar imagens
                <input type="file" accept="image/*" multiple hidden onChange={(e) => onPhotos(e.target.files)} />
              </label>
            </Field>
            {editing.photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {editing.photos.map((p, i) => (
                  <div key={i} className="relative">
                    <img src={p} className="h-16 w-16 rounded-xl object-cover" />
                    <button onClick={() => setEditing({ ...editing, photos: editing.photos.filter((_, j) => j !== i) })} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose-400 text-[10px] text-white">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          {clients.some((c) => c.id === editing.id) && (
            <Button variant="soft" className="!text-rose-500" onClick={() => { setClients(clients.filter((c) => c.id !== editing.id)); setOpen(false); toast("Cliente removido"); }}>Excluir</Button>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)} className="ml-auto">Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </div>
      </Modal>
    </div>
  );
}
