import { useState, useRef, useMemo } from "react";
import { Card, SectionTitle, Button, Modal, Field, Input, Select, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { brl, uid } from "../lib/format";
import { useToast } from "../components/Toast";
import type { PartyTheme, ThemeStatus } from "../lib/types";
import { compressImage } from "../utils/image";
import { storage } from "../lib/firebase";
import { ref, uploadString, getDownloadURL } from "firebase/storage";

const STATUSES: ThemeStatus[] = ["Disponível", "Reservado", "Em manutenção"];
const statusColor: Record<ThemeStatus, string> = {
  Disponível: "green",
  Reservado: "gold",
  "Em manutenção": "amber",
};
const EMOJIS = [
  "🎀", "🌸", "👑", "🦄", "🦁", "🚀", "🌷", "🐶", "⚽", "🧜‍♀️", "🦕", "🌈", "🐉", "🍓", "🩵", "✨", "🎈", "🎂", "🎪", "🏰"
];

const emptyTheme = (): PartyTheme => ({
  id: uid(),
  name: "",
  photo: "🎀",
  pieces: 0,
  invested: 0,
  rentals: 0,
  revenue: 0,
  status: "Disponível",
});

export default function Inventory() {
  const { themes, setThemes, tenantId, logAction } = useStore();
  const toast = useToast();

  const [openTheme, setOpenTheme] = useState(false);
  const [t, setT] = useState<PartyTheme>(emptyTheme());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [photoType, setPhotoType] = useState<"emoji" | "upload">("emoji");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const safeThemes = themes || [];

  const filteredThemes = useMemo(() => {
    return safeThemes.filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "Todos" ? true : item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [safeThemes, search, statusFilter]);

  const totalInvested = safeThemes.reduce((s, it) => s + (it.invested || 0), 0);
  const totalRevenue = safeThemes.reduce((s, it) => s + (it.revenue || 0), 0);
  const totalRentals = safeThemes.reduce((s, it) => s + (it.rentals || 0), 0);
  const averageRoi = totalInvested > 0 ? ((totalRevenue - totalInvested) / totalInvested) * 100 : 0;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    toast("Otimizando foto do tema...");
    try {
      const compressed = await compressImage(file, 900, 0.82);
      if (compressed.startsWith("data:image")) {
        try {
          const fileName = `tenants/${tenantId}/themes/${t.id || uid()}/${uid()}.jpg`;
          const sRef = ref(storage, fileName);
          await uploadString(sRef, compressed, "data_url");
          const url = await getDownloadURL(sRef);
          setT((prev) => ({ ...prev, photo: url }));
          toast("Foto do tema enviada com sucesso!");
        } catch {
          setT((prev) => ({ ...prev, photo: compressed }));
          toast("Foto carregada!");
        }
      }
    } catch {
      toast("Erro ao carregar imagem.");
    } finally {
      setUploading(false);
    }
  };

  const saveTheme = () => {
    if (!t.name.trim()) return toast("Informe o nome do tema");
    const exists = safeThemes.some((x) => x.id === t.id);
    const updated = exists ? safeThemes.map((x) => (x.id === t.id ? t : x)) : [t, ...safeThemes];
    setThemes(updated);
    setOpenTheme(false);
    logAction(exists ? "Tema Atualizado" : "Novo Tema Cadastrado", `${t.name} (${t.pieces || 0} peças)`);
    toast(exists ? "Tema atualizado com sucesso!" : "Tema adicionado ao acervo!");
  };

  const deleteTheme = (id: string) => {
    if (!confirm("Deseja realmente excluir este tema do acervo?")) return;
    setThemes(safeThemes.filter((x) => x.id !== id));
    setOpenTheme(false);
    logAction("Tema Removido", `ID: ${id}`);
    toast("Tema removido do acervo.");
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Controle de Acervo (Temas)"
        subtitle="Gerencie seus temas completos de festa, locações e retorno sobre investimento"
        action={
          <Button
            onClick={() => {
              setT(emptyTheme());
              setPhotoType("emoji");
              setOpenTheme(true);
            }}
          >
            <Icon.plus className="h-4 w-4" /> + Novo Tema
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="!p-4">
          <p className="text-xs font-medium text-stone-500">Temas no Acervo</p>
          <p className="mt-1 text-2xl font-bold text-stone-800">{safeThemes.length}</p>
          <p className="text-[11px] text-stone-400">temas cadastrados</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-medium text-stone-500">Total Investido</p>
          <p className="mt-1 text-2xl font-bold text-stone-700">{brl(totalInvested)}</p>
          <p className="text-[11px] text-stone-400">custo de montagem</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-medium text-stone-500">Já Faturado</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{brl(totalRevenue)}</p>
          <p className="text-[11px] text-stone-400">receita de locações</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-medium text-stone-500">Total de Locações</p>
          <p className="mt-1 text-2xl font-bold text-lilac-500">{totalRentals}x</p>
          <p className="text-[11px] text-stone-400">ROI Médio: {averageRoi.toFixed(0)}%</p>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="!p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Icon.dashboard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              className="pl-9 !bg-white"
              placeholder="Buscar tema por nome (Ex: Stitch, Safari, Moana)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="!w-auto !bg-white text-xs font-medium"
            >
              <option value="Todos">Todos os status</option>
              <option value="Disponível">Disponíveis</option>
              <option value="Reservado">Reservados</option>
              <option value="Em manutenção">Em Manutenção</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Themes Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredThemes.map((item) => {
          const roi = item.invested ? ((item.revenue - item.invested) / item.invested) * 100 : 0;
          const isImg = item.photo && (item.photo.startsWith("http") || item.photo.startsWith("data:"));

          return (
            <Card
              key={item.id}
              className="animate-rise flex flex-col justify-between relative overflow-hidden transition hover:shadow-xl hover:shadow-lilac-200/50"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-nude-100 to-lilac-100 overflow-hidden shrink-0 border border-stone-100 shadow-sm">
                      {isImg ? (
                        <img src={item.photo} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-3xl">{item.photo || "🎀"}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-stone-800 text-base leading-snug truncate">
                        {item.name}
                      </h3>
                      <p className="text-xs text-stone-500 font-medium">{item.pieces} peças inclusas</p>
                    </div>
                  </div>
                  <Badge color={statusColor[item.status] || "gray"}>{item.status}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white/70 p-2.5 border border-stone-100">
                    <p className="text-[10px] uppercase font-semibold text-stone-400">Investimento</p>
                    <p className="font-bold text-stone-700 text-sm mt-0.5">{brl(item.invested || 0)}</p>
                  </div>
                  <div className="rounded-xl bg-white/70 p-2.5 border border-stone-100">
                    <p className="text-[10px] uppercase font-semibold text-stone-400">Já faturou</p>
                    <p className="font-bold text-emerald-600 text-sm mt-0.5">{brl(item.revenue || 0)}</p>
                  </div>
                  <div className="rounded-xl bg-white/70 p-2.5 border border-stone-100">
                    <p className="text-[10px] uppercase font-semibold text-stone-400">Locações</p>
                    <p className="font-bold text-lilac-500 text-sm mt-0.5">{item.rentals || 0}x</p>
                  </div>
                  <div className="rounded-xl bg-white/70 p-2.5 border border-stone-100">
                    <p className="text-[10px] uppercase font-semibold text-stone-400">Retorno (ROI)</p>
                    <p
                      className={`font-bold text-sm mt-0.5 ${
                        roi >= 0 ? "text-emerald-600" : "text-rose-500"
                      }`}
                    >
                      {roi.toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 flex gap-2">
                <Button
                  variant="soft"
                  className="flex-1 !py-1.5 text-xs font-semibold"
                  onClick={() => {
                    setT(item);
                    setPhotoType(
                      item.photo && (item.photo.startsWith("http") || item.photo.startsWith("data:"))
                        ? "upload"
                        : "emoji"
                    );
                    setOpenTheme(true);
                  }}
                >
                  <Icon.edit className="h-3.5 w-3.5" /> Editar Tema
                </Button>
                <Button
                  variant="soft"
                  className="!text-rose-500 !py-1.5 text-xs"
                  onClick={() => deleteTheme(item.id)}
                >
                  Excluir
                </Button>
              </div>
            </Card>
          );
        })}

        {filteredThemes.length === 0 && (
          <div className="col-span-full py-16 text-center text-stone-400">
            <span className="text-4xl block mb-2">🎀</span>
            <p className="font-medium text-base text-stone-600">Nenhum tema encontrado</p>
            <p className="text-xs text-stone-400 mt-1">
              Cadastre seus temas completos de festa para gerenciar peças e retorno de investimento.
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                setT(emptyTheme());
                setPhotoType("emoji");
                setOpenTheme(true);
              }}
            >
              <Icon.plus className="h-4 w-4" /> + Cadastrar Primeiro Tema
            </Button>
          </div>
        )}
      </div>

      {/* Modal Tema */}
      <Modal
        open={openTheme}
        onClose={() => setOpenTheme(false)}
        title={safeThemes.some((x) => x.id === t.id) ? "Editar Tema do Acervo" : "Novo Tema no Acervo"}
        wide
      >
        <div className="space-y-4 mt-2">
          {/* Photo Mode Selection */}
          <div>
            <label className="text-xs font-semibold text-stone-700 block mb-2">
              Ícone ou Foto de Capa do Tema:
            </label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setPhotoType("emoji")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                  photoType === "emoji"
                    ? "bg-pink-50 border-pink-300 text-pink-700 shadow-sm"
                    : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                }`}
              >
                ✨ Escolher Emoji
              </button>
              <button
                type="button"
                onClick={() => setPhotoType("upload")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                  photoType === "upload"
                    ? "bg-pink-50 border-pink-300 text-pink-700 shadow-sm"
                    : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                }`}
              >
                📷 Enviar Foto Real
              </button>
            </div>

            {photoType === "emoji" ? (
              <div className="flex flex-wrap gap-2 p-3 bg-stone-50 rounded-2xl border border-stone-200 max-h-40 overflow-y-auto">
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setT({ ...t, photo: em })}
                    className={`grid h-11 w-11 place-items-center rounded-xl text-2xl transition ${
                      t.photo === em
                        ? "bg-gradient-to-br from-nude-400 to-lilac-400 text-white scale-110 shadow-md"
                        : "bg-white hover:bg-stone-100 shadow-sm"
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="h-20 w-20 rounded-2xl bg-white border border-stone-200 overflow-hidden grid place-items-center shrink-0">
                  {t.photo && (t.photo.startsWith("http") || t.photo.startsWith("data:")) ? (
                    <img src={t.photo} alt="Prévia" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl">{t.photo || "📷"}</span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <Button
                    type="button"
                    variant="soft"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="!py-2 text-xs"
                  >
                    {uploading ? "Enviando..." : "Selecionar Foto da Galeria"}
                  </Button>
                  <p className="text-[11px] text-stone-400 mt-1">Formatos JPG, PNG ou WebP. Compressão automática.</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do tema">
              <Input
                value={t.name}
                onChange={(e) => setT({ ...t, name: e.target.value })}
                placeholder="Ex: Safari Baby, Stitch, Princesas..."
              />
            </Field>
            <Field label="Quantidade de peças incluídas">
              <Input
                type="number"
                value={t.pieces || ""}
                onChange={(e) => setT({ ...t, pieces: Number(e.target.value) || 0 })}
                placeholder="Ex: 12"
              />
            </Field>
            <Field label="Valor investido para montagem (R$)">
              <Input
                type="number"
                value={t.invested || ""}
                onChange={(e) => setT({ ...t, invested: Number(e.target.value) || 0 })}
                placeholder="0,00"
              />
            </Field>
            <Field label="Valor já faturado com este tema (R$)">
              <Input
                type="number"
                value={t.revenue || ""}
                onChange={(e) => setT({ ...t, revenue: Number(e.target.value) || 0 })}
                placeholder="0,00"
              />
            </Field>
            <Field label="Quantidade total de locações">
              <Input
                type="number"
                value={t.rentals || ""}
                onChange={(e) => setT({ ...t, rentals: Number(e.target.value) || 0 })}
                placeholder="0"
              />
            </Field>
            <Field label="Status do tema">
              <Select
                value={t.status}
                onChange={(e) => setT({ ...t, status: e.target.value as ThemeStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4">
            {safeThemes.some((x) => x.id === t.id) ? (
              <Button
                variant="soft"
                className="!text-rose-500"
                onClick={() => deleteTheme(t.id)}
              >
                Excluir Tema
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpenTheme(false)}>
                Cancelar
              </Button>
              <Button onClick={saveTheme}>Salvar Tema</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
