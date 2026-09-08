import { useMemo, useState } from "react";
import { Card, SectionTitle, Badge, Button, Modal, Field, Input, Textarea, Select } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { fmtDate, uid, brl } from "../lib/format";
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

const emptyClient = (): Client => ({
  id: uid(),
  name: "",
  cpf: "",
  phone: "",
  whatsapp: "",
  instagram: "",
  email: "",
  cep: "",
  address: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  partyDate: "",
  theme: "",
  age: "",
  notes: "",
  photos: [],
  status: "Novo orçamento",
  createdAt: new Date().toISOString().slice(0, 10),
});

export default function Clients() {
  const {
    clients,
    setClients,
    eventsList,
    quotes,
    contracts,
    transactions,
    themes,
    tenantId,
    logAction,
  } = useStore();

  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client>(emptyClient());
  const [filter, setFilter] = useState<string>("Todos");
  const [search, setSearch] = useState("");

  // Detailed Profile View (Ficha da Cliente)
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [profileTab, setProfileTab] = useState<"info" | "events" | "quotes" | "contracts" | "finances">("info");

  const filtered = useMemo(
    () =>
      clients
        .filter((c) => (filter === "Todos" ? true : c.status === filter))
        .filter((c) => {
          const q = search.toLowerCase();
          return (
            c.name.toLowerCase().includes(q) ||
            (c.whatsapp && c.whatsapp.includes(q)) ||
            (c.cpf && c.cpf.includes(q)) ||
            (c.email && c.email.toLowerCase().includes(q))
          );
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [clients, filter, search]
  );

  // Busca CEP automático via ViaCEP
  const handleCepLookup = async (cepVal: string) => {
    const cleanCep = cepVal.replace(/\D/g, "");
    setEditing((prev) => ({ ...prev, cep: cepVal }));
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const d = await res.json();
        if (!d.erro) {
          setEditing((prev) => ({
            ...prev,
            address: d.logradouro || prev.address,
            neighborhood: d.bairro || prev.neighborhood,
            city: d.localidade || prev.city,
            state: d.uf || prev.state,
          }));
          toast("Endereço preenchido automaticamente pelo CEP!");
        }
      } catch {
        // Silent fail
      }
    }
  };

  const save = () => {
    if (!editing.name.trim()) return toast("Informe o nome da cliente");

    const exists = clients.some((c) => c.id === editing.id);
    const updated = exists
      ? clients.map((c) => (c.id === editing.id ? editing : c))
      : [editing, ...clients];

    setClients(updated);
    setOpen(false);
    logAction(
      exists ? "Cliente Atualizada" : "Nova Cliente Cadastrada",
      `${editing.name} (WhatsApp: ${editing.whatsapp || "não inf."})`
    );
    toast(exists ? "Cliente atualizada!" : "Cliente cadastrada!");
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

  const formUrl = `${window.location.origin}/formulario/${tenantId}`;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Gestão de Clientes"
        subtitle={`${clients.length} clientes cadastrados no sistema`}
        action={
          <div className="flex gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Olá! Para agilizarmos o orçamento da sua festa Pegue e Monte, preencha este formulário rápido no seu celular:\n\n${formUrl}`
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="wa">
                <Icon.wa className="h-4 w-4" /> Enviar Formulário
              </Button>
            </a>
            <Button
              onClick={() => {
                setEditing(emptyClient());
                setOpen(true);
              }}
            >
              <Icon.plus className="h-4 w-4" /> Nova Cliente
            </Button>
          </div>
        }
      />

      {/* Search and Status Filters */}
      <Card className="!p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="🔍 Buscar por nome, WhatsApp ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs !bg-white"
          />
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {["Todos", ...STATUSES].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  filter === s
                    ? "bg-gradient-to-r from-nude-400 to-lilac-400 text-white shadow"
                    : "bg-white/70 text-stone-500 hover:bg-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Client Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => {
          const clientEvents = (eventsList || []).filter(
            (ev) => ev.clientId === c.id || ev.clientName.toLowerCase() === c.name.toLowerCase()
          );

          return (
            <Card key={c.id} className="animate-rise group flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-nude-200 to-lilac-200 text-lg font-semibold text-white">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-semibold text-stone-800 leading-tight">{c.name}</p>
                      <p className="text-xs text-stone-500">
                        {c.cpf ? `CPF: ${c.cpf} • ` : ""}
                        {c.city ? `${c.city}/${c.state || "SP"}` : "Sem endereço"}
                      </p>
                    </div>
                  </div>
                  <Badge color={statusColor[c.status]}>{c.status}</Badge>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-stone-600 bg-white/50 p-2.5 rounded-xl">
                  <p>
                    📱 <b>WhatsApp:</b> {c.whatsapp || "Não cadastrado"}
                  </p>
                  {c.address && (
                    <p className="truncate">
                      📍 <b>Endereço:</b> {c.address}
                      {c.number ? `, ${c.number}` : ""} {c.neighborhood ? `- ${c.neighborhood}` : ""}
                    </p>
                  )}
                  <p>
                    🎉 <b>Eventos:</b> {clientEvents.length} cadastrados
                  </p>
                  {c.notes && <p className="line-clamp-2 text-stone-400">📝 {c.notes}</p>}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center gap-2">
                {c.whatsapp && (
                  <a
                    href={waLink(c.whatsapp, `Olá ${c.name}! 💕 Como posso te ajudar hoje?`)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-100"
                  >
                    <Icon.wa className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}
                <button
                  onClick={() => {
                    setViewingClient(c);
                    setProfileTab("info");
                  }}
                  className="rounded-xl bg-lilac-50 px-3 py-1.5 text-xs font-semibold text-lilac-600 hover:bg-lilac-100 transition"
                >
                  Ver Ficha Completa
                </button>
                <button
                  onClick={() => {
                    setEditing(c);
                    setOpen(true);
                  }}
                  className="ml-auto inline-flex items-center gap-1 rounded-xl bg-white/70 px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:bg-white"
                >
                  <Icon.edit className="h-3.5 w-3.5" /> Editar
                </button>
              </div>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <Card className="col-span-full text-center text-stone-400 py-12">
            Nenhuma cliente encontrada 🌸
          </Card>
        )}
      </div>

      {/* MODAL: CADASTRO / EDIÇÃO DE CLIENTE */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={clients.some((c) => c.id === editing.id) ? "Editar Cliente" : "Nova Cliente"}
        wide
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="Nome Completo">
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Ex: Mariana Lopes da Silva"
                />
              </Field>
            </div>
            <Field label="CPF">
              <Input
                value={editing.cpf || ""}
                onChange={(e) => setEditing({ ...editing, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="WhatsApp (com DDD)">
              <Input
                value={editing.whatsapp}
                onChange={(e) => setEditing({ ...editing, whatsapp: e.target.value })}
                placeholder="11999999999"
              />
            </Field>
            <Field label="Telefone Fixo / Recado">
              <Input
                value={editing.phone || ""}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                placeholder="1133334444"
              />
            </Field>
            <Field label="E-mail">
              <Input
                value={editing.email || ""}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                placeholder="cliente@email.com"
              />
            </Field>
          </div>

          {/* Endereço completo com busca por CEP */}
          <div className="rounded-2xl bg-white/60 p-4 border border-white/80 space-y-3">
            <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Endereço Residencial / Entrega
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="CEP (busca automática)">
                <Input
                  value={editing.cep || ""}
                  onChange={(e) => handleCepLookup(e.target.value)}
                  placeholder="00000-000"
                  className="!bg-white"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Logradouro / Rua">
                  <Input
                    value={editing.address}
                    onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                    placeholder="Rua, Avenida..."
                    className="!bg-white"
                  />
                </Field>
              </div>
              <Field label="Número">
                <Input
                  value={editing.number || ""}
                  onChange={(e) => setEditing({ ...editing, number: e.target.value })}
                  placeholder="123"
                  className="!bg-white"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Complemento">
                <Input
                  value={editing.complement || ""}
                  onChange={(e) => setEditing({ ...editing, complement: e.target.value })}
                  placeholder="Apto, Bloco..."
                  className="!bg-white"
                />
              </Field>
              <Field label="Bairro">
                <Input
                  value={editing.neighborhood || ""}
                  onChange={(e) => setEditing({ ...editing, neighborhood: e.target.value })}
                  placeholder="Bairro"
                  className="!bg-white"
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Field label="Cidade">
                    <Input
                      value={editing.city || ""}
                      onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                      placeholder="Cidade"
                      className="!bg-white"
                    />
                  </Field>
                </div>
                <Field label="UF">
                  <Input
                    value={editing.state || "SP"}
                    onChange={(e) => setEditing({ ...editing, state: e.target.value.toUpperCase() })}
                    placeholder="UF"
                    className="!bg-white"
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Instagram (opcional)">
              <Input
                value={editing.instagram || ""}
                onChange={(e) => setEditing({ ...editing, instagram: e.target.value })}
                placeholder="@usuario"
              />
            </Field>

            <Field label="Status no CRM">
              <Select
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as ClientStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Observações e Preferências">
            <Textarea
              value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              placeholder="Preferências, histórico de conversas, restrições..."
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {clients.some((c) => c.id === editing.id) && (
            <Button
              variant="soft"
              className="!text-rose-500"
              onClick={() => {
                if (confirm(`Deseja excluir a cliente ${editing.name}?`)) {
                  setClients(clients.filter((c) => c.id !== editing.id));
                  setOpen(false);
                  toast("Cliente removida");
                }
              }}
            >
              Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)} className="ml-auto">
            Cancelar
          </Button>
          <Button onClick={save}>Salvar Cliente</Button>
        </div>
      </Modal>

      {/* MODAL: FICHA COMPLETA DA CLIENTE (Requisito 12) */}
      <Modal
        open={!!viewingClient}
        onClose={() => setViewingClient(null)}
        title={viewingClient ? `Ficha de ${viewingClient.name}` : "Ficha"}
        wide
      >
        {viewingClient && (
          <div className="space-y-4">
            {/* Tab navigation within profile */}
            <div className="flex gap-2 border-b border-stone-200 pb-2 overflow-x-auto text-xs">
              <button
                onClick={() => setProfileTab("info")}
                className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                  profileTab === "info" ? "bg-lilac-500 text-white" : "text-stone-600 bg-white/60"
                }`}
              >
                Dados Cadastrais
              </button>
              <button
                onClick={() => setProfileTab("events")}
                className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                  profileTab === "events" ? "bg-lilac-500 text-white" : "text-stone-600 bg-white/60"
                }`}
              >
                Eventos (
                {
                  (eventsList || []).filter(
                    (ev) => ev.clientId === viewingClient.id || ev.clientName === viewingClient.name
                  ).length
                }
                )
              </button>
              <button
                onClick={() => setProfileTab("quotes")}
                className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                  profileTab === "quotes" ? "bg-lilac-500 text-white" : "text-stone-600 bg-white/60"
                }`}
              >
                Orçamentos (
                {quotes.filter((q) => q.clientId === viewingClient.id || q.clientName === viewingClient.name).length}
                )
              </button>
              <button
                onClick={() => setProfileTab("contracts")}
                className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                  profileTab === "contracts" ? "bg-lilac-500 text-white" : "text-stone-600 bg-white/60"
                }`}
              >
                Contratos (
                {
                  contracts.filter(
                    (c) => c.clientId === viewingClient.id || c.clientName === viewingClient.name
                  ).length
                }
                )
              </button>
              <button
                onClick={() => setProfileTab("finances")}
                className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                  profileTab === "finances" ? "bg-lilac-500 text-white" : "text-stone-600 bg-white/60"
                }`}
              >
                Pagamentos
              </button>
            </div>

            {/* TAB: INFO */}
            {profileTab === "info" && (
              <div className="space-y-3 text-xs text-stone-700 bg-white/60 p-4 rounded-2xl">
                <div className="grid grid-cols-2 gap-3">
                  <p>
                    <b>CPF:</b> {viewingClient.cpf || "Não informado"}
                  </p>
                  <p>
                    <b>WhatsApp:</b> {viewingClient.whatsapp}
                  </p>
                  <p>
                    <b>E-mail:</b> {viewingClient.email || "Não informado"}
                  </p>
                  <p>
                    <b>Telefone:</b> {viewingClient.phone || "Não informado"}
                  </p>
                  <p>
                    <b>Instagram:</b> {viewingClient.instagram || "—"}
                  </p>
                  <p>
                    <b>Data de Cadastro:</b> {fmtDate(viewingClient.createdAt)}
                  </p>
                </div>
                <div className="pt-2 border-t border-stone-200">
                  <p>
                    <b>Endereço Completo:</b> {viewingClient.address}{" "}
                    {viewingClient.number ? `, nº ${viewingClient.number}` : ""}{" "}
                    {viewingClient.complement ? `(${viewingClient.complement})` : ""}
                  </p>
                  <p>
                    <b>Bairro / Cidade:</b> {viewingClient.neighborhood || "—"} -{" "}
                    {viewingClient.city || "—"}/{viewingClient.state || "—"} (CEP: {viewingClient.cep || "—"})
                  </p>
                </div>
                {viewingClient.notes && (
                  <div className="pt-2 border-t border-stone-200">
                    <p>
                      <b>Observações:</b> {viewingClient.notes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB: EVENTS */}
            {profileTab === "events" && (
              <div className="space-y-2">
                {(eventsList || [])
                  .filter((ev) => ev.clientId === viewingClient.id || ev.clientName === viewingClient.name)
                  .map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-xl bg-white p-3 border border-stone-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-stone-800">
                          {ev.theme} ({ev.type})
                        </p>
                        <p className="text-stone-500">
                          Data: {fmtDate(ev.date)} • Retirada: {fmtDate(ev.pickupDate)} • Devolução:{" "}
                          {fmtDate(ev.returnDate)}
                        </p>
                      </div>
                      <Badge color={ev.status === "Finalizado" ? "green" : "lilac"}>{ev.status}</Badge>
                    </div>
                  ))}
              </div>
            )}

            {/* TAB: QUOTES */}
            {profileTab === "quotes" && (
              <div className="space-y-2">
                {quotes
                  .filter((q) => q.clientId === viewingClient.id || q.clientName === viewingClient.name)
                  .map((q) => (
                    <div
                      key={q.id}
                      className="rounded-xl bg-white p-3 border border-stone-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-stone-800">{q.theme}</p>
                        <p className="text-stone-500">Data: {fmtDate(q.date)}</p>
                      </div>
                      <span className="font-bold text-stone-800">{brl(q.value + (q.delivery || 0))}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* TAB: CONTRACTS */}
            {profileTab === "contracts" && (
              <div className="space-y-2">
                {contracts
                  .filter((c) => c.clientId === viewingClient.id || c.clientName === viewingClient.name)
                  .map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl bg-white p-3 border border-stone-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-stone-800">{c.theme}</p>
                        <p className="text-stone-500">
                          {c.signed ? `Assinado por ${c.signature}` : "Aguardando assinatura"}
                        </p>
                      </div>
                      <Badge color={c.signed ? "green" : "amber"}>
                        {c.signed ? "Assinado" : "Pendente"}
                      </Badge>
                    </div>
                  ))}
              </div>
            )}

            {/* TAB: FINANCES */}
            {profileTab === "finances" && (
              <div className="space-y-2">
                {transactions
                  .filter(
                    (t) =>
                      (t.clientId && t.clientId === viewingClient.id) ||
                      (t.client && t.client.toLowerCase() === viewingClient.name.toLowerCase())
                  )
                  .map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl bg-white p-3 border border-stone-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-stone-800">{t.description}</p>
                        <p className="text-stone-500">
                          {fmtDate(t.date)} • {t.method || "Pix"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-600 block">+{brl(t.amount)}</span>
                        <Badge color={t.status === "Pago" ? "green" : "amber"}>{t.status}</Badge>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => setViewingClient(null)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
