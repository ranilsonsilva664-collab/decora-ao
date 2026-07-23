import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useStore } from "../lib/store";
import type { Tenant, TenantStatus } from "../lib/types";

export default function Admin() {
  const { logout } = useStore();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "tenants"), (snapshot) => {
      const data = snapshot.docs.map(d => d.data() as Tenant);
      setTenants(data);
    });
    return () => unsub();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) return;
    setLoading(true);
    
    const code = newCode.trim().toUpperCase();
    try {
      const newTenant: Tenant = {
        id: code,
        name: newName.trim(),
        status: "active",
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, "tenants", code), newTenant);
      setNewCode("");
      setNewName("");
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

  const handleDelete = async (tenantId: string) => {
    if (!confirm(`Deseja mesmo excluir o acesso ${tenantId} e todos os seus dados?`)) return;
    
    try {
      // Deleta a conta de acesso
      await deleteDoc(doc(db, "tenants", tenantId));
      // Deleta os dados do banco
      await deleteDoc(doc(db, "tenant_data", tenantId));
    } catch (e) {
      alert("Erro ao excluir.");
    }
  };

  return (
    <div className="min-h-screen p-6 sm:p-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-stone-800">Painel Admin</h1>
            <p className="text-stone-500">Gerencie os acessos do CRM Pegue e Monte.</p>
          </div>
          <button
            onClick={logout}
            className="rounded-xl bg-white/60 px-4 py-2 font-medium text-stone-600 shadow-sm transition hover:bg-white/80"
          >
            Sair
          </button>
        </header>

        <div className="mb-12 glass rounded-3xl p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-stone-800">Criar Novo Acesso</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-4 sm:flex-row">
            <input
              type="text"
              placeholder="Nome da Decoradora"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1 rounded-xl border border-white/40 bg-white/50 px-4 py-3 outline-none focus:ring-2 focus:ring-lilac-400"
              required
            />
            <input
              type="text"
              placeholder="CÓDIGO (ex: MARIA123)"
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              className="flex-1 rounded-xl border border-white/40 bg-white/50 px-4 py-3 uppercase outline-none focus:ring-2 focus:ring-lilac-400"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-nude-400 to-lilac-400 px-6 py-3 font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
            >
              Criar Acesso
            </button>
          </form>
        </div>

        <div className="glass rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/40 font-medium text-stone-500">
              <tr>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Código</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {tenants.map(t => (
                <tr key={t.id} className="transition hover:bg-white/20">
                  <td className="px-6 py-4 font-medium text-stone-700">{t.name}</td>
                  <td className="px-6 py-4 text-stone-500">{t.id}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${t.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {t.status === 'active' ? 'Ativo' : 'Bloqueado'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleStatus(t)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${t.status === 'active' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                      >
                        {t.status === 'active' ? 'Bloquear' : 'Desbloquear'}
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-200"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-stone-500">
                    Nenhum acesso criado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
