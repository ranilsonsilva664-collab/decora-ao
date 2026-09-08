import { useState, useRef, useMemo } from "react";
import { Card, SectionTitle, Button, Modal, Field, Input, Textarea, Select, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { uid, brl, fmtDate } from "../lib/format";
import { useToast } from "../components/Toast";
import { compressImage } from "../utils/image";
import type { InventoryItem, Kit, KitItemComponent, ItemCondition, ItemStatus } from "../lib/types";
import { storage } from "../lib/firebase";
import { ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { getItemAvailability, getItemReservations } from "../lib/availability";

const generateItemCode = (existingCount: number) => {
  return `AC-${String(existingCount + 1).padStart(3, "0")}`;
};

const emptyItem = (existingCount = 0): InventoryItem => ({
  id: uid(),
  code: generateItemCode(existingCount),
  name: "",
  category: "Geral",
  description: "",
  quantity: 1,
  inMaintenance: 0,
  damaged: 0,
  lost: 0,
  rentalPrice: 0,
  replacementPrice: 0,
  condition: "Ótimo",
  notes: "",
  photos: [],
  showInCatalog: false,
  status: "Ativo",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const emptyKit = (): Kit => ({
  id: uid(),
  name: "",
  category: "Kits",
  description: "",
  rentalPrice: 0,
  photos: [],
  items: [],
  showInCatalog: false,
  createdAt: new Date().toISOString(),
});

export default function Stock() {
  const {
    inventoryItems,
    setInventoryItems,
    kits,
    setKits,
    categories,
    setCategories,
    eventsList,
    catalogEnabled,
    setCatalogEnabled,
    tenantId,
    logAction,
  } = useStore();

  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"items" | "kits" | "categories" | "catalog">("items");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");

  // Item Modal State
  const [openItem, setOpenItem] = useState(false);
  const [item, setItem] = useState<InventoryItem>(emptyItem());
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Kit Modal State
  const [openKit, setOpenKit] = useState(false);
  const [kit, setKit] = useState<Kit>(emptyKit());
  const [kitUploading, setKitUploading] = useState(false);
  const kitFileInputRef = useRef<HTMLInputElement>(null);

  // Kit Component selector helper state
  const [selectedCompItemId, setSelectedCompItemId] = useState("");
  const [selectedCompQty, setSelectedCompQty] = useState(1);

  // Category State
  const [newCatName, setNewCatName] = useState("");
  const [editingCat, setEditingCat] = useState<{ oldName: string; newName: string } | null>(null);

  // Calendar / Occupancy view for an Item
  const [calendarItem, setCalendarItem] = useState<InventoryItem | null>(null);

  const safeItems = inventoryItems || [];
  const safeKits = kits || [];
  const safeCategories = categories && categories.length > 0 ? categories : ["Painéis", "Cilindros", "Mesas", "Bandejas", "Kits", "Outros"];

  // Metrics
  const totalPieces = safeItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
  const inMaintenancePieces = safeItems.reduce((acc, it) => acc + (it.inMaintenance || 0), 0);
  const damagedPieces = safeItems.reduce((acc, it) => acc + (it.damaged || 0), 0);
  const lostPieces = safeItems.reduce((acc, it) => acc + (it.lost || 0), 0);
  const totalValueRental = safeItems.reduce((acc, it) => acc + (it.rentalPrice || 0) * (it.quantity || 0), 0);

  // Filtered items
  const filteredItems = useMemo(() => {
    return safeItems.filter((it) => {
      const matchSearch =
        it.name.toLowerCase().includes(search.toLowerCase()) ||
        (it.code && it.code.toLowerCase().includes(search.toLowerCase())) ||
        (it.category && it.category.toLowerCase().includes(search.toLowerCase()));

      const matchCat = selectedCategory === "Todas" ? true : it.category === selectedCategory;
      const matchStatus =
        statusFilter === "Todos"
          ? true
          : statusFilter === "Ativo"
          ? it.status !== "Arquivado"
          : it.status === statusFilter;

      return matchSearch && matchCat && matchStatus;
    });
  }, [safeItems, search, selectedCategory, statusFilter]);

  // Save Item
  const saveItem = async () => {
    if (!item.name.trim()) return toast("Informe o nome da peça");
    if (item.quantity < 1) return toast("A quantidade total deve ser no mínimo 1");

    setSaving(true);
    toast("Salvando peça no acervo...");
    try {
      const finalPhotos: string[] = [];
      const currentPhotos = item.photos || (item.photo ? [item.photo] : []);

      for (let i = 0; i < currentPhotos.length; i++) {
        const p = currentPhotos[i];
        if (p.startsWith("data:image")) {
          const fileName = `tenants/${tenantId}/stock/${item.id}/${uid()}.jpg`;
          const sRef = ref(storage, fileName);
          await uploadString(sRef, p, "data_url");
          const url = await getDownloadURL(sRef);
          finalPhotos.push(url);
        } else {
          finalPhotos.push(p);
        }
      }

      // Cleanup removed photos
      const existing = safeItems.find((x) => x.id === item.id);
      if (existing) {
        const oldPhotos = existing.photos || (existing.photo ? [existing.photo] : []);
        for (const old of oldPhotos) {
          if (old.includes("firebasestorage") && !finalPhotos.includes(old)) {
            try {
              await deleteObject(ref(storage, old));
            } catch (e) {
              console.error("Erro ao deletar foto antiga", e);
            }
          }
        }
      }

      const finalItem: InventoryItem = {
        ...item,
        code: item.code || generateItemCode(safeItems.length),
        category: item.category || "Outros",
        photos: finalPhotos,
        photo: finalPhotos[0] || "",
        updatedAt: new Date().toISOString(),
        status: item.status || "Ativo",
      };

      const exists = safeItems.some((x) => x.id === item.id);
      const updated = exists
        ? safeItems.map((x) => (x.id === item.id ? finalItem : x))
        : [finalItem, ...safeItems];

      setInventoryItems(updated);
      setOpenItem(false);
      logAction(
        exists ? "Peça Atualizada" : "Nova Peça Cadastrada",
        `${finalItem.code || ""} - ${finalItem.name} (${finalItem.quantity} un.)`
      );
      toast(exists ? "Peça atualizada no acervo!" : "Peça adicionada ao acervo!");
    } catch (err) {
      console.error(err);
      toast("Erro ao salvar imagens no banco de dados.");
    } finally {
      setSaving(false);
    }
  };

  // Duplicate Item
  const duplicateItem = (source: InventoryItem) => {
    const duplicated: InventoryItem = {
      ...source,
      id: uid(),
      code: generateItemCode(safeItems.length),
      name: `${source.name} (Cópia)`,
      inMaintenance: 0,
      damaged: 0,
      lost: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setInventoryItems([duplicated, ...safeItems]);
    logAction("Peça Duplicada", `De: ${source.name} -> ${duplicated.name}`);
    toast("Peça duplicada com sucesso!");
  };

  // Archive / Unarchive
  const toggleArchiveItem = (target: InventoryItem) => {
    const newStatus: ItemStatus = target.status === "Arquivado" ? "Ativo" : "Arquivado";
    const updated = safeItems.map((x) => (x.id === target.id ? { ...x, status: newStatus } : x));
    setInventoryItems(updated);
    toast(newStatus === "Arquivado" ? "Peça arquivada" : "Peça reativada no acervo");
  };

  // Delete Item (safe deletion)
  const deleteItem = async (id: string) => {
    // Check if item is in events or quotes
    const isUsedInEvent = eventsList.some((ev) =>
      (ev.items || []).some((it) => it.id === id)
    );
    const isUsedInKit = safeKits.some((k) => (k.items || []).some((c) => c.itemId === id));

    if (isUsedInEvent) {
      return toast("⚠️ Esta peça possui histórico de locações. Use a opção 'Arquivar' para preservá-la.");
    }
    if (isUsedInKit) {
      return toast("⚠️ Esta peça faz parte de um Kit cadastrado. Remova-a do kit antes de excluir.");
    }

    if (!confirm("Deseja realmente excluir esta peça do acervo?")) return;

    const existing = safeItems.find((x) => x.id === id);
    if (existing) {
      toast("Excluindo item...");
      const oldPhotos = existing.photos || (existing.photo ? [existing.photo] : []);
      for (const old of oldPhotos) {
        if (old.includes("firebasestorage")) {
          try {
            await deleteObject(ref(storage, old));
          } catch (e) {
            console.error(e);
          }
        }
      }
      setInventoryItems(safeItems.filter((x) => x.id !== id));
      setOpenItem(false);
      logAction("Peça Excluída", existing.name);
      toast("Peça removida do acervo.");
    }
  };

  // Photos file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentPhotos = item.photos || (item.photo ? [item.photo] : []);
    if (currentPhotos.length + files.length > 6) {
      toast("Você pode adicionar no máximo 6 fotos por peça.");
      return;
    }

    setUploading(true);
    try {
      const newPhotos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await compressImage(file, 800, 0.7);
        newPhotos.push(base64);
      }
      setItem({ ...item, photos: [...currentPhotos, ...newPhotos] });
    } catch {
      toast("Erro ao processar imagem.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    const currentPhotos = item.photos || (item.photo ? [item.photo] : []);
    const newPhotos = [...currentPhotos];
    newPhotos.splice(index, 1);
    setItem({ ...item, photos: newPhotos });
  };

  // Kit functions
  const saveKit = () => {
    if (!kit.name.trim()) return toast("Informe o nome do Kit");
    if (kit.items.length === 0) return toast("Adicione pelo menos uma peça ao Kit");

    const exists = safeKits.some((k) => k.id === kit.id);
    const updated = exists ? safeKits.map((k) => (k.id === kit.id ? kit : k)) : [kit, ...safeKits];
    setKits(updated);
    setOpenKit(false);
    logAction(exists ? "Kit Atualizado" : "Novo Kit Criado", `${kit.name} (${kit.items.length} peças)`);
    toast(exists ? "Kit atualizado!" : "Kit cadastrado!");
  };

  const addComponentToKit = () => {
    if (!selectedCompItemId) return toast("Selecione uma peça");
    if (selectedCompQty < 1) return toast("Informe a quantidade");

    const foundItem = safeItems.find((i) => i.id === selectedCompItemId);
    if (!foundItem) return;

    const existingIdx = kit.items.findIndex((c) => c.itemId === selectedCompItemId);
    if (existingIdx >= 0) {
      const copy = [...kit.items];
      copy[existingIdx].quantity += selectedCompQty;
      setKit({ ...kit, items: copy });
    } else {
      const newComp: KitItemComponent = {
        itemId: foundItem.id,
        itemName: foundItem.name,
        quantity: selectedCompQty,
      };
      setKit({ ...kit, items: [...kit.items, newComp] });
    }
    setSelectedCompItemId("");
    setSelectedCompQty(1);
    toast("Peça adicionada ao kit!");
  };

  const removeComponentFromKit = (itemId: string) => {
    setKit({ ...kit, items: kit.items.filter((c) => c.itemId !== itemId) });
  };

  // Categories functions
  const addCategory = () => {
    const name = newCatName.trim();
    if (!name) return toast("Digite o nome da categoria");
    if (safeCategories.includes(name)) return toast("Esta categoria já existe");

    const updated = [...safeCategories, name];
    setCategories(updated);
    setNewCatName("");
    toast("Categoria adicionada!");
  };

  const saveRenameCategory = () => {
    if (!editingCat || !editingCat.newName.trim()) return;
    const oldN = editingCat.oldName;
    const newN = editingCat.newName.trim();

    const updatedCats = safeCategories.map((c) => (c === oldN ? newN : c));
    setCategories(updatedCats);

    // Update items with this category
    const updatedItems = safeItems.map((it) => (it.category === oldN ? { ...it, category: newN } : it));
    setInventoryItems(updatedItems);

    setEditingCat(null);
    toast("Categoria renomeada!");
  };

  const deleteCategory = (catName: string) => {
    const isUsed = safeItems.some((it) => it.category === catName);
    if (isUsed) {
      return toast("⚠️ Existem peças vinculadas a esta categoria. Altere a categoria das peças antes de excluir.");
    }
    setCategories(safeCategories.filter((c) => c !== catName));
    toast("Categoria removida");
  };

  const catalogUrl = `${window.location.origin}/catalog/${tenantId}`;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Acervo Inteligente"
        subtitle="Gerenciamento completo de peças, kits e controle real de estoque"
        action={
          <div className="flex flex-wrap gap-2">
            {activeTab === "items" && (
              <Button
                onClick={() => {
                  setItem(emptyItem(safeItems.length));
                  setOpenItem(true);
                }}
              >
                <Icon.plus className="h-4 w-4" /> + Adicionar Peça
              </Button>
            )}
            {activeTab === "kits" && (
              <Button
                onClick={() => {
                  setKit(emptyKit());
                  setOpenKit(true);
                }}
              >
                <Icon.plus className="h-4 w-4" /> + Adicionar Kit
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="!p-4">
          <p className="text-xs font-medium text-stone-500">Total no Acervo</p>
          <p className="mt-1 text-2xl font-bold text-stone-800">{totalPieces} un.</p>
          <p className="text-[11px] text-stone-400">{safeItems.length} cadastros</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-medium text-stone-500">Em Manutenção</p>
          <p className="mt-1 text-2xl font-bold text-amber-500">{inMaintenancePieces} un.</p>
          <p className="text-[11px] text-stone-400">fora de circulação</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-medium text-stone-500">Danificadas / Avarias</p>
          <p className="mt-1 text-2xl font-bold text-rose-500">{damagedPieces + lostPieces} un.</p>
          <p className="text-[11px] text-stone-400">{lostPieces} perdidas</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-medium text-stone-500">Potencial Locação</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{brl(totalValueRental)}</p>
          <p className="text-[11px] text-stone-400">giro total das peças</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-white/60 pb-1">
        <button
          onClick={() => setActiveTab("items")}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "items"
              ? "bg-gradient-to-r from-nude-400 to-lilac-400 text-white shadow-md shadow-lilac-200"
              : "bg-white/60 text-stone-600 hover:bg-white"
          }`}
        >
          <Icon.box className="h-4 w-4" /> Peças Individuais ({safeItems.length})
        </button>
        <button
          onClick={() => setActiveTab("kits")}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "kits"
              ? "bg-gradient-to-r from-nude-400 to-lilac-400 text-white shadow-md shadow-lilac-200"
              : "bg-white/60 text-stone-600 hover:bg-white"
          }`}
        >
          <span>🎁</span> Kits Prontos ({safeKits.length})
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "categories"
              ? "bg-gradient-to-r from-nude-400 to-lilac-400 text-white shadow-md shadow-lilac-200"
              : "bg-white/60 text-stone-600 hover:bg-white"
          }`}
        >
          <span>🏷️</span> Categorias ({safeCategories.length})
        </button>
        <button
          onClick={() => setActiveTab("catalog")}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "catalog"
              ? "bg-gradient-to-r from-nude-400 to-lilac-400 text-white shadow-md shadow-lilac-200"
              : "bg-white/60 text-stone-600 hover:bg-white"
          }`}
        >
          <Icon.ig className="h-4 w-4" /> Catálogo Público
        </button>
      </div>

      {/* TAB 1: PEÇAS INDIVIDUAIS */}
      {activeTab === "items" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <Card className="!p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Icon.dashboard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  className="pl-9 !bg-white"
                  placeholder="Buscar por nome, código (AC-001) ou categoria..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="!w-auto !bg-white text-xs font-medium"
                >
                  <option value="Todas">Todas as categorias</option>
                  {safeCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>

                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="!w-auto !bg-white text-xs font-medium"
                >
                  <option value="Todos">Todos os status</option>
                  <option value="Ativo">Ativos</option>
                  <option value="Arquivado">Arquivados</option>
                  <option value="Manutenção">Em Manutenção</option>
                </Select>
              </div>
            </div>
          </Card>

          {/* Items Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((it) => {
              const mainPhoto = it.photos && it.photos.length > 0 ? it.photos[0] : it.photo;
              const avail = getItemAvailability(it.id, "", "", safeItems, safeKits, eventsList);
              const isArchived = it.status === "Arquivado";

              return (
                <Card
                  key={it.id}
                  className={`animate-rise flex flex-col justify-between relative overflow-hidden transition hover:shadow-xl hover:shadow-lilac-200/50 ${
                    isArchived ? "opacity-60 bg-stone-50" : ""
                  }`}
                >
                  <div>
                    {/* Header badges */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="rounded-lg bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
                        {it.code || "AC"}
                      </span>
                      <div className="flex items-center gap-1">
                        {it.showInCatalog && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-600">
                            Catálogo
                          </span>
                        )}
                        <span className="rounded-full bg-lilac-50 px-2 py-0.5 text-[9px] font-semibold text-lilac-500">
                          {it.category || "Geral"}
                        </span>
                      </div>
                    </div>

                    {/* Image */}
                    <div className="relative h-36 w-full rounded-2xl bg-stone-100 overflow-hidden mb-3">
                      {mainPhoto ? (
                        <img src={mainPhoto} alt={it.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-stone-300">
                          <Icon.box className="h-10 w-10 opacity-30" />
                        </div>
                      )}
                      {it.condition && (
                        <span className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
                          {it.condition}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <h3 className="font-semibold text-stone-800 text-sm leading-snug line-clamp-2">
                      {it.name}
                    </h3>
                    {it.description && (
                      <p className="mt-1 text-xs text-stone-500 line-clamp-1">{it.description}</p>
                    )}

                    {/* Quantities Breakdown */}
                    <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-white/70 p-2 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-stone-400 block">Total</span>
                        <span className="font-bold text-stone-700">{it.quantity}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-500 block">Útil</span>
                        <span className="font-bold text-emerald-600">{avail.baseUsable}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-500 block">Avaria</span>
                        <span className="font-bold text-amber-600">
                          {(it.inMaintenance || 0) + (it.damaged || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Prices */}
                    <div className="mt-2 flex items-center justify-between text-xs px-1">
                      <span className="text-stone-500">Locação:</span>
                      <span className="font-bold text-stone-800">
                        {it.rentalPrice ? brl(it.rentalPrice) : "Sob consulta"}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setItem(it);
                        setOpenItem(true);
                      }}
                      className="flex-1 rounded-xl bg-white/80 py-2 text-xs font-semibold text-stone-700 hover:bg-white shadow-sm flex items-center justify-center gap-1"
                    >
                      <Icon.edit className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => setCalendarItem(it)}
                      title="Ver reservas e disponibilidade"
                      className="grid h-8 w-8 place-items-center rounded-xl bg-white/80 text-stone-600 hover:bg-white shadow-sm"
                    >
                      <Icon.calendar className="h-4 w-4 text-lilac-500" />
                    </button>
                    <button
                      onClick={() => duplicateItem(it)}
                      title="Duplicar peça"
                      className="grid h-8 w-8 place-items-center rounded-xl bg-white/80 text-stone-600 hover:bg-white shadow-sm"
                    >
                      <Icon.copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleArchiveItem(it)}
                      title={isArchived ? "Reativar peça" : "Arquivar peça"}
                      className={`grid h-8 w-8 place-items-center rounded-xl ${
                        isArchived ? "bg-emerald-50 text-emerald-600" : "bg-white/80 text-stone-400"
                      } hover:bg-white shadow-sm`}
                    >
                      <span>{isArchived ? "♻️" : "📦"}</span>
                    </button>
                  </div>
                </Card>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="col-span-full py-16 text-center text-stone-400">
                <Icon.box className="mx-auto h-12 w-12 text-stone-300 mb-2" />
                <p className="font-medium text-base text-stone-600">Nenhuma peça encontrada</p>
                <p className="text-xs text-stone-400 mt-1">
                  Tente alterar os filtros ou clique em "+ Adicionar Peça" para começar.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: KITS E COMPOSIÇÃO */}
      {activeTab === "kits" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {safeKits.map((k) => {
              const mainPhoto = k.photos && k.photos.length > 0 ? k.photos[0] : k.photo;
              return (
                <Card key={k.id} className="animate-rise flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Badge color="lilac">{k.category || "Kit Festa"}</Badge>
                      <span className="font-bold text-stone-800 text-sm">{brl(k.rentalPrice || 0)}</span>
                    </div>

                    <div className="relative h-32 w-full rounded-2xl bg-stone-100 overflow-hidden mb-3">
                      {mainPhoto ? (
                        <img src={mainPhoto} alt={k.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl">🎁</div>
                      )}
                    </div>

                    <h3 className="font-semibold text-stone-800 text-base">{k.name}</h3>
                    {k.description && <p className="text-xs text-stone-500 mt-1">{k.description}</p>}

                    {/* Components preview */}
                    <div className="mt-3 rounded-2xl bg-white/60 p-3">
                      <p className="text-[11px] font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
                        Peças inclusas ({k.items.length}):
                      </p>
                      <ul className="space-y-1 text-xs text-stone-600">
                        {k.items.map((comp, idx) => (
                          <li key={idx} className="flex justify-between items-center">
                            <span className="truncate">{comp.itemName}</span>
                            <span className="font-bold text-lilac-500 ml-2">{comp.quantity}x</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 flex gap-2">
                    <Button
                      variant="soft"
                      className="flex-1 !py-1.5 text-xs"
                      onClick={() => {
                        setKit(k);
                        setOpenKit(true);
                      }}
                    >
                      <Icon.edit className="h-3.5 w-3.5" /> Editar Kit
                    </Button>
                    <Button
                      variant="soft"
                      className="!text-rose-500 !py-1.5 text-xs"
                      onClick={() => {
                        if (confirm(`Excluir o Kit ${k.name}?`)) {
                          setKits(safeKits.filter((x) => x.id !== k.id));
                          toast("Kit removido!");
                        }
                      }}
                    >
                      Excluir
                    </Button>
                  </div>
                </Card>
              );
            })}

            {safeKits.length === 0 && (
              <div className="col-span-full py-16 text-center text-stone-400">
                <span className="text-4xl block mb-2">🎁</span>
                <p className="font-medium text-base text-stone-600">Nenhum Kit montado ainda</p>
                <p className="text-xs text-stone-400 mt-1">
                  Monte kits com painéis, cilindros, boleiras e bandejas para locar com facilidade.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => {
                    setKit(emptyKit());
                    setOpenKit(true);
                  }}
                >
                  <Icon.plus className="h-4 w-4" /> Criar Primeiro Kit
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CATEGORIAS */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          <Card>
            <SectionTitle
              title="Categorias Personalizadas"
              subtitle="Crie e organize as categorias das peças do seu acervo"
            />
            <div className="flex gap-2 max-w-md">
              <Input
                placeholder="Nome da nova categoria (Ex: Arco Orgânico)..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
              />
              <Button onClick={addCategory}>
                <Icon.plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {safeCategories.map((cat) => {
              const count = safeItems.filter((it) => it.category === cat).length;
              return (
                <Card key={cat} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold text-stone-800">{cat}</p>
                    <p className="text-xs text-stone-400">
                      {count} {count === 1 ? "peça cadastrada" : "peças cadastradas"}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setEditingCat({ oldName: cat, newName: cat })}
                      className="grid h-8 w-8 place-items-center rounded-xl bg-white/70 text-stone-500 hover:bg-white"
                      title="Renomear categoria"
                    >
                      <Icon.edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteCategory(cat)}
                      className="grid h-8 w-8 place-items-center rounded-xl bg-white/70 text-rose-500 hover:bg-white"
                      title="Excluir categoria"
                    >
                      ✕
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: CATÁLOGO ONLINE */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-lilac-50 to-nude-50 border-lilac-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-stone-800 text-lg flex items-center gap-2">
                  <Icon.ig className="h-5 w-5 text-lilac-500" />
                  Catálogo Online de Peças Avulsas
                </h3>
                <p className="text-sm text-stone-600 mt-1">
                  Seus clientes podem visualizar todas as peças marcadas com "Mostrar no Catálogo" através deste link.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-end gap-2 cursor-pointer text-stone-700">
                  <span className="font-medium text-sm">
                    {catalogEnabled ? "Catálogo Ativo" : "Catálogo Desativado"}
                  </span>
                  <input
                    type="checkbox"
                    checked={!!catalogEnabled}
                    onChange={(e) => setCatalogEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-lilac-500 focus:ring-lilac-400"
                  />
                </label>
                {catalogEnabled && (
                  <div className="flex gap-2">
                    <Button
                      variant="soft"
                      className="!text-stone-600 !px-3 !py-1.5 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(catalogUrl);
                        toast("Link do catálogo copiado!");
                      }}
                    >
                      Copiar Link
                    </Button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Olá! Confira nosso catálogo de peças para locação Pegue e Monte:\n\n${catalogUrl}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button variant="wa" className="!px-3 !py-1.5 text-xs">
                        <Icon.wa className="h-3 w-3" /> WhatsApp
                      </Button>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <div className="text-sm text-stone-500">
            Peças ativas no catálogo público:{" "}
            <b>{safeItems.filter((it) => it.showInCatalog).length} peças</b>
          </div>
        </div>
      )}

      {/* MODAL: ITEM DO ACERVO */}
      <Modal
        open={openItem}
        onClose={() => setOpenItem(false)}
        title={safeItems.some((x) => x.id === item.id) ? "Editar Peça do Acervo" : "Nova Peça no Acervo"}
        wide
      >
        <div className="space-y-4 mt-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Código do item">
              <Input
                value={item.code || ""}
                onChange={(e) => setItem({ ...item, code: e.target.value.toUpperCase() })}
                placeholder="Ex: AC-001"
                disabled={saving}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Nome da peça (Ex: Painel Romano Rosa, Cilindro P)">
                <Input
                  value={item.name}
                  onChange={(e) => setItem({ ...item, name: e.target.value })}
                  placeholder="Nome identificador"
                  disabled={saving}
                />
              </Field>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria">
              <Select
                value={item.category || "Outros"}
                onChange={(e) => setItem({ ...item, category: e.target.value })}
                disabled={saving}
              >
                {safeCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Estado de conservação">
              <Select
                value={item.condition || "Ótimo"}
                onChange={(e) => setItem({ ...item, condition: e.target.value as ItemCondition })}
                disabled={saving}
              >
                <option value="Novo">Novo (sem marcas)</option>
                <option value="Ótimo">Ótimo estado</option>
                <option value="Bom">Bom estado de uso</option>
                <option value="Regular">Regular / Marcas de uso</option>
              </Select>
            </Field>
          </div>

          {/* Quantities Section */}
          <div className="rounded-2xl bg-white/60 p-4 border border-white/80 space-y-3">
            <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Controle de Quantidade
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Quantidade TOTAL">
                <Input
                  type="number"
                  min="1"
                  value={item.quantity || ""}
                  onChange={(e) => setItem({ ...item, quantity: Math.max(1, +e.target.value) })}
                  disabled={saving}
                  className="font-bold text-stone-800"
                />
              </Field>
              <Field label="Em Manutenção">
                <Input
                  type="number"
                  min="0"
                  value={item.inMaintenance || 0}
                  onChange={(e) => setItem({ ...item, inMaintenance: Math.max(0, +e.target.value) })}
                  disabled={saving}
                  className="text-amber-600"
                />
              </Field>
              <Field label="Danificadas">
                <Input
                  type="number"
                  min="0"
                  value={item.damaged || 0}
                  onChange={(e) => setItem({ ...item, damaged: Math.max(0, +e.target.value) })}
                  disabled={saving}
                  className="text-rose-500"
                />
              </Field>
              <Field label="Perdidas / Extravio">
                <Input
                  type="number"
                  min="0"
                  value={item.lost || 0}
                  onChange={(e) => setItem({ ...item, lost: Math.max(0, +e.target.value) })}
                  disabled={saving}
                  className="text-stone-500"
                />
              </Field>
            </div>
            <p className="text-[11px] text-stone-500">
              * Itens em manutenção, danificados ou perdidos são descontados automaticamente da disponibilidade.
            </p>
          </div>

          {/* Pricing Section */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor de Locação (R$)">
              <Input
                type="number"
                step="0.01"
                value={item.rentalPrice || ""}
                onChange={(e) => setItem({ ...item, rentalPrice: +e.target.value })}
                placeholder="0.00"
                disabled={saving}
              />
            </Field>
            <Field label="Valor de Reposição em caso de perda/dano (R$)">
              <Input
                type="number"
                step="0.01"
                value={item.replacementPrice || ""}
                onChange={(e) => setItem({ ...item, replacementPrice: +e.target.value })}
                placeholder="0.00"
                disabled={saving}
              />
            </Field>
          </div>

          <Field label="Descrição e Detalhes da Peça">
            <Textarea
              value={item.description || ""}
              onChange={(e) => setItem({ ...item, description: e.target.value })}
              placeholder="Material, medidas, cor, instruções de cuidado..."
              disabled={saving}
            />
          </Field>

          {/* Photos Upload */}
          <Field label="Fotos da peça (Máximo 6)">
            <div className="space-y-3">
              <input
                type="file"
                accept="image/*"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                disabled={saving || uploading}
              />

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {((item.photos && item.photos.length > 0)
                  ? item.photos
                  : item.photo
                  ? [item.photo]
                  : []
                ).map((p, i) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-xl bg-stone-100 overflow-hidden border border-stone-200"
                  >
                    <img src={p} alt="Upload" className="h-full w-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      disabled={saving}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition disabled:opacity-50"
                    >
                      &times;
                    </button>
                  </div>
                ))}

                {((item.photos && item.photos.length > 0)
                  ? item.photos
                  : item.photo
                  ? [item.photo]
                  : []
                ).length < 6 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || saving}
                    className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-lilac-200 bg-lilac-50/50 text-lilac-500 transition hover:bg-lilac-50 disabled:opacity-50"
                  >
                    {uploading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-lilac-200 border-t-lilac-500" />
                    ) : (
                      <>
                        <Icon.plus className="h-5 w-5 mb-1" />
                        <span className="text-[10px] font-semibold">Adicionar</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </Field>

          {/* Catalog Checkbox */}
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-2xl bg-white/50 border border-white/70 hover:bg-white transition">
            <input
              type="checkbox"
              checked={!!item.showInCatalog}
              onChange={(e) => setItem({ ...item, showInCatalog: e.target.checked })}
              disabled={saving}
              className="h-5 w-5 rounded border-stone-300 text-lilac-500 focus:ring-lilac-400"
            />
            <div>
              <span className="font-semibold text-stone-700 block text-sm">
                Exibir esta peça no Catálogo Online Público
              </span>
              <span className="text-[11px] text-stone-500 leading-tight">
                Permite que clientes vejam fotos e detalhes desta peça pelo link do catálogo.
              </span>
            </div>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {safeItems.some((x) => x.id === item.id) && (
            <Button
              variant="soft"
              className="!text-rose-500"
              disabled={saving}
              onClick={() => deleteItem(item.id)}
            >
              Excluir Peça
            </Button>
          )}
          <Button variant="ghost" onClick={() => setOpenItem(false)} disabled={saving} className="ml-auto">
            Cancelar
          </Button>
          <Button onClick={saveItem} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Peça"}
          </Button>
        </div>
      </Modal>

      {/* MODAL: KIT */}
      <Modal
        open={openKit}
        onClose={() => setOpenKit(false)}
        title={safeKits.some((x) => x.id === kit.id) ? "Editar Kit" : "Criar Novo Kit"}
        wide
      >
        <div className="space-y-4 mt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do Kit (Ex: Kit Romano Rosa Completo)">
              <Input
                value={kit.name}
                onChange={(e) => setKit({ ...kit, name: e.target.value })}
                placeholder="Nome do Kit"
              />
            </Field>
            <Field label="Valor de Locação do Kit (R$)">
              <Input
                type="number"
                step="0.01"
                value={kit.rentalPrice || ""}
                onChange={(e) => setKit({ ...kit, rentalPrice: +e.target.value })}
                placeholder="0.00"
              />
            </Field>
          </div>

          <Field label="Descrição do Kit">
            <Textarea
              value={kit.description || ""}
              onChange={(e) => setKit({ ...kit, description: e.target.value })}
              placeholder="Indicação de tamanho de espaço, estilo e composição..."
            />
          </Field>

          {/* Component items in Kit */}
          <div className="rounded-2xl bg-white/70 p-4 border border-white/80 space-y-3">
            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Peças que compõem este Kit:
            </h4>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Select
                  value={selectedCompItemId}
                  onChange={(e) => setSelectedCompItemId(e.target.value)}
                  className="!bg-white text-xs"
                >
                  <option value="">Selecione uma peça do acervo...</option>
                  {safeItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.code ? `[${it.code}] ` : ""}
                      {it.name} (Estoque: {it.quantity} un.)
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-24">
                <Input
                  type="number"
                  min="1"
                  value={selectedCompQty}
                  onChange={(e) => setSelectedCompQty(Math.max(1, +e.target.value))}
                  placeholder="Qtd"
                  className="!bg-white"
                />
              </div>
              <Button onClick={addComponentToKit} className="!py-2 text-xs">
                + Incluir Peça
              </Button>
            </div>

            <div className="divide-y divide-stone-100 rounded-xl bg-white overflow-hidden border border-stone-100">
              {kit.items.map((comp) => (
                <div key={comp.itemId} className="flex items-center justify-between p-2.5 text-xs">
                  <span className="font-semibold text-stone-800">{comp.itemName}</span>
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-lilac-50 text-lilac-600 px-2 py-0.5 font-bold">
                      {comp.quantity} unidades
                    </span>
                    <button
                      onClick={() => removeComponentFromKit(comp.itemId)}
                      className="text-rose-400 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {kit.items.length === 0 && (
                <p className="p-4 text-center text-xs text-stone-400">
                  Nenhuma peça adicionada ainda a este kit.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setOpenKit(false)}>
            Cancelar
          </Button>
          <Button onClick={saveKit}>Salvar Kit</Button>
        </div>
      </Modal>

      {/* MODAL: CALENDÁRIO / OCUPAÇÃO DA PEÇA */}
      <Modal
        open={!!calendarItem}
        onClose={() => setCalendarItem(null)}
        title={calendarItem ? `Reservas de ${calendarItem.name}` : "Reservas"}
      >
        {calendarItem && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/70 p-3 border border-white/80 flex items-center justify-between text-xs">
              <span>
                Estoque Total: <b>{calendarItem.quantity} un.</b>
              </span>
              <span className="text-emerald-600 font-semibold">
                Útil para locação:{" "}
                {Math.max(
                  0,
                  calendarItem.quantity -
                    ((calendarItem.inMaintenance || 0) + (calendarItem.damaged || 0) + (calendarItem.lost || 0))
                )}{" "}
                un.
              </span>
            </div>

            <div className="space-y-2">
              {getItemReservations(calendarItem.id, safeItems, safeKits, eventsList).map((res, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-white p-3 border border-stone-100 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-stone-800">{res.clientName}</p>
                    <p className="text-stone-500">
                      {res.theme} • {fmtDate(res.pickupDate)} até {fmtDate(res.returnDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-lilac-500 text-sm">{res.quantity} alugadas</span>
                    <span className="block text-[10px] text-stone-400">{res.status}</span>
                  </div>
                </div>
              ))}

              {getItemReservations(calendarItem.id, safeItems, safeKits, eventsList).length === 0 && (
                <p className="py-6 text-center text-xs text-stone-400">
                  Esta peça está 100% livre, sem nenhuma reserva ativa nos próximos períodos.
                </p>
              )}
            </div>

            <Button variant="ghost" className="w-full" onClick={() => setCalendarItem(null)}>
              Fechar
            </Button>
          </div>
        )}
      </Modal>

      {/* MODAL: RENOMEAR CATEGORIA */}
      <Modal
        open={!!editingCat}
        onClose={() => setEditingCat(null)}
        title="Renomear Categoria"
      >
        {editingCat && (
          <div className="space-y-4">
            <Field label="Novo nome da categoria">
              <Input
                value={editingCat.newName}
                onChange={(e) => setEditingCat({ ...editingCat, newName: e.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditingCat(null)}>
                Cancelar
              </Button>
              <Button onClick={saveRenameCategory}>Salvar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
