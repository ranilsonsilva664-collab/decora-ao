import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { Kit, CompanySettings } from "../lib/types";
import { brl, fmtDate } from "../lib/format";
import type { KitDateAvailability } from "../lib/availability";

export interface GenerateCatalogPdfOptions {
  kits: Kit[];
  companySettings: Partial<CompanySettings>;
  selectedDate?: string;
  availabilityMap?: Record<string, KitDateAvailability>;
  onProgress?: (status: string) => void;
}

// Convert image URL to local base64 safely to prevent canvas taint issues
async function getSafeBase64(src: string): Promise<string> {
  if (!src) return "";
  if (src.startsWith("data:image")) return src;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(""), 2500);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || 200;
        c.height = img.naturalHeight || 200;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL("image/jpeg", 0.85));
          return;
        }
      } catch (e) {
        console.warn("Could not export image to dataURL", e);
      }
      resolve("");
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve("");
    };

    img.src = src;
  });
}

// Native jsPDF fallback in case HTML canvas rendering fails
function generateNativeCatalogPdf(
  kits: Kit[],
  companySettings: Partial<CompanySettings>,
  selectedDate: string | undefined,
  availabilityMap: Record<string, KitDateAvailability> | undefined,
  fileName: string
) {
  const doc = new jsPDF("p", "mm", "a4");
  const compName = companySettings.tradeName || companySettings.name || "EventFlow Pegue e Monte";
  let y = 20;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(219, 39, 119); // Pink
  doc.text(compName, 14, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text("Catálogo Oficial de Kits & Decoração Completa — Pegue e Monte", 14, y);

  if (companySettings.phone || companySettings.whatsapp) {
    y += 5;
    doc.setFontSize(9);
    doc.text(`Contato / WhatsApp: ${companySettings.whatsapp || companySettings.phone}`, 14, y);
  }

  if (selectedDate) {
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(190, 24, 93);
    doc.text(`Disponibilidade consultada para: ${fmtDate(selectedDate)}`, 14, y);
    doc.setFont("helvetica", "normal");
  }

  y += 6;
  doc.setDrawColor(240, 240, 240);
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);
  y += 8;

  // Kits listing
  kits.forEach((k, index) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    const avail = availabilityMap ? availabilityMap[k.id] : undefined;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text(`${index + 1}. ${k.name}`, 14, y);

    doc.setFontSize(12);
    doc.setTextColor(190, 24, 93);
    doc.text(brl(k.rentalPrice || 0), 196, y, { align: "right" });

    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);

    let statusLine = `Categoria: ${k.category || "Geral"}`;
    if (avail) {
      statusLine += ` | Status: ${avail.label}`;
    }
    doc.text(statusLine, 14, y);

    if (k.description) {
      y += 5;
      doc.setTextColor(80, 80, 80);
      const descLines = doc.splitTextToSize(k.description, 180);
      doc.text(descLines, 14, y);
      y += descLines.length * 4;
    }

    if (k.items && k.items.length > 0) {
      y += 4;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      const piecesStr = "Peças inclusas: " + k.items.map((it) => `${it.itemName} (${it.quantity}x)`).join(", ");
      const piecesLines = doc.splitTextToSize(piecesStr, 180);
      doc.text(piecesLines, 14, y);
      y += piecesLines.length * 3.5;
    }

    y += 5;
    doc.setDrawColor(245, 245, 245);
    doc.line(14, y, 196, y);
    y += 6;
  });

  doc.save(fileName);
}

/**
 * Gera um PDF completo e visualmente impecável do Catálogo de Kits de Decoração Completa,
 * com fotos de alta qualidade, valores, peças inclusas e verificação de disponibilidade para data.
 */
