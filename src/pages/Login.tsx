import { useState } from "react";
import { useStore } from "../lib/store";
import { InstallPWA } from "../components/InstallPWA";

export default function Login() {
  const { login } = useStore();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    const res = await login(code);
    if (!res.success) {
      setError(res.error || "Erro desconhecido.");
    }
    
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm glass rounded-3xl p-8 text-center shadow-xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-lg shadow-lilac-200 p-1">
          <img 
            src="https://res.cloudinary.com/dmxeqe939/image/upload/v1784820761/ChatGPT_Image_23_de_jul._de_2026_12_31_59_nlds50.png" 
            alt="Festa & Cia Logo" 
            className="h-full w-full rounded-[20px] object-cover"
          />
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-stone-800">Festa &amp; Cia</h1>
        <p className="mb-8 text-sm text-stone-500">Digite seu código de acesso para entrar.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CÓDIGO DE ACESSO"
            className="w-full rounded-2xl border-none bg-white/50 px-4 py-3 text-center text-lg font-medium tracking-widest text-stone-700 outline-none focus:ring-2 focus:ring-lilac-400"
            required
            disabled={loading}
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="mt-2 w-full rounded-2xl bg-gradient-to-r from-nude-400 to-lilac-400 px-4 py-3 font-semibold text-white shadow-lg shadow-lilac-200/60 transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Acessar CRM"}
          </button>
        </form>

        <InstallPWA />
      </div>
    </div>
  );
}
