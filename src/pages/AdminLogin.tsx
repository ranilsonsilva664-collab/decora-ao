import { useState } from "react";
import { useStore } from "../lib/store";

export default function AdminLogin() {
  const { login } = useStore();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    // Check if it's the admin master password
    if (code.trim().toUpperCase() !== "ADMIN-MASTER-2026") {
      setError("Senha mestre incorreta.");
      setLoading(false);
      return;
    }

    const res = await login(code);
    if (!res.success) {
      setError(res.error || "Erro desconhecido.");
    } else {
      // Refresh to clear path and load admin dashboard properly
      window.location.href = "/";
    }
    
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm glass rounded-3xl p-8 text-center shadow-xl">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-stone-800 text-3xl shadow-lg">
          ⚙️
        </div>
        <h1 className="mb-2 text-2xl font-bold text-stone-800">Acesso Restrito</h1>
        <p className="mb-8 text-sm text-stone-500">Painel de Administração do Sistema.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Senha Mestre"
            className="w-full rounded-2xl border-none bg-white/50 px-4 py-3 text-center text-lg font-medium tracking-widest text-stone-700 outline-none focus:ring-2 focus:ring-stone-600"
            required
            disabled={loading}
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="mt-2 w-full rounded-2xl bg-stone-800 px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-stone-700 disabled:opacity-50"
          >
            {loading ? "Autenticando..." : "Entrar no Admin"}
          </button>
        </form>
      </div>
    </div>
  );
}
