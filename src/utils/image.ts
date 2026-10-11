/**
 * Utilitário de compressão ultra-eficiente de imagem para WebP/JPEG.
 * Reduz fotos pesadas de celular (3MB a 10MB) para tamanhos leves (15KB a 35KB)
 * sem perda perceptível de qualidade visual em telas e catálogos.
 */
export async function compressImage(
  fileOrDataUrl: File | string,
  maxDim = 700,
  quality = 0.65
): Promise<string> {
  return new Promise((resolve, reject) => {
    const processImageSource = (src: string) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas context not available"));

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        try {
          // Tenta WebP primeiro (30-50% menor que JPEG)
          let dataUrl = canvas.toDataURL("image/webp", quality);
          if (!dataUrl || !dataUrl.startsWith("data:image/webp")) {
            // Fallback para JPEG se o navegador não suportar WebP no canvas
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }
          resolve(dataUrl);
        } catch {
          try {
            resolve(canvas.toDataURL("image/jpeg", quality));
          } catch (err) {
            reject(err);
          }
        }
      };
      img.onerror = (e) => reject(e);
      img.src = src;
    };

    if (typeof fileOrDataUrl === "string") {
      processImageSource(fileOrDataUrl);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => processImageSource(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}
