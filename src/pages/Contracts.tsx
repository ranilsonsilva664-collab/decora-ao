import { useRef, useState } from "react";
import { Card, SectionTitle, Button, Modal, Field, Input, Select, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { brl, fmtDate, uid } from "../lib/format";
import { copy, waLink, normalizeWaPhone } from "../lib/helpers";
import { useToast } from "../components/Toast";
import type { Contract, ContractStatus } from "../lib/types";
import { downloadContractPdf } from "../utils/contractPdf";
import { sanitizeContract } from "../lib/firestoreUtils";

export default function Contracts() {
  const {
    contracts,
    setContracts,
    clients,
    setClients,
    themes,
    events,
    setEvents,
    companySettings,
    contractRules,
    setContractRules,
    tenantId,
    logAction,
  } = useStore();

  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [shareContract, setShareContract] = useState<Contract | null>(null);
  const [sharePhone, setSharePhone] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  const emptyContract = (): Contract =>
    sanitizeContract({
      id: uid(),
      clientName: "",
      whatsapp: "",
      cpf: "",
      partyDate: new Date().toISOString().slice(0, 10),
      theme: "",
      items: [],
      value: 0,
      deposit: 0,
      delivery: 0,
      assembly: 0,
      discount: 0,
      pickupDate: new Date().toISOString().slice(0, 10),
      pickupTime: "09:00",
      returnDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      returnTime: "12:00",
      signed: false,
      signature: "",
      status: "Pendente",
      createdAt: new Date().toISOString().slice(0, 10),
      customTerms: companySettings.terms || contractRules || "",
    });

  const [c, setC] = useState<Contract>(emptyContract());
  const [signOpen, setSignOpen] = useState<Contract | null>(null);
  const [sigName, setSigName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const getSignLink = (contractId: string) =>
    `${window.location.origin}/assinar/${tenantId}/${contractId}`;

  const contractText = (item: Contract) => {
    const signUrl = getSignLink(item.id);
    const clientPhone = item.whatsapp || item.clientPhone || "";
    return (
      `📑 *CONTRATO DE LOCAÇÃO — ${companySettings.tradeName || companySettings.name || "Pegue e Monte"}*\n\n` +
      `👤 *Contratante:* ${item.clientName} (CPF ${item.cpf || "—"})\n` +
      (clientPhone ? `📱 *WhatsApp:* ${clientPhone}\n` : "") +
      `🎉 *Tema:* ${item.theme} • Festa em ${fmtDate(item.partyDate)}\n` +
      `📦 *Retirada:* ${fmtDate(item.pickupDate || item.partyDate)}\n` +
      `↩️ *Devolução:* ${fmtDate(item.returnDate || item.partyDate)}\n\n` +
      `💰 *Valor total:* ${brl(item.value)}\n` +
      `💳 *Sinal (reserva):* ${brl(item.deposit)}\n` +
      `📌 *Saldo restante:* ${brl(item.value - item.deposit)}\n\n` +
      (item.signed
        ? `✍️ *Status: ASSINADO DIGITALMENTE* por ${item.signature}\nData: ${
            item.signedAt ? fmtDate(item.signedAt) : "Confirmado"
          }`
        : `✍️ *Para assinar pelo celular, clique no link abaixo:*\n${signUrl}`)
    );
  };

  const save = () => {
    if (!c.clientName.trim()) return toast("Informe a cliente");
    const exists = contracts.some((x) => x.id === c.id);
    const sanitized = sanitizeContract({
      ...c,
      clientName: c.clientName.trim(),
      customTerms: c.customTerms || companySettings.terms || contractRules || "",
    });
    const updated = exists ? contracts.map((x) => (x.id === c.id ? sanitized : x)) : [sanitized, ...contracts];
    setContracts(updated);

    // REQUISITO: Assim que o contrato for gerado ir automaticamente para agenda na data preenchida
    if (sanitized.partyDate) {
      const alreadyScheduled = (events || []).some(
        (ev) =>
          ev.date === sanitized.partyDate &&
          ev.clientName.trim().toLowerCase() === sanitized.clientName.trim().toLowerCase()
      );
      if (!alreadyScheduled) {
        const newCalendarEvent = {
          id: uid(),
          theme: sanitized.theme || "Decoração Pegue e Monte",
          clientName: sanitized.clientName,
          date: sanitized.partyDate,
          setupTime: sanitized.pickupTime || "09:00",
          pickupTime: sanitized.pickupTime || "09:00",
          returnTime: sanitized.returnTime || "12:00",
        };
        setEvents([newCalendarEvent, ...(events || [])]);
      }
    }

    setOpen(false);
    logAction(
      exists ? "Contrato Atualizado" : "Novo Contrato Gerado",
      `${sanitized.clientName} - ${sanitized.theme} (${brl(sanitized.value)})`
    );
    toast(exists ? "Contrato atualizado!" : "Contrato gerado e agendado no calendário!");
  };

  // Canvas Handlers
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = "#4a044e";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => (drawing.current = false);
  const clearSig = () => {
    const cv = canvasRef.current!;
    cv.getContext("2d")!.clearRect(0, 0, cv.width, cv.height);
  };

  const confirmSign = () => {
    if (!sigName.trim() && signOpen) return toast("Digite o nome completo para assinar");
    if (!signOpen) return;

    let signatureImg = "";
    if (canvasRef.current) {
      try {
        signatureImg = canvasRef.current.toDataURL("image/png");
      } catch (e) {
        console.error("Erro ao converter assinatura:", e);
      }
    }

    const updatedContract = sanitizeContract({
      ...signOpen,
      signed: true,
      signature: sigName.trim(),
      signatureImage: signatureImg || signOpen.signatureImage || "",
      signedAt: new Date().toISOString(),
      status: "Assinado" as ContractStatus,
    });

    setContracts(
      contracts.map((x) => (x.id === signOpen.id ? updatedContract : x))
    );
    logAction("Contrato Assinado", `Contrato #${signOpen.id} assinado por ${sigName.trim()}`);
    setSignOpen(null);
    setSigName("");
    toast("Contrato assinado digitalmente! ✍️");
  };

  // REQUISITO: BAIXAR PDF PROFISSIONAL DE CONTRATO (DIRETO NO DISPOSITIVO)
  const handleDownloadPdf = async (item: Contract) => {
    try {
      setDownloadingId(item.id);
      toast("Gerando arquivo PDF...");
      await downloadContractPdf({
        contract: item,
        companySettings,
        contractRules,
        tenantId,
        onProgress: (status) => toast(status),
      });
      toast("PDF baixado com sucesso! 📄");
    } catch (err) {
      console.error("Erro ao baixar PDF:", err);
      toast("Erro ao gerar PDF do contrato.");
    } finally {
      setDownloadingId(null);
    }
  };

  // REQUISITO: ENVIAR LINK PARA O CLIENTE ASSINAR DIGITALMENTE
  const openShareModal = (item: Contract) => {
    const client = clients.find(
      (cl) =>
        (item.clientId && cl.id === item.clientId) ||
        (item.cpf && cl.cpf && cl.cpf.replace(/\D/g, "") === item.cpf.replace(/\D/g, "")) ||
        cl.name.trim().toLowerCase() === item.clientName.trim().toLowerCase()
    );
    const signUrl = getSignLink(item.id);
    const phone =
      item.whatsapp ||
      (item as any).clientPhone ||
      client?.whatsapp ||
      client?.phone ||
      "";
    setSharePhone(phone);
    setShareContract(item);
    setShareMessage(
      `Olá, ${item.clientName}! 💕\n` +
      `Aqui é da equipe da ${companySettings.tradeName || companySettings.name || "nossa empresa"}.\n\n` +
      `Já preparamos o seu *Contrato de Locação* para o evento no dia *${fmtDate(item.partyDate)}* (Tema: ${item.theme})! 🎉\n\n` +
      `💰 *Valor Total:* ${brl(item.value)}\n` +
      `💳 *Sinal (Reserva):* ${brl(item.deposit)}\n` +
      `📌 *Saldo Restante na Retirada:* ${brl(item.value - item.deposit)}\n\n` +
      `✍️ *Para conferir os detalhes e assinar com o dedo direto pelo celular, clique no link seguro:*\n` +
      `${signUrl}\n\n` +
      `Qualquer dúvida estamos à disposição! ✨`
    );
  };

  const handleOpenWhatsapp = () => {
    const clean = normalizeWaPhone(sharePhone);
    if (!clean) {
      toast("Por favor, informe o WhatsApp da cliente com DDD.");
      return;
    }

    if (shareContract) {
      // Salva o WhatsApp atualizado no contrato
      const updatedContracts = contracts.map((ct) =>
        ct.id === shareContract.id
          ? { ...ct, whatsapp: sharePhone, clientPhone: sharePhone }
          : ct
      );
      setContracts(updatedContracts);

      // Sincroniza também no cadastro da cliente se ela existir
      const client = clients.find(
        (cl) =>
          (shareContract.clientId && cl.id === shareContract.clientId) ||
          (shareContract.cpf && cl.cpf && cl.cpf.replace(/\D/g, "") === shareContract.cpf.replace(/\D/g, "")) ||
          cl.name.trim().toLowerCase() === shareContract.clientName.trim().toLowerCase()
      );
      if (client && !client.whatsapp) {
        setClients(
          clients.map((cl) => (cl.id === client.id ? { ...cl, whatsapp: sharePhone } : cl))
        );
      }
    }

    const url = waLink(sharePhone, shareMessage);
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Contratos & Assinatura Digital"
        subtitle="Emissão de contratos profissionais com assinatura pelo celular e geração de PDF"
        action={
          <Button
            onClick={() => {
              setC(emptyContract());
              setOpen(true);
            }}
          >
            <Icon.plus className="h-4 w-4" /> Novo Contrato
          </Button>
        }
      />

      {/* Contracts List */}
      <div className="grid gap-4 lg:grid-cols-2">
        {contracts.map((item) => {
          const client = clients.find(
            (cl) => cl.name.toLowerCase() === item.clientName.toLowerCase()
          );
          const signUrl = getSignLink(item.id);

          return (
            <Card key={item.id} className="animate-rise flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-bold text-stone-800 text-base">{item.clientName}</h3>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-500 mt-0.5">
                      <span>CPF: {item.cpf || "Não informado"}</span>
                      <span>•</span>
                      <span>Tema: <b>{item.theme}</b></span>
                      {(item.whatsapp || item.clientPhone || client?.whatsapp) && (
                        <>
                          <span>•</span>
                          <a
                            href={waLink(item.whatsapp || item.clientPhone || client?.whatsapp || "", "")}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md"
                          >
                            <span>📱</span> {item.whatsapp || item.clientPhone || client?.whatsapp}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  {item.signed ? (
                    <Badge color="green">✍️ Assinado</Badge>
                  ) : (
                    <Badge color="amber">Aguardando Assinatura</Badge>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-white/60 py-2">
                    <p className="text-stone-400 text-[10px]">Data Festa</p>
                    <p className="font-semibold text-stone-700">{fmtDate(item.partyDate)}</p>
                  </div>
                  <div className="rounded-xl bg-white/60 py-2">
                    <p className="text-stone-400 text-[10px]">Valor Total</p>
                    <p className="font-semibold text-stone-700">{brl(item.value)}</p>
                  </div>
                  <div className="rounded-xl bg-white/60 py-2">
                    <p className="text-stone-400 text-[10px]">Sinal Pago</p>
                    <p className="font-semibold text-emerald-600">{brl(item.deposit)}</p>
                  </div>
                </div>

                {item.signed && (
                  <div className="mt-3 rounded-2xl bg-emerald-50/90 p-3 text-xs text-emerald-800 border border-emerald-200 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold flex items-center gap-1.5 text-emerald-700">
                        <span>✓</span> Assinado Digitalmente
                      </p>
                      <p className="text-[11px] text-emerald-600 mt-0.5">
                        Por <b>{item.signature}</b> {item.signedAt ? `em ${fmtDate(item.signedAt)}` : ""}
                      </p>
                    </div>
                    {item.signatureImage && (
                      <div className="rounded-xl bg-white p-1 border border-emerald-100 shadow-sm shrink-0">
                        <img src={item.signatureImage} alt="Assinatura" className="h-8 max-w-[110px] object-contain" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center gap-2">
                {/* Botão Baixar PDF DIRETO */}
                <Button
                  variant="gold"
                  disabled={downloadingId === item.id}
                  className="!px-3.5 !py-1.5 text-xs shadow-sm shadow-amber-200/50"
                  onClick={() => handleDownloadPdf(item)}
                >
                  <Icon.pdf className="h-4 w-4" />
                  {downloadingId === item.id ? "Baixando..." : "Baixar PDF"}
                </Button>

                {/* Botão Enviar p/ Cliente Assinar pelo WhatsApp */}
                <Button
                  variant="wa"
                  className="!px-3.5 !py-1.5 text-xs shadow-sm shadow-emerald-200/50"
                  onClick={() => openShareModal(item)}
                >
                  <Icon.wa className="h-4 w-4" /> Enviar p/ Assinar
                </Button>

                {!item.signed && (
                  <Button
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => {
                      setSignOpen(item);
                      setTimeout(clearSig, 50);
                    }}
                  >
                    ✍️ Assinar no App
                  </Button>
                )}

                <button
                  onClick={() => {
                    setC(item);
                    setOpen(true);
                  }}
                  className="ml-auto rounded-xl bg-white/80 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-white shadow-sm"
                >
                  Editar
                </button>
              </div>
            </Card>
          );
        })}

        {contracts.length === 0 && (
          <Card className="col-span-full text-center text-stone-400 py-12">
            Nenhum contrato gerado ainda 📑
          </Card>
        )}
      </div>

      {/* Regras Padrão de Contrato */}
      <Card>
        <SectionTitle
          title="Cláusulas e Regras Padrão de Contrato"
          subtitle="Estes termos são inseridos automaticamente em novos contratos"
        />
        <textarea
          className="w-full rounded-2xl border border-white/80 bg-white/60 p-4 text-xs text-stone-700 outline-none focus:ring-2 focus:ring-lilac-400 font-mono leading-relaxed"
          rows={7}
          value={contractRules}
          onChange={(e) => setContractRules(e.target.value)}
        />
      </Card>

      {/* MODAL: NOVO / EDITAR CONTRATO */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={contracts.some((x) => x.id === c.id) ? "Editar Contrato" : "Gerar Contrato"}
        wide
      >
        <div className="space-y-4 mt-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nome da Cliente">
              <Input
                list="cclist"
                value={c.clientName}
                onChange={(e) => {
                  const name = e.target.value;
                  const found = clients.find(
                    (cl) => cl.name.trim().toLowerCase() === name.trim().toLowerCase()
                  );
                  setC({
                    ...c,
                    clientName: name,
                    cpf: found?.cpf || c.cpf,
                    clientId: found?.id || c.clientId,
                    whatsapp: found?.whatsapp || found?.phone || c.whatsapp,
                  });
                }}
                placeholder="Selecione ou digite a cliente"
              />
              <datalist id="cclist">
                {clients.map((cl) => (
                  <option key={cl.id} value={cl.name} />
                ))}
              </datalist>
            </Field>

            <Field label="WhatsApp da Cliente">
              <Input
                value={c.whatsapp || ""}
                onChange={(e) => setC({ ...c, whatsapp: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </Field>

            <Field label="CPF da Cliente">
              <Input
                value={c.cpf || ""}
                onChange={(e) => setC({ ...c, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data da Festa">
              <Input
                type="date"
                value={c.partyDate}
                onChange={(e) => setC({ ...c, partyDate: e.target.value })}
              />
            </Field>
            <Field label="Tema Contratado">
              <Input
                list="cthemelist"
                value={c.theme}
                onChange={(e) => setC({ ...c, theme: e.target.value })}
                placeholder="Nome do tema"
              />
              <datalist id="cthemelist">
                {themes.map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data Retirada das Peças">
              <Input
                type="date"
                value={c.pickupDate || c.partyDate}
                onChange={(e) => setC({ ...c, pickupDate: e.target.value })}
              />
            </Field>
            <Field label="Data Devolução Prevista">
              <Input
                type="date"
                value={c.returnDate || c.partyDate}
                onChange={(e) => setC({ ...c, returnDate: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor Total do Contrato (R$)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={c.value === 0 || (c.value as any) === "" ? "" : c.value}
                placeholder="0.00"
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value;
                  setC({ ...c, value: val === "" ? ("" as any) : Number(val) });
                }}
              />
            </Field>
            <Field label="Valor do Sinal (R$)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={c.deposit === 0 || (c.deposit as any) === "" ? "" : c.deposit}
                placeholder="0.00"
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value;
                  setC({ ...c, deposit: val === "" ? ("" as any) : Number(val) });
                }}
              />
            </Field>
          </div>

          <Field label="Termos e Cláusulas Específicas do Contrato">
            <textarea
              className="w-full rounded-2xl border border-white/80 bg-white/60 p-4 text-xs text-stone-700 outline-none focus:ring-2 focus:ring-lilac-400 font-mono leading-relaxed"
              rows={6}
              value={c.customTerms || ""}
              onChange={(e) => setC({ ...c, customTerms: e.target.value })}
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {contracts.some((x) => x.id === c.id) && (
            <Button
              variant="soft"
              className="!text-rose-500"
              onClick={() => {
                if (confirm("Remover este contrato?")) {
                  setContracts(contracts.filter((x) => x.id !== c.id));
                  setOpen(false);
                  toast("Contrato removido");
                }
              }}
            >
              Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)} className="ml-auto">
            Cancelar
          </Button>
          <Button onClick={save}>Salvar Contrato</Button>
        </div>
      </Modal>

      {/* MODAL: ASSINATURA DIGITAL NO APP */}
      <Modal open={!!signOpen} onClose={() => setSignOpen(null)} title="Assinatura Digital no Celular">
        <p className="mb-3 text-xs text-stone-500">
          A cliente pode assinar diretamente na tela com o dedo ou caneta stylus.
        </p>
        <canvas
          ref={canvasRef}
          width={440}
          height={160}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full touch-none rounded-2xl border-2 border-dashed border-lilac-300 bg-white"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={clearSig}
            className="rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-white"
          >
            Limpar
          </button>
          <Input
            value={sigName}
            onChange={(e) => setSigName(e.target.value)}
            placeholder="Digite o nome completo da cliente"
          />
        </div>
        <div className="mt-5 flex gap-3">
          <Button variant="ghost" onClick={() => setSignOpen(null)} className="ml-auto">
            Cancelar
          </Button>
          <Button onClick={confirmSign}>Confirmar Assinatura</Button>
        </div>
      </Modal>

      {/* MODAL: ENVIAR LINK PARA O CLIENTE ASSINAR */}
      <Modal
        open={!!shareContract}
        onClose={() => setShareContract(null)}
        title="Enviar Contrato para Assinatura Digital"
      >
        {shareContract && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-pink-50 to-purple-50 p-4 border border-pink-100 text-xs">
              <p className="text-stone-800 font-bold text-sm mb-1">{shareContract.clientName}</p>
              <p className="text-stone-600">
                Tema: <b>{shareContract.theme}</b> • Data da Festa: <b>{fmtDate(shareContract.partyDate)}</b>
              </p>
              <p className="text-stone-600">
                Valor Total: <b>{brl(shareContract.value)}</b> (Sinal: {brl(shareContract.deposit)})
              </p>
            </div>

            <Field label="WhatsApp da Cliente (com DDD)">
              <Input
                value={sharePhone}
                onChange={(e) => setSharePhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
              <p className="mt-1 text-[11px] text-stone-500">
                💡 Informe com o DDD (ex: 81 99999-9999 ou 11 98888-7777). O código do país (+55) é inserido automaticamente para abrir direto no WhatsApp!
              </p>
            </Field>

            <Field label="Link de Assinatura Online">
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={getSignLink(shareContract.id)}
                  className="!bg-stone-50 text-xs font-mono"
                />
                <Button
                  variant="soft"
                  onClick={async () => {
                    await copy(getSignLink(shareContract.id));
                    toast("Link copiado com sucesso! 📋");
                  }}
                >
                  Copiar Link
                </Button>
              </div>
            </Field>

            <Field label="Mensagem Pronta para o WhatsApp da Cliente">
              <textarea
                rows={7}
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-white p-3 text-xs text-stone-700 outline-none focus:ring-2 focus:ring-pink-300 font-sans leading-relaxed"
              />
              <div className="mt-1 flex justify-end">
                <Button
                  variant="ghost"
                  className="!py-1 !px-2.5 text-[11px] text-stone-600"
                  onClick={async () => {
                    await copy(shareMessage);
                    toast("Mensagem copiada para o WhatsApp! 💬");
                  }}
                >
                  📋 Copiar Mensagem
                </Button>
              </div>
            </Field>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <Button
                variant="wa"
                className="flex-1 !py-3 text-xs font-bold justify-center shadow-md shadow-emerald-200"
                onClick={handleOpenWhatsapp}
              >
                <Icon.wa className="h-4 w-4" /> Abrir no WhatsApp da Cliente
              </Button>

              <Button
                variant="gold"
                disabled={downloadingId === shareContract.id}
                className="!py-3 text-xs justify-center"
                onClick={() => handleDownloadPdf(shareContract)}
              >
                <Icon.pdf className="h-4 w-4" /> Baixar PDF
              </Button>

              <a
                href={getSignLink(shareContract.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-block"
              >
                <Button variant="ghost" className="w-full !py-3 text-xs justify-center">
                  👁️ Testar Link
                </Button>
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
