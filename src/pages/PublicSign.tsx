import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { TenantData, Contract } from "../lib/types";
import { brl, fmtDate } from "../lib/format";

export default function PublicSign({
  tenantId,
  contractId,
}: {
  tenantId: string;
  contractId: string;
}) {
  const [contract, setContract] = useState<Contract | null>(null);
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
        const snap = await getDoc(doc(db, "tenant_data", tenantId));
        if (snap.exists()) {
          const tData = snap.data() as Partial<TenantData>;
          if (tData.companySettings) {
            if (tData.companySettings.name) setCompanyName(tData.companySettings.name);
            if (tData.companySettings.logo) setCompanyLogo(tData.companySettings.logo);
          }
          const found = (tData.contracts || []).find((c) => c.id === contractId);
          if (found) {
            setContract(found);
            setSignerName(found.clientName || "");
            if (found.signed) setSignedSuccess(true);
          }
        }
      } catch (err) {
        console.error(err);
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

    setSaving(true);
    try {
      const snap = await getDoc(doc(db, "tenant_data", tenantId));
      if (!snap.exists()) return;

      const tData = snap.data() as Partial<TenantData>;
      const existingContracts = tData.contracts || [];

      const updatedContracts = existingContracts.map((c) => {
        if (c.id === contractId) {
          return {
            ...c,
            signed: true,
            signature: signerName.trim(),
            signedAt: new Date().toISOString(),
            status: "Assinado" as const,
            signerIp: window.navigator.userAgent,
          };
        }
        return c;
      });

      const newLog = {
        id: "log-" + Date.now(),
        timestamp: new Date().toISOString(),
        action: "Contrato Assinado Digitalmente",
        details: `Contrato de ${signerName} assinado via link público pelo celular`,
        user: "Cliente (Online)",
      };

      await setDoc(
        doc(db, "tenant_data", tenantId),
        {
          contracts: updatedContracts,
          actionLogs: [newLog, ...(tData.actionLogs || [])].slice(0, 100),
        },
        { merge: true }
      );

      setSignedSuccess(true);
    } catch (err) {
      console.error(err);
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
        <div className="max-w-sm rounded-3xl bg-white p-8 shadow-xl">
          <h2 className="text-xl font-bold text-stone-800">Contrato não encontrado</h2>
          <p className="mt-2 text-xs text-stone-500">
            Este link pode estar expirado ou o contrato foi removido.
          </p>
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
            <div className="rounded-2xl bg-pink-50 p-4 text-xs text-pink-700">
              Sua decoração está 100% garantida para a data <b>{fmtDate(contract.partyDate)}</b> 💕
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
                  {contract.cpf && <p className="text-xs text-stone-500">CPF: {contract.cpf}</p>}
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
