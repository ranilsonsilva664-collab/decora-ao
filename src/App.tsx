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
import Stock from "./pages/Stock";
import Events from "./pages/Events";
import Finance from "./pages/Finance";
import Reports from "./pages/Reports";
import FormSubmissions from "./pages/FormSubmissions";
import Company from "./pages/Company";
import Messages from "./pages/Messages";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import Catalog from "./pages/Catalog";
import PublicForm from "./pages/PublicForm";
import PublicSign from "./pages/PublicSign";

export type Page =
  | "dashboard"
  | "clients"
  | "stock"
  | "inventory"
  | "quotes"
  | "contracts"
  | "events"
  | "calendar"
  | "finance"
  | "reports"
  | "forms"
  | "company"
  | "messages";

const MAIN_NAV: { id: Page; label: string; icon: (p: { className?: string }) => React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: Icon.dashboard },
  { id: "clients", label: "Clientes", icon: Icon.clients },
  { id: "stock", label: "Acervo de Peças", icon: Icon.inventory },
  { id: "inventory", label: "Temas do Acervo", icon: () => <span className="text-base">🎀</span> },
  { id: "quotes", label: "Orçamentos", icon: Icon.quote },
  { id: "contracts", label: "Contratos", icon: Icon.contract },
];

// Área Mais (Requisito 34)
const MORE_NAV: { id: Page; label: string; emoji: string }[] = [
  { id: "inventory", label: "Temas do Acervo", emoji: "🎀" },
  { id: "events", label: "Eventos & Retiradas", emoji: "📦" },
  { id: "calendar", label: "Calendário de Festas", emoji: "🗓️" },
  { id: "finance", label: "Financeiro & Recibos", emoji: "💰" },
  { id: "reports", label: "Relatórios Gerenciais", emoji: "📊" },
  { id: "forms", label: "Formulários dos Clientes", emoji: "💌" },
  { id: "company", label: "Minha Empresa (Logo/Pix)", emoji: "🏢" },
  { id: "messages", label: "Mensagens WhatsApp", emoji: "💬" },
];

