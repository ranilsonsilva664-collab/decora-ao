import { useState } from "react";
import { Card, SectionTitle, Button, Badge, Modal, Field, Input } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { brl, fmtDate, uid } from "../lib/format";
import { copy, waLink } from "../lib/helpers";
import { useToast } from "../components/Toast";
import { sanitizeContract } from "../lib/firestoreUtils";
import type { PublicFormSubmission, Contract } from "../lib/types";

export default function FormSubmissions() {
  const {
    formSubmissions,
    setFormSubmissions,
    contracts,
    setContracts,
    events,
    setEvents,
    companySettings,
    contractRules,
    tenantId,
    logAction,
  } = useStore();

  const toast = useToast();
  const [editingContract, setEditingContract] = useState<Contract | null>(null);

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

  const findContractForSubmission = (sub: PublicFormSubmission): Contract | undefined => {
    return contracts.find(
      (c) =>
        (sub.contractId && c.id === sub.contractId) ||
        (sub.cpf && c.cpf && c.cpf.replace(/\D/g, "") === sub.cpf.replace(/\D/g, "")) ||
        (c.clientName.trim().toLowerCase() === sub.clientName.trim().toLowerCase() &&
          c.theme.trim().toLowerCase() === sub.theme.trim().toLowerCase()) ||
        c.clientName.trim().toLowerCase() === sub.clientName.trim().toLowerCase()
    );
  };

  const generateContractForSubmission = (sub: PublicFormSubmission) => {
    const contractId = uid();
    const newContract: Contract = sanitizeContract({
      id: contractId,
      clientId: sub.clientId || "",
      clientName: sub.clientName.trim(),
      whatsapp: sub.whatsapp.trim(),
      clientPhone: sub.whatsapp.trim(),
      cpf: sub.cpf.trim(),
      eventId: (sub as any).eventId || "",
      partyDate: sub.eventDate,
      theme: sub.theme.trim(),
      items: [],
      value: 0,
      deposit: 0,
      delivery: 0,
      assembly: 0,
      discount: 0,
      pickupDate: sub.eventDate,
      pickupTime: "09:00",
      returnDate: new Date(new Date(sub.eventDate).getTime() + 86400000).toISOString().slice(0, 10),
      returnTime: "12:00",
      signed: false,
      signature: "",
      status: "Pendente",
      customTerms: companySettings.terms || contractRules || "",
      createdAt: new Date().toISOString().slice(0, 10),
    });

    setContracts([newContract, ...contracts]);
    setFormSubmissions(
      safeSubmissions.map((s) => (s.id === sub.id ? { ...s, contractId } : s))
    );

    // REQUISITO: Automaticamente ir para a agenda na data preenchida
    if (newContract.partyDate) {
      const alreadyScheduled = (events || []).some(
        (ev) =>
          ev.date === newContract.partyDate &&
          ev.clientName.trim().toLowerCase() === newContract.clientName.trim().toLowerCase()
      );
      if (!alreadyScheduled) {
        const calEv = {
          id: uid(),
          theme: newContract.theme || "Decoração Pegue e Monte",
          clientName: newContract.clientName,
          date: newContract.partyDate,
          setupTime: newContract.pickupTime || "09:00",
          pickupTime: newContract.pickupTime || "09:00",
          returnTime: newContract.returnTime || "12:00",
        };
        setEvents([calEv, ...(events || [])]);
      }
    }

    logAction(
      "Contrato Gerado pelo Formulário",
      `Contrato #${newContract.id} gerado a partir do formulário de ${sub.clientName}`
    );
    toast("Contrato gerado e agendado no calendário com sucesso! 📄✨");
  };

  const saveEditedContract = () => {
    if (!editingContract) return;
    const sanitized = sanitizeContract(editingContract);
    setContracts(contracts.map((c) => (c.id === sanitized.id ? sanitized : c)));
    setEditingContract(null);
    toast("Contrato atualizado com sucesso! ✨");
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Formulários Recebidos"
        subtitle="Clientes que preencheram o formulário pelo celular com contrato gerado automaticamente"
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
              href={waLink(
                "",
                `Olá! Para agilizarmos o orçamento da sua festa Pegue e Monte, preencha este formulário rápido pelo celular:\n\n${formUrl}`
              )}
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

      <Card className="bg-gradient-to-br from-pink-50 via-purple-50 to-lilac-50 border-pink-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-stone-800 text-base flex items-center gap-2">
              <span className="text-xl">📲</span> Link do Formulário para Clientes
            </h3>
            <p className="text-xs text-stone-600 mt-1">
              Envie esse link para as clientes no WhatsApp ou na bio do Instagram. Quando a cliente preenche,
              o sistema cadastra a cliente, cria o evento e <b>já gera o contrato automaticamente</b> pronto para assinatura!
            </p>
          </div>
          <code className="rounded-xl bg-white px-3 py-2 text-xs text-stone-600 font-mono border border-stone-200 truncate max-w-xs">
            {formUrl}
          </code>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {safeSubmissions.map((sub) => {
          const contract = findContractForSubmission(sub);
          const signUrl = contract ? `${window.location.origin}/assinar/${tenantId}/${contract.id}` : "";

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
                  <div className="flex flex-col items-end gap-1">
                    <Badge color={sub.status === "Novo" ? "blue" : "green"}>{sub.status}</Badge>
                    {contract ? (
                      contract.signed ? (
                        <Badge color="green">✍️ Assinado</Badge>
                      ) : (
                        <Badge color="amber">📑 Contrato Gerado</Badge>
                      )
                    ) : null}
                  </div>
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

                  {contract && (
                    <div className="mt-2 pt-2 border-t border-pink-100 flex items-center justify-between text-[11px]">
                      <span className="text-stone-500 flex items-center gap-1 font-medium">
                        <span>📄</span> Contrato #{contract.id.slice(0, 6)}
                      </span>
                      <span className={contract.signed ? "font-bold text-emerald-600" : "font-semibold text-amber-600"}>
                        {contract.signed ? "✍️ Assinado" : contract.value > 0 ? brl(contract.value) : "Aguardando Assinatura"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 space-y-2">
                {contract ? (
                  <div className="flex flex-col gap-2">
                    <a
                      href={waLink(
                        sub.whatsapp,
                        `Olá, ${sub.clientName}! 💕\n` +
                        `Aqui é da equipe da ${companySettings.tradeName || companySettings.name || "nossa empresa"}.\n\n` +
                        `Já preparamos o seu *Contrato de Locação* através dos dados do formulário para a festa no dia *${fmtDate(sub.eventDate)}* (Tema: ${sub.theme})! 🎉\n\n` +
                        (contract.value > 0 ? `💰 *Valor Total:* ${brl(contract.value)}\n` : "") +
                        (contract.deposit > 0 ? `💳 *Sinal (Reserva):* ${brl(contract.deposit)}\n\n` : "\n") +
                        `✍️ *Para conferir os detalhes e assinar com o dedo direto pelo celular, clique no link seguro:*\n` +
                        `${signUrl}\n\n` +
                        `Qualquer dúvida estamos à disposição! ✨`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full"
                    >
                      <Button variant="wa" className="w-full !py-2 text-xs font-bold justify-center shadow-sm shadow-emerald-200">
                        <Icon.wa className="h-4 w-4" /> Enviar Contrato no WhatsApp
                      </Button>
                    </a>

                    <div className="flex gap-2">
                      <Button
                        variant="soft"
                        className="flex-1 !py-1.5 text-xs"
                        onClick={() => setEditingContract(contract)}
                      >
                        ✏️ Ajustar Contrato
                      </Button>
                      {sub.status === "Novo" && (
                        <Button
                          variant="ghost"
                          className="!py-1.5 text-xs"
                          onClick={() => markProcessed(sub.id)}
                        >
                          Marcar Lido
                        </Button>
                      )}
                      <button
                        onClick={() => deleteSubmission(sub.id)}
                        className="grid h-8 w-8 place-items-center rounded-xl bg-white/70 text-stone-400 hover:text-rose-500"
                        title="Remover formulário"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="gold"
                      className="w-full !py-2 text-xs font-bold justify-center"
                      onClick={() => generateContractForSubmission(sub)}
                    >
                      ⚡ Gerar Contrato Automaticamente
                    </Button>

                    <div className="flex gap-2">
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
                        <Button variant="wa" className="w-full !py-1.5 text-xs">
                          <Icon.wa className="h-3.5 w-3.5" /> Chamar WhatsApp
                        </Button>
                      </a>
                      {sub.status === "Novo" && (
                        <Button
                          variant="soft"
                          className="!py-1.5 text-xs"
                          onClick={() => markProcessed(sub.id)}
                        >
                          Lido
                        </Button>
                      )}
                      <button
                        onClick={() => deleteSubmission(sub.id)}
                        className="grid h-8 w-8 place-items-center rounded-xl bg-white/70 text-stone-400 hover:text-rose-500"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}

        {safeSubmissions.length === 0 && (
          <div className="col-span-full py-16 text-center text-stone-400">
            <span className="text-4xl block mb-2">📋</span>
            <p className="font-medium text-base text-stone-600">Nenhum formulário recebido ainda</p>
            <p className="text-xs text-stone-400 mt-1">
              Compartilhe seu link do formulário com as clientes para começar a receber cadastros e contratos
              automáticos!
            </p>
          </div>
        )}
      </div>

      {/* Modal para Ajustar / Visualizar Contrato Gerado */}
      {editingContract && (
        <Modal
          open={!!editingContract}
          onClose={() => setEditingContract(null)}
          title={`Ajustar Contrato — ${editingContract.clientName}`}
        >
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-pink-50 to-purple-50 p-4 border border-pink-100 text-xs space-y-1">
              <p className="font-bold text-sm text-stone-800">{editingContract.clientName}</p>
              <p className="text-stone-600">
                Tema: <b>{editingContract.theme}</b> • Data da Festa: <b>{fmtDate(editingContract.partyDate)}</b>
              </p>
              <p className="text-stone-600">
                CPF: <b>{editingContract.cpf || "Não informado"}</b> • WhatsApp: <b>{editingContract.whatsapp || "Não informado"}</b>
              </p>
              <p className="text-stone-600">
                Status da Assinatura:{" "}
                <b className={editingContract.signed ? "text-emerald-600" : "text-amber-600"}>
                  {editingContract.signed ? "✍️ Assinado Digitalmente" : "Aguardando Assinatura"}
                </b>
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor Total do Contrato (R$)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingContract.value === 0 || (editingContract.value as any) === "" ? "" : editingContract.value}
                  placeholder="0.00"
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingContract({
                      ...editingContract,
                      value: val === "" ? ("" as any) : Number(val),
                    });
                  }}
                />
              </Field>

              <Field label="Valor do Sinal / Reserva (R$)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingContract.deposit === 0 || (editingContract.deposit as any) === "" ? "" : editingContract.deposit}
                  placeholder="0.00"
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingContract({
                      ...editingContract,
                      deposit: val === "" ? ("" as any) : Number(val),
                    });
                  }}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data da Retirada">
                <Input
                  type="date"
                  value={editingContract.pickupDate || editingContract.partyDate}
                  onChange={(e) =>
                    setEditingContract({ ...editingContract, pickupDate: e.target.value })
                  }
                />
              </Field>

              <Field label="Data da Devolução">
                <Input
                  type="date"
                  value={editingContract.returnDate || editingContract.partyDate}
                  onChange={(e) =>
                    setEditingContract({ ...editingContract, returnDate: e.target.value })
                  }
                />
              </Field>
            </div>

            <Field label="Link Seguro para Cliente Assinar">
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/assinar/${tenantId}/${editingContract.id}`}
                  className="!bg-stone-50 text-xs font-mono"
                />
                <Button
                  variant="soft"
                  onClick={async () => {
                    await copy(`${window.location.origin}/assinar/${tenantId}/${editingContract.id}`);
                    toast("Link copiado com sucesso! 📋");
                  }}
                >
                  Copiar
                </Button>
              </div>
            </Field>

            <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row gap-2.5">
              <Button
                variant="primary"
                className="flex-1 !py-2.5 text-xs font-bold justify-center"
                onClick={saveEditedContract}
              >
                💾 Salvar Alterações
              </Button>

              <a
                href={waLink(
                  editingContract.whatsapp || "",
                  `Olá, ${editingContract.clientName}! 💕\n` +
                  `Aqui é da equipe da ${companySettings.tradeName || companySettings.name || "nossa empresa"}.\n\n` +
                  `Já atualizamos o seu *Contrato de Locação* para o evento no dia *${fmtDate(editingContract.partyDate)}* (Tema: ${editingContract.theme})! 🎉\n\n` +
                  (editingContract.value > 0 ? `💰 *Valor Total:* ${brl(editingContract.value)}\n` : "") +
                  (editingContract.deposit > 0 ? `💳 *Sinal (Reserva):* ${brl(editingContract.deposit)}\n\n` : "\n") +
                  `✍️ *Para conferir os detalhes e assinar com o dedo direto pelo celular, clique no link seguro:*\n` +
                  `${window.location.origin}/assinar/${tenantId}/${editingContract.id}\n\n` +
                  `Qualquer dúvida estamos à disposição! ✨`
                )}
                target="_blank"
                rel="noreferrer"
                className="flex-1"
              >
                <Button variant="wa" className="w-full !py-2.5 text-xs font-bold justify-center">
                  <Icon.wa className="h-4 w-4" /> Enviar WhatsApp
                </Button>
              </a>

              <Button
                variant="ghost"
                className="!py-2.5 text-xs justify-center"
                onClick={() => setEditingContract(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

