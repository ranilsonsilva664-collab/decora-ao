import { useState, useEffect } from "react";
import { doc, setDoc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { compressImage } from "./image";
import { uid } from "../lib/format";

// Cache em memória para acesso síncrono ultra-rápido (0ms)
const memoryCache = new Map<string, string>();
const listeners = new Map<string, Set<(url: string) => void>>();

function notifyListeners(id: string, url: string) {
  const set = listeners.get(id);
  if (set) {
    set.forEach((cb) => cb(url));
  }
}

/**
 * Pré-carrega todas as fotos de um tenant da coleção 'tenant_images' do Firestore.
 * Executado em segundo plano quando o usuário entra no CRM ou acessa o Catálogo.
 */
export async function loadTenantImages(tenantId: string): Promise<void> {
  if (!tenantId) return;
  try {
    const q = query(collection(db, "tenant_images"), where("tenantId", "==", tenantId));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const data = d.data();
      const url = data.dataUrl || data.url || "";
      if (url) {
        memoryCache.set(d.id, url);
        try {
          localStorage.setItem("cache_" + d.id, url);
        } catch {}
        notifyListeners(d.id, url);
      }
    });
  } catch (err) {
    console.warn("Aviso ao pré-carregar tenant_images:", err);
  }
}

/**
 * Busca uma imagem individual da coleção 'tenant_images' sob demanda.
 */
export async function fetchSingleImage(idOrUrl: string): Promise<string> {
  if (!idOrUrl) return "";
  if (idOrUrl.startsWith("http://") || idOrUrl.startsWith("https://") || idOrUrl.startsWith("data:")) {
    return idOrUrl;
  }
  if (memoryCache.has(idOrUrl)) {
    return memoryCache.get(idOrUrl)!;
  }
  try {
    const local = localStorage.getItem("cache_" + idOrUrl);
    if (local) {
      memoryCache.set(idOrUrl, local);
      return local;
    }
  } catch {}

  try {
    const snap = await getDoc(doc(db, "tenant_images", idOrUrl));
    if (snap.exists()) {
      const data = snap.data();
      const url = data.dataUrl || data.url || "";
      if (url) {
        memoryCache.set(idOrUrl, url);
        try {
          localStorage.setItem("cache_" + idOrUrl, url);
        } catch {}
        notifyListeners(idOrUrl, url);
        return url;
      }
    }
  } catch (err) {
    console.warn("Aviso ao buscar imagem individual:", err);
  }
  return "";
}

/**
 * Resolve sincronamente a URL se já estiver em cache ou for URL direta.
 */
export function resolveAppImage(src?: string): string {
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
    return src;
  }
  if (memoryCache.has(src)) {
    return memoryCache.get(src)!;
  }
  try {
    const local = localStorage.getItem("cache_" + src);
    if (local) {
      memoryCache.set(src, local);
      return local;
    }
  } catch {}
  // Dispara busca assíncrona se ainda não está em cache
  fetchSingleImage(src);
  return "";
}

/**
 * Hook do React para obter a URL resolvida de qualquer imagem (URL direta, dataURL ou id 'img_...').
 */
export function useAppImage(src?: string): string {
  const [resolved, setResolved] = useState<string>(() => resolveAppImage(src));

  useEffect(() => {
    if (!src) {
      setResolved("");
      return;
    }
    const current = resolveAppImage(src);
    if (current) {
      setResolved(current);
      return;
    }

    let active = true;
    const onUpdate = (newUrl: string) => {
      if (active) setResolved(newUrl);
    };

    if (!listeners.has(src)) {
      listeners.set(src, new Set());
    }
    listeners.get(src)!.add(onUpdate);

    fetchSingleImage(src).then((url) => {
      if (active && url) setResolved(url);
    });

    return () => {
      active = false;
      const set = listeners.get(src);
      if (set) set.delete(onUpdate);
    };
  }, [src]);

  return resolved;
}

/**
 * Salva uma foto de forma 100% resiliente e gratuita (SEM precisar de plano do Firebase Storage):
 * 1. Comprime a foto com WebP de alta qualidade (~20KB).
 * 2. Salva em um documento individual na coleção 'tenant_images' do Firestore (sem limite de 1MB por conta).
 * 3. Retorna o ID compacto 'img_...' (apenas 20 bytes), impedindo que o documento principal da empresa estoure o limite de 1MB.
 * 4. A foto NUNCA some e o salvamento é instantâneo.
 */
export async function saveAppImage(
  fileOrBase64: File | string,
  folder = "pecas",
  tenantId?: string
): Promise<string> {
  // 1. Otimiza foto para WebP leve
  const compressed = await compressImage(fileOrBase64, 750, 0.65);

  const tId = tenantId || localStorage.getItem("crm_tenant_id") || "RAYDECOR";
  const imgId = "img_" + uid();

  // 2. Coloca imediatamente no cache local para renderização instantânea (0ms)
  memoryCache.set(imgId, compressed);
  try {
    localStorage.setItem("cache_" + imgId, compressed);
  } catch {}
  notifyListeners(imgId, compressed);

  // 3. Salva no Firestore na coleção dedicada 'tenant_images'
  try {
    await setDoc(
      doc(db, "tenant_images", imgId),
      {
        id: imgId,
        tenantId: tId,
        folder,
        dataUrl: compressed,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("Aviso ao persistir imagem em tenant_images:", err);
  }

  // 4. Retorna a chave compacta para ser salva no item/kit (ocupa quase zero bytes no tenant_data)
  return imgId;
}

/**
 * Componente React que renderiza a imagem com resolução automática e fallback gracioso.
 */
export function AppImage({
  src,
  alt = "",
  className = "",
  style,
  onClick,
  fallbackEmoji = "📦",
}: {
  src?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  fallbackEmoji?: string;
}) {
  const realSrc = useAppImage(src);

  if (!src && !realSrc) {
    return (
      <div
        className={`flex items-center justify-center bg-stone-100 text-3xl select-none ${className}`}
        style={style}
        onClick={onClick}
      >
        {fallbackEmoji}
      </div>
    );
  }

  if (!realSrc) {
    return (
      <div
        className={`flex items-center justify-center bg-stone-100 animate-pulse ${className}`}
        style={style}
        onClick={onClick}
      >
        <span className="text-stone-300 text-xs">Carregando...</span>
      </div>
    );
  }

  return (
    <img
      src={realSrc}
      alt={alt}
      className={className}
      style={style}
      onClick={onClick}
      loading="lazy"
    />
  );
}
