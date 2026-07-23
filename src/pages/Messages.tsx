import { useState } from "react";
import { Card, SectionTitle, Button, Badge, Select } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { copy, waLink, igLink } from "../lib/helpers";
import { useToast } from "../components/Toast";

export default function Messages() {
  const { templates, clients } = useStore();
  const toast = useToast();
  const [selected, setSelected] = useState("");

  const client = clients.find((c) => c.id === selected);
  const personalize = (body: string, targetClient?: any) => {
    const target = targetClient || client;
    return target ? body.replace(/Oii/g, `Oii ${target.name.split(" ")[0]}`) : body;
  };

  return (
    <div className="space-y-5">
      <SectionTitle title="WhatsApp & Instagram" subtitle="Atendimento rápido com mensagens prontas" />

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <span className="mb-1.5 block text-xs font-medium text-stone-500">Selecione um cliente (opcional)</span>
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">— Mensagem genérica —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          {client && (
            <div className="flex gap-2">
              {client.whatsapp && (
                <a href={waLink(client.whatsapp)} target="_blank" rel="noreferrer"><Button variant="wa"><Icon.wa className="h-4 w-4" /> Abrir conversa</Button></a>
              )}
              {client.instagram && (
                <a href={igLink(client.instagram)} target="_blank" rel="noreferrer"><Button variant="soft" className="!text-rose-500"><Icon.ig className="h-4 w-4" /> Instagram</Button></a>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {templates.map((m) => {
          const text = personalize(m.body);
          return (
            <Card key={m.id} className="animate-rise flex flex-col">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-nude-100 to-lilac-100 text-lg">{m.emoji}</span>
                <p className="font-semibold text-stone-800">{m.title}</p>
              </div>
              <p className="flex-1 whitespace-pre-line rounded-2xl bg-white/60 p-3 text-sm leading-relaxed text-stone-600">{text}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="soft" className="!px-3 !py-2 text-xs" onClick={async () => { await copy(text); toast("Mensagem copiada!"); }}><Icon.copy className="h-4 w-4" /> Copiar</Button>
                {client?.whatsapp ? (
                  <a href={waLink(client.whatsapp, text)} target="_blank" rel="noreferrer"><Button variant="wa" className="!px-3 !py-2 text-xs"><Icon.wa className="h-4 w-4" /> Enviar p/ {client.name.split(' ')[0]}</Button></a>
                ) : (
                  <div className="relative inline-block">
                    <select
                      title="Selecionar cliente"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const c = clients.find(x => x.id === e.target.value);
                        if (c?.whatsapp) {
                          window.open(waLink(c.whatsapp, personalize(m.body, c)), "_blank");
                        } else if (c) {
                          toast("Este cliente não tem WhatsApp cadastrado.");
                        }
                        e.target.value = "";
                      }}
                    >
                      <option value="">Selecione um cliente...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Button variant="soft" className="!px-3 !py-2 text-xs !bg-stone-200 !text-stone-600 pointer-events-none">
                      <Icon.wa className="h-4 w-4 opacity-50" /> Escolher e Enviar
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <SectionTitle title="Ações rápidas de atendimento" subtitle="Atalhos para o dia a dia" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { l: "Enviar orçamento", e: "🧾" },
            { l: "Enviar contrato", e: "📑" },
            { l: "Confirmar pagamento", e: "✅" },
            { l: "Confirmar montagem", e: "🚚" },
            { l: "Abrir WhatsApp", e: "💬" },
            { l: "Abrir Instagram", e: "📸" },
          ].map((a) => (
            <button
              key={a.l}
              onClick={() => {
                if (a.l === "Abrir WhatsApp" && client?.whatsapp) window.open(waLink(client.whatsapp), "_blank");
                else if (a.l === "Abrir Instagram" && client?.instagram) window.open(igLink(client.instagram), "_blank");
                else toast(client ? `${a.l} • ${client.name}` : "Selecione um cliente");
              }}
              className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/60 p-3 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-lilac-100"
            >
              <span className="text-xl">{a.e}</span>
              <span className="text-xs font-medium text-stone-600">{a.l}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
