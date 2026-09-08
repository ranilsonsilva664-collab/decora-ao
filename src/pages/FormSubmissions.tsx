import { useState } from "react";
import { Card, SectionTitle, Button, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { fmtDate } from "../lib/format";
import { waLink } from "../lib/helpers";
import { useToast } from "../components/Toast";
import type { PublicFormSubmission } from "../lib/types";

export default function FormSubmissions() {
  const { formSubmissions, setFormSubmissions, tenantId, logAction } = useStore();
  const toast = useToast();
  const [selected, setSelected] = useState<PublicFormSubmission | null>(null);

  const safeSubmissions = formSubmissions || [];

  const formUrl = `${window.location.origin}/formulario/${tenantId}`;

  const markProcessed = (id: string) => {
    const updated = safeSubmissions.map((s) =>
      s.id === id ? { ...s, status: "Processado" as const } : s
    );
    setFormSubmissions(updated);
    toast("Formulário marcado como processado!");
  };

  const deleteSubmission = (id: string) => {
    if (confirm("Remover este registro de formulário?")) {
      setFormSubmissions(safeSubmissions.filter((s) => s.id !== id));
      toast("Registro removido");
    }
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Formulários Recebidos"
        subtitle="Leads e clientes que preencheram o formulário pelo celular"
        action={
          <div className="flex gap-2">
            <Button
              variant="soft"
              onClick={() => {
                navigator.clipboard.writeText(formUrl);
                toast("Link do formulário copiado!");
              }}
            >
              <Icon.copy className="h-4 w-4" /> Copiar Link
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Olá! Para agilizarmos o orçamento da sua festa Pegue e Monte, preencha este formulário rápido pelo celular:\n\n${formUrl}`
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="wa">
                <Icon.wa className="h-4 w-4" /> Compartilhar no WhatsApp
              </Button>
            </a>
          </div>
        }
      />

      <Card className="bg-gradient-to-br from-lilac-50 to-pink-50 border-lilac-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-stone-800 text-base flex items-center gap-2">
              <span className="text-xl">📲</span> Link do Formulário para Clientes
            </h3>
            <p className="text-xs text-stone-600 mt-1">
              Envie esse link para clientes no WhatsApp ou coloque na sua bio do Instagram. Os dados
              preenchidos caem automaticamente no CRM, criando o cadastro da cliente e o evento!
            </p>
          </div>
          <code className="rounded-xl bg-white px-3 py-2 text-xs text-stone-600 font-mono border border-stone-200 truncate max-w-xs">
            {formUrl}
          </code>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {safeSubmissions.map((sub) => {
          return (
            <Card key={sub.id} className="animate-rise flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-bold text-stone-800 text-base leading-tight">{sub.clientName}</h3>
                    <p className="text-xs text-stone-500">
                      Recebido em {fmtDate(sub.createdAt || new Date().toISOString())}
                    </p>
                  </div>
                  <Badge color={sub.status === "Novo" ? "blue" : "green"}>{sub.status}</Badge>
                </div>

                <div className="space-y-1.5 rounded-2xl bg-white/70 p-3 text-xs text-stone-700">
                  <p>
                    🎉 <b>Tema:</b> {sub.theme} ({sub.eventType})
                  </p>
                  <p>
                    🗓️ <b>Data da Festa:</b> {fmtDate(sub.eventDate)} às {sub.eventTime || "14:00"}
                  </p>
                  {sub.birthdayPerson && (
                    <p>
                      🎂 <b>Aniversariante:</b> {sub.birthdayPerson} {sub.age ? `(${sub.age})` : ""}
                    </p>
                  )}
                  <p>
                    📱 <b>WhatsApp:</b> {sub.whatsapp}
                  </p>
                  {sub.city && (
                    <p>
                      📍 <b>Local:</b> {sub.city}/{sub.state}
                    </p>
                  )}
                  {sub.notes && <p className="line-clamp-2 text-stone-500 italic mt-1">"{sub.notes}"</p>}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-2">
                <a
                  href={waLink(
                    sub.whatsapp,
                    `Olá ${sub.clientName}! Recebi seu formulário para a festa com o tema *${sub.theme}* em ${fmtDate(
                      sub.eventDate
                    )} 💕 Vamos montar seu orçamento?`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1"
                >
                  <Button variant="wa" className="w-full !py-2 text-xs">
                    <Icon.wa className="h-3.5 w-3.5" /> Chamar no WhatsApp
                  </Button>
                </a>
                {sub.status === "Novo" && (
                  <Button
                    variant="soft"
                    className="!py-2 text-xs"
                    onClick={() => markProcessed(sub.id)}
                  >
                    Marcar Lido
                  </Button>
                )}
                <button
                  onClick={() => deleteSubmission(sub.id)}
                  className="grid h-8 w-8 place-items-center rounded-xl bg-white/70 text-stone-400 hover:text-rose-500"
                >
                  ✕
                </button>
              </div>
            </Card>
          );
        })}

        {safeSubmissions.length === 0 && (
          <div className="col-span-full py-16 text-center text-stone-400">
            <span className="text-4xl block mb-2">📋</span>
            <p className="font-medium text-base text-stone-600">Nenhum formulário recebido ainda</p>
            <p className="text-xs text-stone-400 mt-1">
              Compartilhe seu link do formulário com as clientes para começar a receber cadastros
              automáticos!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
