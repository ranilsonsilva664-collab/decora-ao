/**
 * Upload de imagem para o Cloudinary via Unsigned Upload Preset.
 * Não requer Firebase Storage nem backend.
 * Plano gratuito: 25GB armazenamento + 25GB banda/mês.
 *
 * Para configurar:
 * 1. Acesse https://cloudinary.com e faça login (cloud name: dmxeqe939)
 * 2. Vá em Settings → Upload → Upload presets → Add upload preset
 * 3. Marque "Unsigned" e salve com o nome: decora_upload
 * 4. Pronto! O upload funcionará automaticamente.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dmxeqe939";
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "decora_upload";

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
}

/**
 * Faz upload de um arquivo (File ou base64 data URL) para o Cloudinary.
 * Retorna a URL pública permanente da imagem.
 */
export async function uploadToCloudinary(
  fileOrBase64: File | string,
  folder = "decora"
): Promise<string> {
  const formData = new FormData();

  if (typeof fileOrBase64 === "string") {
    // base64 data URL → converte para Blob antes de enviar
    const response = await fetch(fileOrBase64);
    const blob = await response.blob();
    formData.append("file", blob, "photo.jpg");
  } else {
    formData.append("file", fileOrBase64);
  }

  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);
  // Qualidade e transformações automáticas pelo Cloudinary
  formData.append("quality", "auto");
  formData.append("fetch_format", "auto");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      `Cloudinary upload falhou: ${res.status} - ${
        (errorData as any)?.error?.message || res.statusText
      }`
    );
  }

  const data: CloudinaryUploadResult = await res.json();
  return data.secure_url;
}
