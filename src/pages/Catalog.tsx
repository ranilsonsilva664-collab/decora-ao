import { useEffect, useState, useMemo } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { TenantData, Kit, InventoryItem } from "../lib/types";
import { Icon } from "../components/icons";
import { brl, fmtDate } from "../lib/format";
import { waLink } from "../lib/helpers";
import { getKitAvailabilityForDate, type KitDateAvailability } from "../lib/availability";
import { generateCatalogPdf } from "../utils/catalogPdf";

export default function Catalog({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<TenantData | null>(null);
  const [tenantName, setTenantName] = useState("EventFlow");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tab: kits (Decoração Completa) vs items (Peças Avulsas)
  const [activeTab, setActiveTab] = useState<"kits" | "items">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") === "items" ? "items" : "kits";
  });

  // Date availability checker state
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("data") || "";
  });

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const [selectedKitModal, setSelectedKitModal] = useState<Kit | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "tenant_data", tenantId));
        const tSnap = await getDoc(doc(db, "tenants", tenantId));

        if (tSnap.exists()) {
          setTenantName(tSnap.data().name);
        }

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

  const companySettings = data?.companySettings || {};
  const companyLogo = companySettings.logo || "";
  const companyTradeName = companySettings.tradeName || companySettings.name || tenantName;
  const companyPhone = companySettings.whatsapp || companySettings.phone || "";

  // Kits data
  const rawKits = useMemo(() => {
    if (!data?.kits) return [];
    return data.kits.filter((k) => k.showInCatalog !== false);
  }, [data]);

  // Items data
  const rawItems = useMemo(() => {
    if (!data?.inventoryItems) return [];
    return data.inventoryItems.filter((i) => i.showInCatalog);
  }, [data]);

  // Categories for Kits
  const kitCategories = useMemo(() => {
    const set = new Set<string>();
    rawKits.forEach((k) => {
      if (k.category) set.add(k.category);
    });
    return Array.from(set);
  }, [rawKits]);

  // Categories for Items
  const itemCategories = useMemo(() => {
    const set = new Set<string>();
    rawItems.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [rawItems]);

  // Compute availability map for all kits on selectedDate
  const availabilityMap = useMemo(() => {
    const map: Record<string, KitDateAvailability> = {};
    if (!data) return map;

    rawKits.forEach((k) => {
      map[k.id] = getKitAvailabilityForDate(
        k,
        selectedDate,
        data.contracts || [],
        data.eventsList || [],
        data.inventoryItems || [],
        data.kits || []
      );
    });

    return map;
  }, [rawKits, selectedDate, data]);

  // Filtered Kits
  const filteredKits = useMemo(() => {
    return rawKits.filter((k) => {
      const matchSearch =
        k.name.toLowerCase().includes(search.toLowerCase()) ||
        (k.description || "").toLowerCase().includes(search.toLowerCase());
      const matchCat = selectedCategory === "Todas" || k.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [rawKits, search, selectedCategory]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return rawItems.filter((i) => {
      const matchSearch =
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.description || "").toLowerCase().includes(search.toLowerCase());
      const matchCat = selectedCategory === "Todas" || i.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [rawItems, search, selectedCategory]);

  const handleDownloadPdf = async () => {
    if (filteredKits.length === 0) return;
    setDownloadingPdf(true);
    setPdfProgress("Iniciando geração do catálogo...");
    try {
      await generateCatalogPdf({
        kits: filteredKits,
        companySettings,
        selectedDate: selectedDate || undefined,
        availabilityMap: selectedDate ? availabilityMap : undefined,
        onProgress: (status) => setPdfProgress(status),
      });
    } catch (e) {
      console.error(e);
      alert("Erro ao gerar o PDF do catálogo.");
    } finally {
      setDownloadingPdf(false);
      setPdfProgress("");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f6]">
        <div className="flex flex-col items-center gap-4 text-stone-500">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500" />
          <p className="font-semibold text-stone-600">Carregando catálogo...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#faf9f6] p-6 text-center">
        <div className="rounded-3xl bg-white p-8 shadow-xl shadow-stone-200/50 max-w-sm w-full border border-stone-100">
          <span className="text-4xl block mb-3">🎈</span>
          <h1 className="text-xl font-bold text-stone-800 mb-2">Ops!</h1>
          <p className="text-stone-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f9] pb-24 text-stone-800">
      {/* Header com identidade da decoradora */}
      <header className="sticky top-0 z-30 border-b border-pink-100/80 bg-white/85 px-4 py-3.5 backdrop-blur-xl shadow-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white p-0.5 shadow-md shadow-pink-100 border border-pink-50 overflow-hidden">
              {companyLogo ? (
                <img src={companyLogo} alt={companyTradeName} className="h-full w-full rounded-xl object-cover" />
              ) : (
                <span className="text-2xl">✨</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-stone-800 leading-tight text-base sm:text-lg truncate">
                {companyTradeName}
              </h1>
              <p className="text-[11px] font-semibold text-pink-600 truncate">
                Catálogo Pegue e Monte • Decorações de Festa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão Baixar Catálogo em PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || filteredKits.length === 0}
              className="flex items-center gap-1.5 rounded-2xl bg-white border border-stone-200 px-3.5 py-2 text-xs font-bold text-stone-700 shadow-xs hover:bg-stone-50 transition active:scale-95 disabled:opacity-50"
              title="Baixar todo o catálogo de decorações em PDF"
            >
              <span>📥</span>
              <span className="hidden sm:inline">
                {downloadingPdf ? (pdfProgress || "Gerando...") : "Baixar PDF"}
              </span>
            </button>

            {/* Contato WhatsApp */}
            {companyPhone && (
              <a
                href={waLink(companyPhone, `Olá! Estou visualizando o catálogo da ${companyTradeName} e gostaria de tirar uma dúvida.`)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-2xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-200 hover:bg-emerald-600 transition active:scale-95"
              >
                <Icon.wa className="h-4 w-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
        {/* Banner de Consulta de Data da Festa (Reconhecimento em Tempo Real) */}
        <div className="rounded-3xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 p-5 sm:p-6 text-white shadow-xl shadow-pink-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold backdrop-blur-md">
                ✨ Disponibilidade em Tempo Real
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Consulte o que está livre para a data da sua festa
              </h2>
              <p className="text-xs sm:text-sm text-pink-100 max-w-xl">
                Selecione o dia do seu evento abaixo. O catálogo mostrará automaticamente quais decorações e kits estão disponíveis ou já reservados!
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-lg shrink-0">
              <span className="text-xl pl-2">📅</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-xl border-none bg-transparent px-2 py-1.5 text-xs sm:text-sm font-bold text-stone-800 focus:outline-none"
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate("")}
                  className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-bold text-stone-600 hover:bg-stone-200 transition"
                  title="Limpar data selecionada"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {selectedDate && (
            <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs font-medium">
              <span>
                Mostrando status para o evento em: <b>{fmtDate(selectedDate)}</b>
              </span>
              <span className="bg-white/20 px-2.5 py-0.5 rounded-full font-bold">
                ✓ Atualizado com a agenda
              </span>
            </div>
          )}
        </div>

        {/* Abas: Kits de Decoração Completa vs Peças Avulsas */}
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-stone-200/80 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab("kits");
                setSelectedCategory("Todas");
              }}
              className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-extrabold transition ${
                activeTab === "kits"
                  ? "bg-stone-900 text-white shadow-lg shadow-stone-300"
                  : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
              }`}
            >
              <span>🎁</span> Decoração Completa ({rawKits.length})
            </button>

            <button
              onClick={() => {
                setActiveTab("items");
                setSelectedCategory("Todas");
              }}
              className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-extrabold transition ${
                activeTab === "items"
                  ? "bg-stone-900 text-white shadow-lg shadow-stone-300"
                  : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
              }`}
            >
              <span>📦</span> Peças Avulsas ({rawItems.length})
            </button>
          </div>

          {/* Filtro de Categoria e Busca rápida */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 shadow-xs focus:outline-none"
            >
              <option value="Todas">Todas as categorias</option>
              {(activeTab === "kits" ? kitCategories : itemCategories).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-2xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-stone-700 placeholder:text-stone-400 shadow-xs focus:outline-none w-36 sm:w-44"
            />
          </div>
        </div>

        {/* ABA 1: KITS DE DECORAÇÃO COMPLETA */}
        {activeTab === "kits" && (
          <div>
            {filteredKits.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-stone-100 p-8">
                <span className="text-5xl block mb-3">🎁</span>
                <h3 className="text-lg font-bold text-stone-800">Nenhum kit encontrado</h3>
                <p className="text-stone-400 text-xs mt-1">
                  Não encontramos decorações com os filtros selecionados.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredKits.map((k) => {
                  const mainPhoto = (k.photos && k.photos.length > 0) ? k.photos[0] : k.photo;
                  const avail = selectedDate ? availabilityMap[k.id] : undefined;
                  const isUnavailable = avail && !avail.isAvailable;

                  return (
                    <div
                      key={k.id}
                      className="group flex flex-col justify-between overflow-hidden rounded-3xl bg-white border border-stone-100/80 shadow-md shadow-pink-100/30 transition hover:shadow-xl hover:shadow-pink-200/50"
                    >
                      <div>
                        {/* Imagem do Kit */}
                        <div
                          className="relative aspect-4/3 w-full bg-stone-100 overflow-hidden cursor-pointer"
                          onClick={() => setSelectedKitModal(k)}
                        >
                          {mainPhoto ? (
                            <img
                              src={mainPhoto}
                              alt={k.name}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-5xl">🎁</div>
                          )}

                          {/* Categoria */}
                          <div className="absolute top-3 left-3">
                            <span className="rounded-xl bg-white/90 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-pink-700 shadow-sm backdrop-blur-md">
                              {k.category || "Decoração"}
                            </span>
                          </div>

                          {/* Preço em destaque */}
                          <div className="absolute top-3 right-3">
                            <span className="rounded-xl bg-stone-900/90 px-3 py-1 text-xs font-black text-white shadow-sm backdrop-blur-md">
                              {brl(k.rentalPrice || 0)}
                            </span>
                          </div>
                        </div>

                        {/* Conteúdo do Card */}
                        <div className="p-4 space-y-2.5">
                          {/* Badge de Disponibilidade por Data */}
                          {avail ? (
                            <div
                              className={`rounded-xl px-3 py-1.5 text-xs font-bold flex items-center justify-between ${
                                isUnavailable
                                  ? "bg-rose-100 text-rose-700 border border-rose-200"
                                  : avail.statusColor === "amber"
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                <span>{isUnavailable ? "🔴" : "🟢"}</span>
                                {isUnavailable
                                  ? `Locado para ${fmtDate(selectedDate)}`
                                  : `Disponível para ${fmtDate(selectedDate)}`}
                              </span>
                              {!isUnavailable && avail.remainingQty > 1 && (
                                <span className="text-[10px] opacity-80 shrink-0">
                                  {avail.remainingQty} unids.
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] font-semibold text-stone-400 flex items-center gap-1">
                              <span>✨</span> Decoração completa pronta para locação
                            </div>
                          )}

                          <h3
                            className="font-extrabold text-stone-800 text-base leading-snug cursor-pointer group-hover:text-pink-600 transition"
                            onClick={() => setSelectedKitModal(k)}
                          >
                            {k.name}
                          </h3>

                          {k.description && (
                            <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                              {k.description}
                            </p>
                          )}

                          {/* Peças Inclusas */}
                          {k.items && k.items.length > 0 && (
                            <div className="rounded-2xl bg-stone-50 p-2.5 border border-stone-100 text-xs">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                                Acompanha ({k.items.length} itens):
                              </p>
                              <p className="text-stone-700 line-clamp-2 text-[11px] leading-tight">
                                {k.items.map((it) => `${it.itemName} (${it.quantity}x)`).join(", ")}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botão de Ação / Reserva WhatsApp */}
                      <div className="p-4 pt-0">
                        {companyPhone && (
                          <a
                            href={
                              isUnavailable
                                ? waLink(
                                    companyPhone,
                                    `Olá! Vi o kit *${k.name}* no catálogo. Gostaria de saber outras opções ou datas disponíveis!`
                                  )
                                : waLink(
                                    companyPhone,
                                    `Olá! Gostei do kit de decoração *${k.name}* (${brl(
                                      k.rentalPrice || 0
                                    )}) no catálogo e gostaria de reservar ${
                                      selectedDate ? `para o dia *${fmtDate(selectedDate)}*` : ""
                                    }!`
                                  )
                            }
                            target="_blank"
                            rel="noreferrer"
                            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 px-4 text-xs font-bold transition shadow-sm ${
                              isUnavailable
                                ? "bg-stone-100 text-stone-600 hover:bg-stone-200"
                                : "bg-emerald-500 text-white shadow-emerald-200 hover:bg-emerald-600"
                            }`}
                          >
                            <Icon.wa className="h-4 w-4" />
                            {isUnavailable ? "Consultar Outra Data" : "Reservar no WhatsApp"}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA 2: PEÇAS AVULSAS */}
        {activeTab === "items" && (
          <div>
            {filteredItems.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-stone-100 p-8">
                <span className="text-5xl block mb-3">📦</span>
                <h3 className="text-lg font-bold text-stone-800">Nenhuma peça avulsa no momento</h3>
                <p className="text-stone-400 text-xs mt-1">Este catálogo ainda não possui peças individuais cadastradas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredItems.map((item) => {
                  const mainPhoto = (item.photos && item.photos.length > 0) ? item.photos[0] : item.photo;
                  return (
                    <div
                      key={item.id}
                      className="group flex flex-col justify-between overflow-hidden rounded-2xl bg-white shadow-xs transition hover:shadow-lg hover:shadow-pink-100 border border-stone-100"
                    >
                      <div>
                        <div className="relative aspect-square w-full bg-stone-100 overflow-hidden">
                          {mainPhoto ? (
                            <img
                              src={mainPhoto}
                              alt={item.name}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-stone-300">
                              <span className="text-3xl">📦</span>
                            </div>
                          )}
                          {item.rentalPrice && item.rentalPrice > 0 ? (
                            <div className="absolute top-2 right-2">
                              <span className="rounded-lg bg-stone-900/80 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                                {brl(item.rentalPrice)}
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <div className="p-3">
                          <h4 className="font-bold text-stone-800 text-xs line-clamp-2 leading-snug">
                            {item.name}
                          </h4>
                          <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-md mt-1 inline-block">
                            {item.quantity} {item.quantity === 1 ? "unidade" : "unidades"}
                          </span>
                        </div>
                      </div>

                      {companyPhone && (
                        <div className="p-3 pt-0">
                          <a
                            href={waLink(
                              companyPhone,
                              `Olá! Gostei da peça *${item.name}* no catálogo e gostaria de saber sobre locação!`
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="flex w-full items-center justify-center gap-1 rounded-xl bg-stone-100 py-1.5 text-[10px] font-bold text-stone-700 hover:bg-emerald-500 hover:text-white transition"
                          >
                            <Icon.wa className="h-3 w-3" /> Reservar Peça
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal de Detalhes do Kit com Zoom */}
      {selectedKitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-stone-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-pink-600">
                  {selectedKitModal.category || "Decoração Completa"}
                </span>
                <h3 className="text-lg font-black text-stone-800">{selectedKitModal.name}</h3>
              </div>
              <button
                onClick={() => setSelectedKitModal(null)}
                className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                ✕
              </button>
            </div>

            {/* Imagem em destaque */}
            <div className="relative aspect-4/3 w-full rounded-2xl bg-stone-100 overflow-hidden shadow-inner">
              {selectedKitModal.photos && selectedKitModal.photos.length > 0 ? (
                <img
                  src={selectedKitModal.photos[0]}
                  alt={selectedKitModal.name}
                  className="h-full w-full object-cover"
                />
              ) : selectedKitModal.photo ? (
                <img
                  src={selectedKitModal.photo}
                  alt={selectedKitModal.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-6xl">🎁</div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-stone-500">Valor de Locação</span>
                  <p className="text-xl font-black text-pink-600">{brl(selectedKitModal.rentalPrice || 0)}</p>
                </div>
                {selectedDate && availabilityMap[selectedKitModal.id] && (
                  <div className="text-right">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                        !availabilityMap[selectedKitModal.id].isAvailable
                          ? "bg-rose-100 text-rose-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {availabilityMap[selectedKitModal.id].isAvailable
                        ? `🟢 Disponível em ${fmtDate(selectedDate)}`
                        : `🔴 Locado em ${fmtDate(selectedDate)}`}
                    </span>
                  </div>
                )}
              </div>

              {selectedKitModal.description && (
                <p className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3 rounded-2xl border border-stone-100">
                  {selectedKitModal.description}
                </p>
              )}

              {/* Peças que acompanham */}
              {selectedKitModal.items && selectedKitModal.items.length > 0 && (
                <div className="rounded-2xl border border-stone-100 p-3.5 space-y-2">
                  <h5 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Peças inclusas no Kit ({selectedKitModal.items.length}):
                  </h5>
                  <ul className="divide-y divide-stone-100 text-xs text-stone-600">
                    {selectedKitModal.items.map((it, idx) => (
                      <li key={idx} className="py-1.5 flex justify-between items-center">
                        <span className="font-medium text-stone-700">{it.itemName}</span>
                        <span className="font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-lg">
                          {it.quantity}x
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setSelectedKitModal(null)}
                className="flex-1 rounded-2xl bg-stone-100 py-3 text-xs font-bold text-stone-600 hover:bg-stone-200 transition"
              >
                Voltar
              </button>

              {companyPhone && (
                <a
                  href={waLink(
                    companyPhone,
                    `Olá! Tenho interesse no kit de decoração *${selectedKitModal.name}* (${brl(
                      selectedKitModal.rentalPrice || 0
                    )}) ${selectedDate ? `para o dia *${fmtDate(selectedDate)}*` : ""}. Poderia me passar mais detalhes?`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-2 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition"
                >
                  <Icon.wa className="h-4 w-4" />
                  Reservar este Kit no WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Fixo */}
      <footer className="fixed bottom-0 inset-x-0 bg-white/95 border-t border-stone-200/80 py-3 px-4 text-center z-20 backdrop-blur-md">
        <div className="mx-auto max-w-5xl flex items-center justify-between text-xs font-medium text-stone-500">
          <span>
            {companyTradeName} • Pegue e Monte
          </span>
          <span className="text-[11px] text-stone-400">
            Powered by <b>EventFlow CRM</b>
          </span>
        </div>
      </footer>
    </div>
  );
}
