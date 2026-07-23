import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { TenantData } from "../lib/types";
import { Icon } from "../components/icons";

export default function Catalog({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "tenant_data", tenantId));
        if (snap.exists()) {
          const tenantData = snap.data() as TenantData;
          if (tenantData.catalogEnabled) {
            setData(tenantData);
          } else {
            setError("Este catálogo não está disponível no momento.");
          }
        } else {
          setError("Catálogo não encontrado.");
        }
      } catch (err) {
        setError("Erro ao carregar o catálogo.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f6]">
        <div className="flex flex-col items-center gap-4 text-stone-500">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-lilac-200 border-t-lilac-500" />
          <p className="font-medium">Carregando catálogo...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#faf9f6] p-6 text-center">
        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-stone-200/50 max-w-sm w-full">
          <Icon.ig className="mx-auto h-12 w-12 text-stone-300 mb-4" />
          <h1 className="text-xl font-bold text-stone-800 mb-2">Ops!</h1>
          <p className="text-stone-500">{error}</p>
        </div>
      </div>
    );
  }

  const items = (data.inventoryItems || []).filter(item => item.showInCatalog);

  return (
    <div className="min-h-screen bg-[#faf9f6] pb-24">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white p-0.5 shadow-sm">
            <img 
              src="https://res.cloudinary.com/dmxeqe939/image/upload/v1784820761/ChatGPT_Image_23_de_jul._de_2026_12_31_59_nlds50.png" 
              alt="Logo" 
              className="h-full w-full rounded-lg object-cover"
            />
          </div>
          <div>
            <h1 className="font-bold text-stone-800 leading-tight">Festa &amp; Cia</h1>
            <p className="text-[11px] font-medium text-lilac-500">Catálogo de Peças Avulsas</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 sm:p-6 mt-4">
        {items.length === 0 ? (
          <div className="text-center py-20">
            <Icon.box className="mx-auto h-12 w-12 text-stone-300 mb-4" />
            <h2 className="text-lg font-semibold text-stone-800">Nenhuma peça no momento</h2>
            <p className="text-stone-500 text-sm mt-1">Este catálogo ainda não possui peças disponíveis para visualização.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map(item => (
              <div key={item.id} className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-xl hover:shadow-lilac-200/40">
                <div className="relative aspect-square w-full bg-stone-100 overflow-hidden">
                  {item.photo ? (
                    <img 
                      src={item.photo} 
                      alt={item.name} 
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-stone-300">
                      <Icon.ig className="h-10 w-10 opacity-30" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-stone-800 text-sm line-clamp-2 leading-snug">{item.name}</h3>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-lilac-500 bg-lilac-50 px-2 py-1 rounded-lg">
                      {item.quantity} {item.quantity === 1 ? 'unid' : 'unids'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-100 py-4 text-center z-20">
        <p className="text-xs font-medium text-stone-400 flex items-center justify-center gap-1">
          Feito com o <span className="font-bold text-stone-600">CRM Pegue e Monte</span>
        </p>
      </footer>
    </div>
  );
}