export async function generateCatalogPdf({
  kits,
  companySettings,
  selectedDate,
  availabilityMap,
  onProgress,
}: GenerateCatalogPdfOptions): Promise<void> {
  const compName = companySettings.tradeName || companySettings.name || "EventFlow";
  const cleanCompName = compName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ]/g, "_");
  const fileName = `Catalogo_Kits_Decoracao_${cleanCompName}.pdf`;

  if (onProgress) onProgress("Carregando imagens do catálogo...");

  // 1. Prepare base64 images for logo and kits
  let safeLogo = "";
  if (companySettings.logo) {
    safeLogo = await getSafeBase64(companySettings.logo);
  }

  const safeKitsWithImages: Array<{ kit: Kit; photoBase64: string }> = [];
  for (const k of kits) {
    const mainPhoto = (k.photos && k.photos.length > 0) ? k.photos[0] : (k.photo || "");
    let photoBase64 = "";
    if (mainPhoto) {
      photoBase64 = await getSafeBase64(mainPhoto);
    }
    safeKitsWithImages.push({ kit: k, photoBase64 });
  }

  if (onProgress) onProgress("Montando layout do catálogo...");

  // 2. Build temporary HTML container off-screen
  const container = document.createElement("div");
  container.id = "temp-catalog-pdf-render";
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px"; // Standard A4 at 96 DPI
  container.style.background = "#ffffff";
  container.style.color = "#1c1917";
  container.style.fontFamily = "'Poppins', Arial, sans-serif";
  container.style.padding = "32px";
  container.style.boxSizing = "border-box";
  container.style.zIndex = "-9999";

  const dateBadgeHtml = selectedDate
    ? `
    <div style="margin-top: 10px; display: inline-flex; align-items: center; gap: 6px; background: #fdf2f8; border: 1px solid #fbcfe8; padding: 6px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; color: #be185d;">
      <span>🗓️</span> Disponibilidade consultada para: <b>${fmtDate(selectedDate)}</b>
    </div>
  `
    : "";

  const kitsHtml = safeKitsWithImages
    .map(({ kit: k, photoBase64 }) => {
      const avail = availabilityMap ? availabilityMap[k.id] : undefined;
      const isUnavailable = avail && !avail.isAvailable;
      const badgeBg = isUnavailable ? "#fee2e2" : avail && avail.statusColor === "amber" ? "#fef3c7" : "#dcfce7";
      const badgeColor = isUnavailable ? "#b91c1c" : avail && avail.statusColor === "amber" ? "#b45309" : "#15803d";
      const badgeText = avail ? avail.label : "Pronto para locação";

      const photoHtml = photoBase64
        ? `<img src="${photoBase64}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 12px; display: block;" />`
        : `<div style="width: 100%; height: 160px; background: #f5f5f4; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 38px;">🎁</div>`;

      const piecesHtml =
        k.items && k.items.length > 0
          ? `
          <div style="margin-top: 8px; background: #f8fafc; padding: 8px 10px; border-radius: 8px; border: 1px solid #f1f5f9;">
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Peças inclusas neste Kit:</div>
            <div style="font-size: 10px; color: #334155; line-height: 1.4;">
              ${k.items.map((it) => `• <b>${it.itemName}</b> (${it.quantity}x)`).join("  |  ")}
            </div>
          </div>
        `
          : "";

      return `
        <div style="page-break-inside: avoid; background: #ffffff; border: 1.5px solid #f1f5f9; border-radius: 16px; padding: 14px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
          <div style="display: flex; gap: 14px;">
            <div style="width: 180px; shrink: 0; flex-shrink: 0;">
              ${photoHtml}
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                  <div>
                    <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #1e293b;">${k.name}</h3>
                    <div style="margin-top: 4px; display: flex; align-items: center; gap: 6px;">
                      <span style="background: #fdf2f8; color: #be185d; font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 6px;">
                        ${k.category || "Decoração Completa"}
                      </span>
                      <span style="background: ${badgeBg}; color: ${badgeColor}; font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 6px;">
                        ${badgeText}
                      </span>
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 9px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Valor Locação</div>
                    <div style="font-size: 16px; font-weight: 900; color: #be185d;">${brl(k.rentalPrice || 0)}</div>
                  </div>
                </div>

                ${
                  k.description
                    ? `<p style="margin: 6px 0 0 0; font-size: 10.5px; color: #64748b; line-height: 1.4;">${k.description}</p>`
                    : ""
                }
              </div>

              ${piecesHtml}
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div>
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #fce7f3; padding-bottom: 18px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          ${
            safeLogo
              ? `<img src="${safeLogo}" style="height: 52px; max-width: 110px; object-fit: contain; border-radius: 10px;" />`
              : `<div style="height: 48px; width: 48px; border-radius: 12px; background: #be185d; color: white; display: flex; align-items: center; justify-content: center; font-size: 24px;">✨</div>`
          }
          <div>
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px;">${compName}</h1>
            <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 600; color: #be185d;">Catálogo Oficial de Kits & Decoração Completa</p>
          </div>
        </div>

        <div style="text-align: right; font-size: 10px; color: #64748b; line-height: 1.5;">
          ${companySettings.whatsapp || companySettings.phone ? `<div>📱 <b>WhatsApp:</b> ${companySettings.whatsapp || companySettings.phone}</div>` : ""}
          ${companySettings.email ? `<div>✉️ ${companySettings.email}</div>` : ""}
          ${companySettings.city ? `<div>📍 ${companySettings.city}${companySettings.state ? " - " + companySettings.state : ""}</div>` : ""}
        </div>
      </div>

      <!-- Date banner if queried -->
      ${dateBadgeHtml ? `<div style="margin-bottom: 18px; text-align: center;">${dateBadgeHtml}</div>` : ""}

      <!-- Kits Listing -->
      <div>
        ${kitsHtml}
      </div>

      <!-- Footer -->
      <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9.5px; color: #94a3b8;">
        <p style="margin: 0;"><b>${compName}</b> • Locações Pegue e Monte e Decorações de Festa</p>
        <p style="margin: 3px 0 0 0;">Para verificar disponibilidade de outras datas ou reservar, entre em contato direto pelo WhatsApp.</p>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    if (onProgress) onProgress("Renderizando documento em alta resolução...");

    const canvas = await html2canvas(container, {
      scale: 2, // High resolution (300 DPI approx)
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF("p", "mm", "a4");

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const imgHeight = (canvasHeight * pdfWidth) / canvasWidth;
    let heightLeft = imgHeight;
    let position = 0;

    // First page
    pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;

    // Remaining pages if long catalog
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    if (onProgress) onProgress("Finalizando download...");
    pdf.save(fileName);
  } catch (err) {
    console.warn("html2canvas catalog failed, switching to native jsPDF fallback", err);
    generateNativeCatalogPdf(kits, companySettings, selectedDate, availabilityMap, fileName);
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}
