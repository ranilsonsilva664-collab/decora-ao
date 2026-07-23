import { useState } from "react";
import { StoreProvider, useStore } from "./lib/store";
import { ToastProvider } from "./components/Toast";
import { Icon } from "./components/icons";
import { cn } from "./utils/cn";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Quotes from "./pages/Quotes";
import Contracts from "./pages/Contracts";
import Calendar from "./pages/Calendar";
import Inventory from "./pages/Inventory";
import Finance from "./pages/Finance";
import Messages from "./pages/Messages";
import Login from "./pages/Login";
import Admin from "./pages/Admin";

export type Page =
  | "dashboard"
  | "clients"
  | "quotes"
  | "contracts"
  | "calendar"
  | "inventory"
  | "finance"
  | "messages";

const NAV: { id: Page; label: string; icon: (p: { className?: string }) => React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: Icon.dashboard },
  { id: "clients", label: "Clientes", icon: Icon.clients },
  { id: "quotes", label: "Orçamentos", icon: Icon.quote },
  { id: "contracts", label: "Contratos", icon: Icon.contract },
  { id: "calendar", label: "Agenda", icon: Icon.calendar },
  { id: "inventory", label: "Acervo", icon: Icon.inventory },
  { id: "finance", label: "Financeiro", icon: Icon.finance },
  { id: "messages", label: "Mensagens", icon: Icon.message },
];

import AdminLogin from "./pages/AdminLogin";

// Bottom bar gets the most-used 5
const MOBILE_NAV: Page[] = ["dashboard", "clients", "quotes", "calendar", "finance"];

function Shell() {
  const [page, setPage] = useState<Page>("dashboard");
  const { tenantId, isAdmin, isLoading, logout } = useStore();

  const isRouteAdmin = window.location.pathname.startsWith('/admin');

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center font-medium text-stone-500">Carregando CRM...</div>;
  }

  // Se já estiver logado como Admin, mostra o painel de Admin
  if (isAdmin) {
    return <Admin />;
  }

  // Se não estiver logado e a rota for /admin, mostra o Login de Admin
  if (isRouteAdmin && !tenantId) {
    return <AdminLogin />;
  }

  // Se não estiver logado e for a rota principal, mostra o Login de Decoradora
  if (!tenantId) {
    return <Login />;
  }

  const render = () => {
    switch (page) {
      case "dashboard": return <Dashboard go={setPage} />;
      case "clients": return <Clients />;
      case "quotes": return <Quotes />;
      case "contracts": return <Contracts />;
      case "calendar": return <Calendar />;
      case "inventory": return <Inventory />;
      case "finance": return <Finance />;
      case "messages": return <Messages />;
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 border-r border-white/60 bg-white/40 p-5 backdrop-blur-xl lg:flex">
        <div className="mb-6 flex items-center gap-3 px-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-nude-400 to-lilac-400 text-xl shadow-lg shadow-lilac-200">🎀</span>
          <div>
            <p className="font-semibold leading-tight text-stone-800">Festa &amp; Cia</p>
            <p className="text-[11px] text-stone-500">Código: <span className="font-bold text-stone-700">{tenantId}</span></p>
          </div>
        </div>
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setPage(n.id)}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
              page === n.id
                ? "bg-gradient-to-r from-nude-400 to-lilac-400 text-white shadow-lg shadow-lilac-200/60"
                : "text-stone-500 hover:bg-white/70",
            )}
          >
            <n.icon className="h-5 w-5" />
            {n.label}
          </button>
        ))}
        <div className="mt-auto rounded-2xl bg-gradient-to-br from-lilac-100 to-nude-100 p-4 text-center">
          <p className="text-2xl">💕</p>
          <button onClick={() => { logout(); window.location.href = '/'; }} className="mt-2 w-full rounded-xl bg-white/60 px-3 py-2 text-xs font-semibold text-stone-600 transition hover:bg-white/80">Sair da Conta</button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/60 bg-white/50 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-nude-400 to-lilac-400 text-lg">🎀</span>
            <p className="font-semibold text-stone-800">{tenantId}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage("messages")} className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-500">
              <Icon.wa className="h-5 w-5" />
            </button>
            <button onClick={() => { logout(); window.location.href = '/'; }} className="grid h-9 w-9 place-items-center rounded-xl bg-white/60 text-stone-500">
              <Icon.logout className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 pb-28 sm:p-6 lg:pb-8">{render()}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 overflow-x-auto border-t border-white/60 bg-white/70 px-4 py-2 backdrop-blur-xl lg:hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {NAV.map((n) => {
          const id = n.id;
          return (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={cn(
                "flex min-w-[72px] shrink-0 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition",
                page === id ? "text-lilac-400" : "text-stone-400",
              )}
            >
              <span className={cn("grid h-9 w-9 place-items-center rounded-xl transition", page === id && "bg-gradient-to-br from-nude-200 to-lilac-200 text-white")}>
                <n.icon className="h-5 w-5" />
              </span>
              {n.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreProvider>
  );
}
