import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useStore } from "../lib/store";
import type { Tenant, TenantStatus, PlanType } from "../lib/types";
import { waLink } from "../lib/helpers";
import { fmtDate, uid } from "../lib/format";
import { Icon } from "../components/icons";

export default function Admin() {
  const { logout } = useStore();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [planType, setPlanType] = useState<PlanType>("monthly");
  const [customDays, setCustomDays] = useState(30);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "tenants"), (snapshot) => {
      const data = snapshot.docs.map((d) => d.data() as Tenant);
      // Sort by creation date descending
      data.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      setTenants(data);
    });
    return () => unsub();
  }, []);

  const calculateExpiresAt = (type: PlanType, days = 30) => {
    const now = Date.now();
    if (type === "test") {
      return new Date(now + 24 * 60 * 60 * 1000).toISOString();
    }
    if (type === "monthly") {
      return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    if (type === "annual") {
      return new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString();
    }
    return new Date(now + days * 24 * 60 * 60 * 1000).toISOString();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;
    setLoading(true);

    const code = newCode.trim().toUpperCase();
    try {
      const expiresAt = calculateExpiresAt(planType, customDays);
      const newTenant: Tenant = {
        id: code,
        name: newName.trim(),
        whatsapp: newWhatsapp.replace(/\D/g, ""),
        planType,
        isTest: planType === "test",
        expiresAt,
        status: "active",
        createdAt: new Date().toISOString(),
        hasCustomKey: false,
      };

      await setDoc(doc(db, "tenants", code), newTenant);
      setNewCode("");
      setNewName("");
      setNewWhatsapp("");
      setPlanType("monthly");
      alert(`Acesso criado com sucesso para ${newTenant.name}!`);
    } catch (e) {
      console.error(e);
      alert("Erro ao criar acesso.");
    }
    setLoading(false);
  };

  const toggleStatus = async (tenant: Tenant) => {
    const newStatus: TenantStatus = tenant.status === "active" ? "blocked" : "active";
    try {
      await setDoc(doc(db, "tenants", tenant.id), { status: newStatus }, { merge: true });
    } catch (e) {
      alert("Erro ao atualizar status.");
    }
  };

  const handleRenew = async (tenant: Tenant, daysToAdd: number) => {
    const currentExpiry = tenant.expiresAt ? new Date(tenant.expiresAt).getTime() : Date.now();
    const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
    const newExpiresAt = new Date(baseTime + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

    try {
      await setDoc(
        doc(db, "tenants", tenant.id),
        {
          expiresAt: newExpiresAt,
          status: "active",
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      alert(
        `Acesso renovado com sucesso! Nova data de vencimento: ${new Date(newExpiresAt).toLocaleDateString("pt-BR")}`
      );
    } catch (err) {
      console.error(err);
      alert("Erro ao renovar plano.");
    }
  };

  const handleResetSecretKey = async (tenant: Tenant) => {
    const tempKey = `${tenant.name.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "FEST")}${Math.floor(1000 + Math.random() * 9000)}`;
    if (
      !confirm(
        `Deseja resetar a chave secreta de ${tenant.name}?\n\nIsso gerará uma nova chave provisória (${tempKey}) para a cliente entrar e redefinir novamente.`
      )
    ) {
      return;
    }

    try {
      // Re-enable initial key and clear private secret key
      await setDoc(
        doc(db, "tenants", tenant.id),
        {
          secretKey: null,
          hasCustomKey: false,
          id: tempKey,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // If document ID changed, also update alias
      await setDoc(doc(db, "tenants", tempKey), {
        ...tenant,
        id: tempKey,
        secretKey: null,
        hasCustomKey: false,
      });

      alert(`Chave provisória gerada: ${tempKey}\nVocê pode enviá-la para a cliente agora.`);
    } catch (err) {
      console.error(err);
      alert("Erro ao resetar chave.");
    }
  };

  const handleDelete = async (tenantId: string) => {
    if (!confirm(`Deseja mesmo excluir o acesso ${tenantId} e todos os seus dados? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "tenants", tenantId));
      await deleteDoc(doc(db, "tenant_data", tenantId));
      alert("Acesso excluído.");
    } catch (e) {
      alert("Erro ao excluir.");
    }
  };

  const getDaysLeft = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getPlanBadge = (tenant: Tenant) => {
    const days = getDaysLeft(tenant.expiresAt);
    const isExpired = days !== null && days <= 0;

    let planName = "Mensal (30 dias)";
    if (tenant.planType === "annual") planName = "Anual (365 dias)";
    else if (tenant.planType === "test" || tenant.isTest) planName = "Teste Grátis (24h)";
    else if (tenant.planType === "custom") planName = "Personalizado";

    return (
      <div className="space-y-1">
        <span className="inline-block rounded-md bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">
          {planName}
        </span>
        <div className="text-[11px] text-stone-500">
          <p>Início: {fmtDate(tenant.createdAt)}</p>
          <p>
            Vence em: <b>{tenant.expiresAt ? fmtDate(tenant.expiresAt) : "Sem limite"}</b>
          </p>
        </div>
        {days !== null && (
          <p
            className={`text-[11px] font-bold ${
              isExpired ? "text-rose-600" : days <= 5 ? "text-amber-600" : "text-emerald-600"
            }`}
          >
            {isExpired
              ? `⚠️ Vencido há ${Math.abs(days)} dia(s)`
              : days === 0
              ? "⚠️ Vence hoje!"
              : `🟢 Restam ${days} dia(s)`}
          </p>
        )}
      </div>
    );
  };

  const generateWelcomeMessage = (t: Tenant) => {
    const planText =
      t.planType === "annual"
        ? "Plano Anual (1 ano de acesso completo)"
        : t.planType === "monthly"
        ? "Plano Mensal (30 dias de acesso)"
        : t.isTest
        ? "Teste Grátis de 24 horas"
        : "Acesso Liberado";

    const expiryText = t.expiresAt ? fmtDate(t.expiresAt) : "Conforme combinado";
    const appUrl = `https://${window.location.host}/`;

    return (
      `Olá, ${t.name}! ✨\n\n` +
      `Seu acesso ao *CRM Pegue e Monte — RAYDECOR* está pronto e liberado!\n\n` +
      `📦 *Seu Plano:* ${planText}\n` +
      `📅 *Válido até:* ${expiryText}\n` +
      `🌐 *Link de Acesso:* ${appUrl}\n` +
      `🔑 *Sua Chave de Acesso Inicial:* *${t.id}*\n\n` +
      `🔒 *Dica de Segurança e Privacidade:*\n` +
      `Ao entrar no sistema, você pode acessar o menu *Minha Empresa* e definir uma *Chave Secreta Particular só sua*. ` +
      `Nem mesmo nossa equipe terá acesso à sua nova chave, garantindo total privacidade para os seus contratos e valores!\n\n` +
      `Qualquer dúvida, estamos sempre à sua disposição. Boas festas e ótimas locações! 🎈`
    );
  };

  return (
    <div className="min-h-screen bg-[#faf5f7] p-4 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-stone-900 text-xl text-white">
                ⚙️
              </span>
              <div>
                <h1 className="text-2xl font-extrabold text-stone-800">Painel Master Admin</h1>
                <p className="text-xs text-stone-500">
                  Gerenciamento de assinaturas (Mensal / Anual), bloqueio automático e chaves privadas
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-stone-600 shadow-sm transition hover:bg-rose-50 hover:text-rose-600"
          >
            Sair do Admin
          </button>
        </header>

        {/* Form: Cadastrar Nova Cliente / Decoradora */}
        <div className="rounded-3xl border border-white bg-white/80 p-6 shadow-xl shadow-pink-100/50 backdrop-blur-xl space-y-4">
          <h2 className="text-base font-bold text-stone-800 flex items-center gap-2">
            <span>✨</span> Cadastrar Nova Decoradora & Gerar Acesso
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nome da Decoradora / Empresa *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Doce Sonho Festas"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  WhatsApp (com DDD)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 81999998888"
                  value={newWhatsapp}
                  onChange={(e) => setNewWhatsapp(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Código de Acesso Inicial *
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Ex: FESTA2026"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm uppercase font-mono font-bold tracking-wider outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = newName.trim().slice(0, 5).toUpperCase().replace(/[^A-Z]/g, "FEST") || "DECOR";
                      setNewCode(`${clean}${Math.floor(100 + Math.random() * 900)}`);
                    }}
                    className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100"
                    title="Gerar código automático"
                  >
                    Gerar
                  </button>
                </div>
              </div>
            </div>

            {/* Seleção do Tipo de Plano (Mensal, Anual, Teste) */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-2">
                Tipo de Plano e Validade da Assinatura:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPlanType("monthly")}
                  className={`p-3 rounded-2xl border text-left transition ${
                    planType === "monthly"
                      ? "border-pink-500 bg-pink-50 text-pink-700 shadow-sm font-bold"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  <p className="text-sm">📅 Plano Mensal</p>
                  <p className="text-[11px] font-normal opacity-80 mt-0.5">30 dias corridos</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPlanType("annual")}
                  className={`p-3 rounded-2xl border text-left transition ${
                    planType === "annual"
                      ? "border-purple-500 bg-purple-50 text-purple-700 shadow-sm font-bold"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  <p className="text-sm">🌟 Plano Anual</p>
                  <p className="text-[11px] font-normal opacity-80 mt-0.5">365 dias (1 ano)</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPlanType("test")}
                  className={`p-3 rounded-2xl border text-left transition ${
                    planType === "test"
                      ? "border-amber-500 bg-amber-50 text-amber-700 shadow-sm font-bold"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  <p className="text-sm">⏳ Teste Grátis</p>
                  <p className="text-[11px] font-normal opacity-80 mt-0.5">Expira em 24 horas</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPlanType("custom")}
                  className={`p-3 rounded-2xl border text-left transition ${
                    planType === "custom"
                      ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm font-bold"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  <p className="text-sm">⚙️ Personalizado</p>
                  <p className="text-[11px] font-normal opacity-80 mt-0.5">{customDays} dias</p>
                </button>
              </div>

              {planType === "custom" && (
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-xs font-semibold text-stone-600">Quantidade de dias:</label>
                  <input
                    type="number"
                    min="1"
                    value={customDays}
                    onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value) || 1))}
                    className="w-24 rounded-xl border border-stone-200 px-3 py-1.5 text-sm"
                  />
                </div>
              )}

              <p className="text-xs text-stone-500 mt-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                💡 <b>Vencimento automático:</b>{" "}
                {new Date(calculateExpiresAt(planType, customDays)).toLocaleDateString("pt-BR")}. Se a cliente não renovar, o acesso será <b>bloqueado automaticamente</b> na data.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading || !newCode.trim() || !newName.trim()}
                className="rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-pink-200 hover:opacity-95 transition disabled:opacity-50"
              >
                {loading ? "Criando Acesso..." : "Criar Acesso & Liberar Cliente ✨"}
              </button>
            </div>
          </form>
        </div>

        {/* Tabela de Clientes Cadastrados */}
        <div className="rounded-3xl border border-white bg-white/90 shadow-xl shadow-pink-100/30 backdrop-blur-xl overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-800">
                Assinantes Cadastrados ({tenants.length})
              </h2>
              <p className="text-xs text-stone-500">
                Controle de validade, bloqueio automático e status de chave privada
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[750px]">
              <thead className="bg-stone-50/80 font-bold text-xs uppercase tracking-wider text-stone-500 border-b border-stone-100">
                <tr>
                  <th className="px-5 py-3.5">Cliente / Empresa</th>
                  <th className="px-5 py-3.5">Plano & Validade</th>
                  <th className="px-5 py-3.5">Chave de Acesso</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {tenants.map((t) => {
                  const days = getDaysLeft(t.expiresAt);
                  const isExpired = days !== null && days <= 0;

                  return (
                    <tr key={t.id} className="transition hover:bg-pink-50/30">
                      {/* Cliente */}
                      <td className="px-5 py-4">
                        <p className="font-bold text-stone-800">{t.name}</p>
                        {t.whatsapp ? (
                          <a
                            href={waLink(t.whatsapp, "")}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline font-medium mt-0.5"
                          >
                            <span>📱</span> {t.whatsapp}
                          </a>
                        ) : (
                          <span className="text-xs text-stone-400">Sem WhatsApp</span>
                        )}
                      </td>

                      {/* Plano & Validade */}
                      <td className="px-5 py-4">{getPlanBadge(t)}</td>

                      {/* Chave de Acesso & Privacidade */}
                      <td className="px-5 py-4">
                        {t.hasCustomKey ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                              <span>🔒</span> Chave Privada Pessoal
                            </span>
                            <p className="text-[10px] text-stone-400 leading-tight">
                              Definida pela cliente. Oculta para garantir privacidade.
                            </p>
                            <button
                              type="button"
                              onClick={() => handleResetSecretKey(t)}
                              className="text-[10px] font-bold text-amber-600 hover:underline block mt-1"
                            >
                              🔄 Resetar se cliente esqueceu
                            </button>
                          </div>
                        ) : (
                          <div>
                            <span className="font-mono font-bold text-xs bg-stone-100 px-2 py-1 rounded-md text-stone-700 border border-stone-200">
                              {t.id}
                            </span>
                            <span className="block text-[10px] text-stone-400 mt-1">
                              Chave inicial (não alterada)
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                            t.status === "blocked"
                              ? "bg-stone-200 text-stone-700"
                              : isExpired
                              ? "bg-rose-100 text-rose-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {t.status === "blocked"
                            ? "⛔ Bloqueado Manual"
                            : isExpired
                            ? "⚠️ Vencido / Desativado"
                            : "🟢 Ativo"}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {/* Enviar WhatsApp */}
                          {t.whatsapp && (
                            <a
                              href={waLink(t.whatsapp, generateWelcomeMessage(t))}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl bg-emerald-500 p-2 text-white shadow-sm hover:bg-emerald-600 transition"
                              title="Enviar acesso completo pelo WhatsApp"
                            >
                              <Icon.wa className="h-4 w-4" />
                            </a>
                          )}

                          {/* Renovar +30 dias */}
                          <button
                            onClick={() => handleRenew(t, 30)}
                            className="rounded-xl bg-purple-50 px-2.5 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 border border-purple-200 transition"
                            title="Renovar mais 30 dias (Mensal)"
                          >
                            +30d
                          </button>

                          {/* Renovar +1 ano */}
                          <button
                            onClick={() => handleRenew(t, 365)}
                            className="rounded-xl bg-pink-50 px-2.5 py-1.5 text-xs font-bold text-pink-700 hover:bg-pink-100 border border-pink-200 transition"
                            title="Renovar mais 1 ano (Anual)"
                          >
                            +1 ano
                          </button>

                          {/* Bloquear / Desbloquear */}
                          <button
                            onClick={() => toggleStatus(t)}
                            className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
                              t.status === "active"
                                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            }`}
                          >
                            {t.status === "active" ? "Pausar" : "Liberar"}
                          </button>

                          {/* Excluir */}
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="rounded-xl bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition"
                            title="Excluir cliente do sistema"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-stone-400">
                      Nenhum assinante cadastrado ainda. Use o formulário acima para criar o primeiro acesso!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
