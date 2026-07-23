import { useState } from "react";
import { Card, SectionTitle, Button, Modal, Field, Input } from "../components/ui";
import { Icon } from "../components/icons";
import { useStore } from "../lib/store";
import { uid } from "../lib/format";
import { useToast } from "../components/Toast";
import type { InventoryItem } from "../lib/types";

const emptyItem = (): InventoryItem => ({ id: uid(), name: "", quantity: 1, photo: "", showInCatalog: false });

export default function Stock() {
  const { inventoryItems, setInventoryItems, catalogEnabled, setCatalogEnabled, tenantId } = useStore();
  const toast = useToast();
  
  const [openItem, setOpenItem] = useState(false);
  const [item, setItem] = useState<InventoryItem>(emptyItem());

  const saveItem = () => {
    if (!item.name.trim()) return toast("Informe o nome do item");
    if (item.quantity < 1) return toast("A quantidade deve ser maior que zero");
    const safeItems = inventoryItems || [];
    const exists = safeItems.some((x) => x.id === item.id);
    setInventoryItems(exists ? safeItems.map((x) => (x.id === item.id ? item : x)) : [item, ...safeItems]);
    setOpenItem(false);
    toast(exists ? "Item atualizado!" : "Item adicionado!");
  };

  const safeItems = inventoryItems || [];
  const catalogUrl = `${window.location.origin}/catalog/${tenantId}`;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Estoque de Peças"
        subtitle="Controle suas peças individuais e o seu Catálogo online"
        action={<Button onClick={() => { setItem(emptyItem()); setOpenItem(true); }}><Icon.plus className="h-4 w-4" /> Nova peça</Button>}
      />

      <Card className="bg-gradient-to-br from-lilac-50 to-nude-50 border-lilac-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-stone-800 text-lg flex items-center gap-2">
              <Icon.ig className="h-5 w-5 text-lilac-500" />
              Catálogo Online
            </h3>
            <p className="text-sm text-stone-600 mt-1">Mostre suas peças avulsas para os clientes. As peças com a opção "Mostrar no Catálogo" ativada aparecerão neste link.</p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-end gap-2 cursor-pointer text-stone-700">
              <span className="font-medium text-sm">{catalogEnabled ? "Catálogo Ativo" : "Catálogo Desativado"}</span>
              <input type="checkbox" checked={!!catalogEnabled} onChange={e => setCatalogEnabled(e.target.checked)} className="h-4 w-4 rounded border-stone-300 text-lilac-500 focus:ring-lilac-400" />
            </label>
            {catalogEnabled && (
              <div className="flex gap-2">
                <Button variant="soft" className="!text-stone-600 !px-3 !py-1.5 text-xs" onClick={() => { navigator.clipboard.writeText(catalogUrl); toast("Link copiado!"); }}>Copiar Link</Button>
                <a href={`https://wa.me/?text=${encodeURIComponent(`Olá! Confira nosso catálogo de peças avulsas para locação:\n\n${catalogUrl}`)}`} target="_blank" rel="noreferrer">
                  <Button variant="wa" className="!px-3 !py-1.5 text-xs"><Icon.wa className="h-3 w-3" /> WhatsApp</Button>
                </a>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {safeItems.map((it) => (
          <Card key={it.id} className="animate-rise flex flex-col p-4 relative overflow-hidden group">
            {it.showInCatalog && (
              <div className="absolute top-2 right-2 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                No Catálogo
              </div>
            )}
            
            {it.photo ? (
              <div className="h-32 w-full rounded-xl bg-stone-100 mb-3 overflow-hidden">
                <img src={it.photo} alt={it.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="h-32 w-full rounded-xl bg-stone-100 mb-3 flex items-center justify-center text-stone-400">
                <Icon.ig className="h-8 w-8 opacity-20" />
              </div>
            )}

            <div className="flex-1">
              <p className="font-semibold text-stone-800 leading-tight">{it.name}</p>
              <p className="text-xs font-medium text-lilac-500 mt-1">{it.quantity} {it.quantity === 1 ? 'unidade' : 'unidades'}</p>
            </div>
            <button 
              onClick={() => { setItem(it); setOpenItem(true); }} 
              className="mt-3 w-full rounded-xl bg-white/70 py-2 text-xs font-medium text-stone-500 transition hover:bg-white hover:text-stone-800 flex items-center justify-center gap-2"
            >
              <Icon.edit className="h-3.5 w-3.5" /> Editar
            </button>
          </Card>
        ))}
        {safeItems.length === 0 && (
          <div className="col-span-full py-12 text-center text-stone-500">Nenhum item avulso cadastrado. (Ex: Cilindros, Arcos, etc)</div>
        )}
      </div>

      <Modal open={openItem} onClose={() => setOpenItem(false)} title="Peça do Estoque">
        <div className="space-y-4 mt-2">
          <Field label="Nome da peça (Ex: Arco romano, Cilindro P)">
            <Input value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} placeholder="Nome da peça" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantidade disponível">
              <Input type="number" min="1" value={item.quantity || ""} onChange={(e) => setItem({ ...item, quantity: +e.target.value })} />
            </Field>
          </div>
          <Field label="URL da Foto (Link da imagem)">
            <Input value={item.photo || ""} onChange={(e) => setItem({ ...item, photo: e.target.value })} placeholder="https://..." />
            <p className="text-[10px] text-stone-400 mt-1">Dica: Você pode copiar o link de imagens do Instagram, Google Fotos ou Pinterest.</p>
          </Field>
          
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-white/50 border border-white/70 hover:bg-white transition">
            <input type="checkbox" checked={!!item.showInCatalog} onChange={(e) => setItem({ ...item, showInCatalog: e.target.checked })} className="h-5 w-5 rounded border-stone-300 text-lilac-500 focus:ring-lilac-400" />
            <div className="flex-1">
              <span className="font-semibold text-stone-700 block">Mostrar no Catálogo</span>
              <span className="text-[11px] text-stone-500 leading-tight">Ative para que o cliente veja esta peça no seu link do catálogo público.</span>
            </div>
          </label>
        </div>
        <div className="mt-6 flex gap-3">
          {safeItems.some((x) => x.id === item.id) && (
            <Button variant="soft" className="!text-rose-500" onClick={() => { setInventoryItems(safeItems.filter((x) => x.id !== item.id)); setOpenItem(false); toast("Item removido"); }}>Excluir</Button>
          )}
          <Button variant="ghost" onClick={() => setOpenItem(false)} className="ml-auto">Cancelar</Button>
          <Button onClick={saveItem}>Salvar peça</Button>
        </div>
      </Modal>
    </div>
  );
}