function Shell() {
  const [page, setPage] = useState<Page>("dashboard");
  const [showMoreModal, setShowMoreModal] = useState(false);
  const { tenantId, isAdmin, isLoading, logout, companySettings, currentTenant } = useStore();

  // Route Handlers
  const pathname = window.location.pathname;
  const isRouteAdmin = pathname.startsWith("/admin");
  const catalogMatch = pathname.match(/^\/(?:catalog|catalogo)\/(.+)$/);
  const formMatch = pathname.match(/^\/formulario\/(.+)$/);
  const signMatch = pathname.match(/^\/assinar\/([^/]+)\/([^/]+)$/);

  if (catalogMatch) {
    return <Catalog tenantId={catalogMatch[1]} />;
  }

  if (formMatch) {
    return <PublicForm tenantId={formMatch[1]} />;
  }

  if (signMatch) {
    return <PublicSign tenantId={signMatch[1]} contractId={signMatch[2]} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center font-medium text-stone-500 bg-[#fdf8fa]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500" />
          <p className="text-sm font-semibold text-stone-600">Carregando EventFlow CRM...</p>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return <Admin />;
  }

  if (isRouteAdmin && !tenantId) {
    return <AdminLogin />;
  }

  if (!tenantId) {
    return <Login />;
  }

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard go={setPage} />;
      case "clients":
        return <Clients />;
      case "stock":
        return <Stock key="stock-items" initialTab="items" />;
      case "inventory":
        return <Stock key="stock-themes" initialTab="themes" />;
      case "quotes":
        return <Quotes />;
      case "contracts":
        return <Contracts />;
      case "events":
        return <Events />;
      case "calendar":
        return <Calendar />;
      case "finance":
        return <Finance />;
      case "reports":
        return <Reports />;
      case "forms":
        return <FormSubmissions />;
      case "company":
        return <Company />;
      case "messages":
        return <Messages />;
      default:
        return <Dashboard go={setPage} />;
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 border-r border-white/60 bg-white/50 p-5 backdrop-blur-xl lg:flex overflow-y-auto">
        <div className="mb-5 flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-md shadow-pink-100 p-0.5 border border-pink-100">
            <img
              src={
                companySettings?.logo ||
                "https://res.cloudinary.com/dmxeqe939/image/upload/v1785097595/ChatGPT_Image_26_de_jul._de_2026_17_25_48_ilxojd.png"
              }
              alt="Logo"
              className="h-full w-full rounded-[14px] object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="font-bold leading-tight text-stone-800 truncate">
              {companySettings?.tradeName || currentTenant?.name || "Minha Empresa"}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
              <span className="truncate">Conta: <b className="text-stone-700">{tenantId}</b></span>
              <button
                onClick={() => setPage("company")}
                className="text-[10px] text-purple-600 hover:text-purple-700 font-bold shrink-0 hover:underline"
                title="Redefinir chave secreta particular"
              >
                🔐 Alterar
              </button>
            </div>
          </div>
        </div>

        {/* Menu Principal (Requisito 34) */}
        <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
          Menu Principal
        </p>
        {MAIN_NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setPage(n.id)}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition",
              page === n.id
                ? "bg-gradient-to-r from-nude-400 to-lilac-400 text-white shadow-md shadow-lilac-200"
                : "text-stone-600 hover:bg-white/70"
            )}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </button>
        ))}

        {/* Área Mais (Requisito 34) */}
        <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-stone-400 mt-4 mb-1">
          Mais Módulos
        </p>
        {MORE_NAV.map((m) => (
          <button
            key={m.id}
            onClick={() => setPage(m.id)}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-2 text-xs font-medium transition",
              page === m.id
                ? "bg-gradient-to-r from-nude-400 to-lilac-400 text-white shadow-md shadow-lilac-200"
                : "text-stone-600 hover:bg-white/70"
            )}
          >
            <span className="text-sm">{m.emoji}</span>
            {m.label}
          </button>
        ))}

        {/* Logout box */}
        <div className="mt-auto pt-4 text-center">
          <button
            onClick={() => {
              logout();
              window.location.href = "/";
            }}
            className="w-full rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold text-stone-600 transition hover:bg-white hover:text-rose-500 shadow-sm"
          >
            Sair da Conta
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/60 bg-white/70 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white p-0.5 shadow-sm border border-pink-100">
              <img
                src={
                  companySettings?.logo ||
                  "https://res.cloudinary.com/dmxeqe939/image/upload/v1785097595/ChatGPT_Image_26_de_jul._de_2026_17_25_48_ilxojd.png"
                }
                alt="Logo"
                className="h-full w-full rounded-lg object-cover"
              />
            </div>
            <div>
              <p className="font-bold text-stone-800 text-sm leading-none">
                {companySettings?.tradeName || currentTenant?.name || "Minha Empresa"}
              </p>
              <p className="text-[10px] text-stone-400">Pegue e Monte</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage("forms")}
              className="grid h-9 w-9 place-items-center rounded-xl bg-pink-50 text-pink-600 font-bold text-sm"
              title="Formulários"
            >
              💌
            </button>
            <button
              onClick={() => {
                logout();
                window.location.href = "/";
              }}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/80 text-stone-500"
            >
              <Icon.logout className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 pb-28 sm:p-6 lg:pb-8">
          {renderPage()}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Requisito 34 & 35) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-white/80 bg-white/95 px-1 py-1.5 backdrop-blur-xl lg:hidden shadow-lg">
        {MAIN_NAV.map((n) => {
          const isActive = page === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={cn(
                "flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[9.5px] font-semibold transition active:scale-95",
                isActive ? "text-pink-600 font-bold" : "text-stone-400"
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-xl transition",
                  isActive && "bg-gradient-to-br from-nude-400 to-lilac-400 text-white shadow-md shadow-pink-200"
                )}
              >
                <n.icon className="h-4 w-4" />
              </span>
              <span className="truncate max-w-full px-0.5">{n.label}</span>
            </button>
          );
        })}

        {/* Botão MAIS no celular */}
        <button
          onClick={() => setShowMoreModal(true)}
          className={cn(
            "flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[9.5px] font-semibold transition active:scale-95",
            showMoreModal ||
              ["inventory", "events", "calendar", "finance", "reports", "forms", "company", "messages"].includes(page)
              ? "text-purple-600 font-bold"
              : "text-stone-400"
          )}
        >
          <span
            className={cn(
              "grid h-8 w-8 place-items-center rounded-xl transition",
              ["inventory", "events", "calendar", "finance", "reports", "forms", "company", "messages"].includes(page) &&
                "bg-gradient-to-br from-purple-400 to-pink-500 text-white shadow-md shadow-purple-200"
            )}
          >
            <span className="text-sm">✨</span>
          </span>
          <span className="truncate max-w-full px-0.5">Mais</span>
        </button>
      </nav>

      {/* Modal / Gaveta "MAIS" no Celular */}
      {showMoreModal && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-stone-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setShowMoreModal(false)}
        >
          <div
            className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl animate-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <div>
                <h3 className="font-bold text-stone-800 text-base">Mais Recursos do Sistema</h3>
                <p className="text-[11px] text-stone-400">Acesse qualquer funcionalidade do sistema</p>
              </div>
              <button
                onClick={() => setShowMoreModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Opção Acervo destacada no drawer também */}
              <button
                onClick={() => {
                  setPage("stock");
                  setShowMoreModal(false);
                }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-2xl border border-stone-100 text-left transition col-span-2",
                  page === "stock"
                    ? "bg-pink-50 border-pink-200 text-pink-700 font-bold"
                    : "bg-pink-50/50 text-pink-900 hover:bg-pink-100/60 border-pink-100"
                )}
              >
                <span className="text-2xl">📦</span>
                <div>
                  <span className="text-xs font-bold leading-tight block">Acervo de Peças & Temas</span>
                  <span className="text-[10px] text-stone-500">Kits, fotos, valores de reposição e estoque</span>
                </div>
              </button>

              {MORE_NAV.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setPage(m.id);
                    setShowMoreModal(false);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 p-3 rounded-2xl border border-stone-100 text-left transition",
                    page === m.id
                      ? "bg-pink-50 border-pink-200 text-pink-700 font-bold"
                      : "bg-stone-50/70 text-stone-700 hover:bg-stone-100"
                  )}
                >
                  <span className="text-xl">{m.emoji}</span>
                  <span className="text-xs font-semibold leading-tight">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
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
