import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { TenantData, Contract, CompanySettings } from "../lib/types";
import { brl, fmtDate } from "../lib/format";
import { waLink } from "../lib/helpers";
import { sanitizeContract, sanitizeForFirestore } from "../lib/firestoreUtils";

export default function PublicSign({
  tenantId,
  contractId,
}: {
  tenantId: string;
  contractId: string;
}) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [companySettings, setCompanySettings] = useState<Partial<CompanySettings>>({});
  const [companyName, setCompanyName] = useState("RAYDECOR Pegue e Monte");
  const [companyLogo, setCompanyLogo] = useState(
    "https://res.cloudinary.com/dmxeqe939/image/upload/v1785097595/ChatGPT_Image_26_de_jul._de_2026_17_25_48_ilxojd.png"
  );
  const [loading, setLoading] = useState(true);
  const [signerName, setSignerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [signedSuccess, setSignedSuccess] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const cleanTenant = (tenantId || "").trim();
        const cleanContractId = (contractId || "").trim();
        const tenantCandidates = Array.from(
          new Set([cleanTenant, cleanTenant.toUpperCase(), cleanTenant.toLowerCase()].filter(Boolean))
        );

        let foundContract: Contract | null = null;
        let loadedCompanySettings: Partial<CompanySettings> = {};

        // 1. Tenta buscar direto no documento individual em public_contracts
        for (const tId of tenantCandidates) {
          try {
            const pubSnap = await getDoc(doc(db, "public_contracts", `${tId}_${cleanContractId}`));
            if (pubSnap.exists()) {
              const pubData = pubSnap.data() as any;
              if (pubData.companySettings) {
                loadedCompanySettings = pubData.companySettings;
              }
              foundContract = sanitizeContract(pubData);
              break;
            }
          } catch (e) {
            console.warn("Aviso ao buscar em public_contracts:", e);
          }
        }

        // 2. Fallback: busca no array tenant_data
        if (!foundContract) {
          for (const tId of tenantCandidates) {
            try {
              const snap = await getDoc(doc(db, "tenant_data", tId));
              if (snap.exists()) {
                const tData = snap.data() as Partial<TenantData>;
                if (tData.companySettings) {
                  loadedCompanySettings = { ...loadedCompanySettings, ...tData.companySettings };
                }
                const found = (tData.contracts || []).find(
                  (c) => c.id === cleanContractId || (c.id && c.id.trim() === cleanContractId)
                );
                if (found) {
                  foundContract = sanitizeContract(found);
                  break;
                }
              }
            } catch (e) {
              console.warn("Aviso ao buscar em tenant_data:", e);
            }
          }
        }

        if (loadedCompanySettings) {
          setCompanySettings(loadedCompanySettings);
          if (loadedCompanySettings.tradeName || loadedCompanySettings.name) {
            setCompanyName(loadedCompanySettings.tradeName || loadedCompanySettings.name || "RAYDECOR Pegue e Monte");
          }
          if (loadedCompanySettings.logo) {
            setCompanyLogo(loadedCompanySettings.logo);
          }
        }

        if (foundContract) {
          setContract(foundContract);
          setSignerName(foundContract.clientName || "");
          if (foundContract.signed) {
            setSignedSuccess(true);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar contrato:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantId, contractId]);

  // Canvas drawing handlers
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = "#4a044e";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    drawing.current = false;
  };

  const clearCanvas = () => {
    const cv = canvasRef.current;
    if (cv) {
      cv.getContext("2d")!.clearRect(0, 0, cv.width, cv.height);
    }
  };

  const handleConfirmSign = async () => {
    if (!signerName.trim()) {
      alert("Por favor, digite seu nome completo para assinar.");
      return;
    }
    if (!contract) return;

    setSaving(true);
    try {
      let signatureImg = "";
      if (canvasRef.current) {
        try {
          signatureImg = canvasRef.current.toDataURL("image/png");
        } catch (e) {
          console.error("Erro ao converter assinatura:", e);
        }
      }

      const signedContract: Contract = sanitizeContract({
        ...contract,
        signed: true,
        signature: signerName.trim(),
        signatureImage: signatureImg || contract.signatureImage || "",
        signedAt: new Date().toISOString(),
        status: "Assinado",
        signerIp: window.navigator.userAgent,
      });

      const cleanTenant = (tenantId || "").trim();
      const tenantCandidates = Array.from(
        new Set([cleanTenant, cleanTenant.toUpperCase(), cleanTenant.toLowerCase()].filter(Boolean))
      );

      // Salva no documento individual em public_contracts
      for (const tId of tenantCandidates) {
        try {
          await setDoc(
            doc(db, "public_contracts", `${tId}_${contract.id}`),
            sanitizeForFirestore({
              ...signedContract,
              tenantId: tId,
              companySettings,
              updatedAt: new Date().toISOString(),
            }),
            { merge: true }
          );
        } catch (pubErr) {
          console.warn("Aviso ao salvar public_contracts:", pubErr);
        }
      }

      // Atualiza também na lista do tenant_data
      for (const tId of tenantCandidates) {
        try {
          const snap = await getDoc(doc(db, "tenant_data", tId));
          if (snap.exists()) {
            const tData = snap.data() as Partial<TenantData>;
            const existingContracts = (tData.contracts || []).map(sanitizeContract);
            const updatedContracts = existingContracts.some((c) => c.id === contract.id)
              ? existingContracts.map((c) => (c.id === contract.id ? signedContract : c))
              : [signedContract, ...existingContracts];

            const newLog = {
              id: "log-" + Date.now(),
              timestamp: new Date().toISOString(),
              action: "Contrato Assinado Digitalmente",
              details: `Contrato de ${signerName.trim()} assinado via link público pelo celular`,
              user: "Cliente (Online)",
            };

            await setDoc(
              doc(db, "tenant_data", tId),
              sanitizeForFirestore({
                contracts: updatedContracts,
                actionLogs: [newLog, ...(tData.actionLogs || [])].slice(0, 100),
              }),
              { merge: true }
            );
            break;
          }
        } catch (tErr) {
          console.warn(`Aviso ao atualizar tenant_data ${tId}:`, tErr);
        }
      }

      setContract(signedContract);
      setSignedSuccess(true);
    } catch (err) {
      console.error("Erro ao registrar assinatura:", err);
      alert("Erro ao registrar assinatura. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fdf2f8]">
        <div className="flex flex-col items-center gap-3 text-stone-500">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500" />
          <p className="font-medium text-sm">Carregando contrato...</p>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fdf2f8] p-4 text-center">
        <div className="max-w-sm rounded-3xl bg-white p-8 shadow-xl space-y-4 border border-pink-100">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-2xl">
            📋
          </div>
          <h2 className="text-xl font-bold text-stone-800">Contrato não encontrado</h2>
          <p className="text-xs text-stone-500 leading-relaxed">
            Este link pode estar temporariamente indisponível, expirado ou o contrato foi atualizado pela empresa.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-pink-500 py-2.5 text-xs font-bold text-white shadow-md shadow-pink-200 hover:bg-pink-600 transition"
            >
              🔄 Recarregar Página
            </button>
            {(companySettings?.whatsapp || companySettings?.phone) && (
              <a
                href={waLink(
                  companySettings.whatsapp || companySettings.phone || "",
                  "Olá! Tentei acessar o link de assinatura do meu contrato mas apareceu indisponível. Poderia me enviar novamente?"
                )}
                target="_blank"
                rel="noreferrer"
                className="w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-200 hover:bg-emerald-600 transition inline-block text-center"
              >
                💬 Falar com a Empresa no WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fdf2f8] via-[#faf5ff] to-[#f8fafc] py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-1 shadow-lg shadow-pink-200/50">
            <img src={companyLogo} alt="Logo" className="h-full w-full rounded-xl object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800">{companyName}</h1>
          <p className="text-xs text-stone-500">Assinatura Digital de Contrato de Locação</p>
        </div>

        {signedSuccess ? (
          <div className="rounded-3xl bg-white p-8 shadow-xl text-center border border-white space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-3xl">
              ✍️
            </div>
            <h2 className="text-2xl font-bold text-stone-800">Contrato Assinado com Sucesso!</h2>
            <p className="text-sm text-stone-600">
              Obrigado, <b>{signerName || contract.signature}</b>! Sua assinatura digital foi
              registrada e o contrato está confirmado.
            </p>
            <div className="rounded-2xl bg-pink-50 p-4 text-xs text-pink-700 font-medium">
              Sua decoração está 100% garantida para a data <b>{fmtDate(contract.partyDate)}</b> 💕
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              {(companySettings?.whatsapp || companySettings?.phone) && (
                <a
                  href={waLink(
                    companySettings.whatsapp || companySettings.phone || "",
                    `Olá! Acabei de assinar digitalmente o contrato da minha festa (${contract.theme}). Muito obrigada!`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600 inline-block text-center transition"
                >
                  💬 Avisar no WhatsApp da Empresa
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Resumo do Contrato */}
            <div className="rounded-3xl bg-white/90 p-6 backdrop-blur-xl shadow-xl shadow-pink-100/50 border border-white space-y-4">
              <div className="flex justify-between items-start border-b border-stone-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-pink-500 uppercase tracking-wider">
                    Contratante
                  </span>
                  <h3 className="font-bold text-stone-800 text-base">{contract.clientName}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 mt-1">
                    {contract.cpf && <span>CPF: <b className="text-stone-700">{contract.cpf}</b></span>}
                    {(contract.whatsapp || contract.clientPhone) && (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                        📱 WhatsApp: {contract.whatsapp || contract.clientPhone}
                      </span>
                    )}
                  </div>
                </div>
                <span className="rounded-2xl bg-pink-100 text-pink-600 px-3 py-1 font-bold text-sm">
                  {brl(contract.value)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-stone-600">
                <p>
                  🎉 <b>Tema:</b> {contract.theme}
                </p>
                <p>
                  🗓️ <b>Data da Festa:</b> {fmtDate(contract.partyDate)}
                </p>
                <p>
                  📦 <b>Retirada:</b> {fmtDate(contract.pickupDate || contract.partyDate)}
                </p>
                <p>
                  ↩️ <b>Devolução:</b> {fmtDate(contract.returnDate || contract.partyDate)}
                </p>
              </div>

              {/* Cláusulas */}
              <div className="pt-2 border-t border-stone-100">
                <p className="text-xs font-bold text-stone-700 mb-1">Termos e Regras do Contrato:</p>
                <div className="max-h-48 overflow-y-auto rounded-2xl bg-stone-50 p-3 text-xs text-stone-600 whitespace-pre-line leading-relaxed border border-stone-200">
                  {contract.customTerms || "Conforme regras de conservação e devolução acordadas."}
                </div>
              </div>
            </div>

            {/* Quadro de Assinatura */}
            <div className="rounded-3xl bg-white/90 p-6 backdrop-blur-xl shadow-xl shadow-pink-100/50 border border-white space-y-4">
              <h3 className="font-bold text-stone-800 text-sm flex items-center gap-2">
                <span>✍️</span> Assine na tela abaixo com o dedo:
              </h3>

              <canvas
                ref={canvasRef}
                width={400}
                height={150}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className="w-full touch-none rounded-2xl border-2 border-dashed border-pink-300 bg-white"
              />

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="rounded-xl bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-200"
                >
                  Limpar Assinatura
                </button>
                <span className="text-[11px] text-stone-400">Assinatura digital válida</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Seu Nome Completo (para validação) *
                </label>
                <input
                  type="text"
                  required
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Digite seu nome completo"
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 font-semibold"
                />
              </div>

              <button
                type="button"
                onClick={handleConfirmSign}
                disabled={saving || !signerName.trim()}
                className="w-full rounded-2xl bg-gradient-to-r from-pink-500 via-rose-400 to-purple-500 py-4 font-bold text-white shadow-xl shadow-pink-200 transition hover:opacity-95 disabled:opacity-50 text-base"
              >
                {saving ? "Registrando Assinatura..." : "Confirmar Assinatura Digital ✨"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
