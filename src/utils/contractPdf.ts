import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { Contract, CompanySettings } from "../lib/types";
import { brl, fmtDate } from "../lib/format";

export interface GeneratePdfOptions {
  contract: Contract;
  companySettings: Partial<CompanySettings>;
  contractRules?: string;
  tenantId?: string;
  onProgress?: (status: string) => void;
}

// Helper to safely convert image URL to local base64 to prevent canvas tainting
async function getSafeBase64Image(src: string): Promise<string> {
  if (!src) return "";
  if (src.startsWith("data:image")) return src;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(""), 2000);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || 120;
        c.height = img.naturalHeight || 120;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL("image/jpeg", 0.85));
          return;
        }
      } catch (e) {
        console.warn("Could not export image to dataURL due to CORS", e);
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

// Fallback generator using native jsPDF vector text when HTML rendering is blocked
function generateNativeJsPdf(
  contract: Contract,
  companySettings: Partial<CompanySettings>,
  contractRules: string,
  fileName: string
) {
  const doc = new jsPDF("p", "mm", "a4");
  const compName = companySettings.tradeName || companySettings.name || "RAYDECOR Pegue e Monte";
  let y = 20;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(219, 39, 119); // Pink
  doc.text(compName, 14, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Instrumento Particular de Locação de Bens Móveis — Pegue e Monte", 14, y);

  if (companySettings.cnpjCpf) {
    y += 5;
    doc.text(`CNPJ/CPF: ${companySettings.cnpjCpf}`, 14, y);
  }

  y += 8;
  doc.setDrawColor(244, 114, 182);
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(147, 51, 234);
  doc.text(`CONTRATO #${contract.id.slice(0, 8).toUpperCase()} — Emissão: ${fmtDate(contract.createdAt || new Date().toISOString())}`, 14, y);

  // 1. Partes
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text("1. PARTES CONTRATANTES", 14, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Locadora: ${compName} | Resp: ${companySettings.ownerName || "A Gerência"}`, 14, y);
  y += 5;
  doc.text(
    `Locatária: ${contract.clientName} | CPF: ${contract.cpf || "Não informado"} | WhatsApp: ${contract.whatsapp || contract.clientPhone || "Não informado"}`,
    14,
    y
  );

  // 2. Cronograma
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text("2. CRONOGRAMA E TEMA DA LOCAÇÃO", 14, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Tema Contratado: ${contract.theme} | Data da Festa: ${fmtDate(contract.partyDate)}`, 14, y);
  y += 5;
  doc.text(
    `Retirada: ${fmtDate(contract.pickupDate || contract.partyDate)} às ${contract.pickupTime || "09:00"} | Devolução: ${fmtDate(contract.returnDate || contract.partyDate)} às ${contract.returnTime || "12:00"}`,
    14,
    y
  );

  // 3. Valores
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text("3. VALORES E PAGAMENTO", 14, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(
    `Valor Total: ${brl(contract.value)} | Sinal Pago: ${brl(contract.deposit)} | Saldo Restante: ${brl(contract.value - contract.deposit)}`,
    14,
    y
  );

  // 4. Cláusulas
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text("4. TERMOS E CLÁUSULAS", 14, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const termsText = contract.customTerms || companySettings.terms || contractRules || "Conforme termos combinados.";
  const splitTerms = doc.splitTextToSize(termsText, 182);
  doc.text(splitTerms, 14, y);
  y += splitTerms.length * 3.8 + 8;

  // 5. Assinaturas
  if (y > 250) {
    doc.addPage();
    y = 25;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(`Locadora: ${compName}`, 20, y);
  doc.text(`Locatária: ${contract.clientName}`, 120, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (contract.signed) {
    doc.setTextColor(4, 120, 87); // Green
    doc.text(`[ASSINADO DIGITALMENTE]`, 120, y);
    y += 4;
    doc.text(`Signatária: ${contract.signature} (${contract.signedAt ? fmtDate(contract.signedAt) : "Confirmado"})`, 120, y);
  } else {
    doc.text(`Aguardando assinatura digital`, 120, y);
  }

  // Trigger download
  doc.save(fileName);
}

export async function downloadContractPdf({
  contract,
  companySettings,
  contractRules = "",
  tenantId = "",
  onProgress,
}: GeneratePdfOptions): Promise<void> {
  if (onProgress) onProgress("Preparando documento do contrato...");

  const compName = companySettings.tradeName || companySettings.name || "RAYDECOR Pegue e Monte";
  const cleanClientName = (contract.clientName || "Cliente").replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ]/g, "_");
  const fileName = `Contrato_${cleanClientName}.pdf`;

  // Safely prepare base64 logo
  let safeLogo = "";
  if (companySettings.logo) {
    if (companySettings.logo.startsWith("data:image")) {
      safeLogo = companySettings.logo;
    } else {
      safeLogo = await getSafeBase64Image(companySettings.logo);
    }
  }

  // Safely prepare signature image
  const safeSignatureImg = contract.signatureImage && contract.signatureImage.startsWith("data:image")
    ? contract.signatureImage
    : "";

  const signUrl = `${window.location.origin}/assinar/${tenantId || "empresa"}/${contract.id}`;
  const terms = contract.customTerms || companySettings.terms || contractRules || "Conforme regras de conservação e devolução acordadas.";

  // Create temporary off-screen container for HTML rendering
  const container = document.createElement("div");
  container.id = "temp-contract-pdf-render";
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px"; // Standard A4 width at 96 DPI
  container.style.background = "#ffffff";
  container.style.color = "#1c1917";
  container.style.fontFamily = "'Poppins', Arial, sans-serif";
  container.style.padding = "36px";
  container.style.boxSizing = "border-box";
  container.style.zIndex = "-9999";

  const itemsTableHtml =
    contract.items && contract.items.length > 0
      ? `
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px;">
        <thead>
          <tr style="background: #fdf2f8; color: #be185d;">
            <th style="text-align: left; padding: 7px 10px; border-radius: 6px 0 0 6px;">Item / Peça do Acervo</th>
            <th style="text-align: center; padding: 7px 10px;">Qtd</th>
            <th style="text-align: right; padding: 7px 10px; border-radius: 0 6px 6px 0;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${contract.items
            .map(
              (it) => `
            <tr style="border-bottom: 1px solid #f5f5f4;">
              <td style="padding: 7px 10px; font-weight: 500;">${it.name}</td>
              <td style="padding: 7px 10px; text-align: center; color: #78716c;">${it.quantity}x</td>
              <td style="padding: 7px 10px; text-align: right; font-weight: 600;">${brl(it.subtotal)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `
      : "";

  const signatureBoxHtml = contract.signed
    ? `
      <div style="text-align: center; border-top: 1px solid #d6d3d1; padding-top: 12px;">
        <div style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; padding: 4px 12px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">
          ✓ Assinado Digitalmente
        </div>
        ${
          safeSignatureImg
            ? `<div style="margin: 4px 0;"><img src="${safeSignatureImg}" style="height: 48px; max-width: 180px; object-fit: contain; margin: 0 auto; display: block;" alt="Assinatura" /></div>`
            : ""
        }
        <p style="font-size: 12px; font-weight: 700; color: #1c1917; margin: 0;">${contract.signature || contract.clientName}</p>
        <p style="font-size: 10px; color: #78716c; margin: 2px 0 0 0;">CPF: ${contract.cpf || "Registrado"}</p>
        <p style="font-size: 9px; color: #a8a29e; margin: 2px 0 0 0;">Data: ${contract.signedAt ? fmtDate(contract.signedAt) : "Confirmado"}</p>
      </div>
    `
    : `
      <div style="text-align: center; border-top: 1px solid #d6d3d1; padding-top: 12px;">
        <div style="margin-top: 25px; border-bottom: 1px dashed #a8a29e; width: 80%; margin-left: auto; margin-right: auto;"></div>
        <p style="font-size: 12px; font-weight: 700; color: #1c1917; margin: 6px 0 0 0;">${contract.clientName}</p>
        <p style="font-size: 10px; color: #78716c; margin: 2px 0 0 0;">Locatária (Aguardando Assinatura)</p>
        <p style="font-size: 9px; color: #ec4899; margin: 4px 0 0 0; word-break: break-all;">Link: ${signUrl}</p>
      </div>
    `;

  container.innerHTML = `
    <div style="border: 1px solid #fce7f3; border-radius: 16px; padding: 28px; background: #ffffff;">
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #fce7f3; padding-bottom: 16px; margin-bottom: 18px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          ${
            safeLogo
              ? `<img src="${safeLogo}" style="height: 56px; width: 56px; object-fit: cover; border-radius: 12px; border: 1px solid #fbcfe8;" />`
              : `<div style="height: 52px; width: 52px; border-radius: 12px; background: #fdf2f8; border: 1px solid #fbcfe8; display: flex; align-items: center; justify-content: center; font-size: 24px;">🎀</div>`
          }
          <div>
            <h1 style="font-size: 17px; color: #db2777; font-weight: 800; margin: 0; line-height: 1.2;">${compName}</h1>
            <p style="font-size: 10.5px; color: #78716c; margin: 2px 0 0 0;">Instrumento Particular de Locação de Bens Móveis — Pegue e Monte</p>
            ${companySettings.cnpjCpf ? `<p style="font-size: 9.5px; color: #a8a29e; margin: 2px 0 0 0;">CNPJ/CPF: ${companySettings.cnpjCpf}</p>` : ""}
          </div>
        </div>
        <div style="text-align: right;">
          <span style="background: #fdf2f8; color: #be185d; border: 1px solid #fbcfe8; padding: 4px 10px; border-radius: 999px; font-weight: 700; font-size: 10px; text-transform: uppercase;">
            Contrato #${contract.id.slice(0, 8).toUpperCase()}
          </span>
          <p style="font-size: 9px; color: #a8a29e; margin: 4px 2px 0 0;">Emissão: ${fmtDate(contract.createdAt || new Date().toISOString())}</p>
        </div>
      </div>

      <!-- Section 1: Partes -->
      <div style="margin-bottom: 16px;">
        <div style="font-size: 10.5px; font-weight: 700; color: #9333ea; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; border-left: 3px solid #ec4899; padding-left: 8px;">
          1. Partes Contratantes
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #fafaf9; border: 1px solid #f5f5f4; padding: 10px 12px; border-radius: 10px; font-size: 10.5px;">
          <div><b style="color: #44403c;">LOCADORA:</b> ${compName}</div>
          <div><b style="color: #44403c;">RESPONSÁVEL:</b> ${companySettings.ownerName || "A Gerência"}</div>
          <div><b style="color: #44403c;">LOCATÁRIA:</b> ${contract.clientName}</div>
          <div><b style="color: #44403c;">CPF DA CLIENTE:</b> ${contract.cpf || "Não informado"}</div>
          <div style="grid-column: span 2;"><b style="color: #44403c;">WHATSAPP DA CLIENTE:</b> ${contract.whatsapp || contract.clientPhone || "Não informado"}</div>
        </div>
      </div>

      <!-- Section 2: Cronograma -->
      <div style="margin-bottom: 16px;">
        <div style="font-size: 10.5px; font-weight: 700; color: #9333ea; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; border-left: 3px solid #ec4899; padding-left: 8px;">
          2. Objeto e Cronograma da Locação
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #fafaf9; border: 1px solid #f5f5f4; padding: 10px 12px; border-radius: 10px; font-size: 10.5px;">
          <div><b style="color: #44403c;">Tema Contratado:</b> ${contract.theme}</div>
          <div><b style="color: #44403c;">Data do Evento:</b> ${fmtDate(contract.partyDate)}</div>
          <div><b style="color: #44403c;">Data da Retirada:</b> ${fmtDate(contract.pickupDate || contract.partyDate)} às ${contract.pickupTime || "09:00"}</div>
          <div><b style="color: #44403c;">Data da Devolução:</b> ${fmtDate(contract.returnDate || contract.partyDate)} às ${contract.returnTime || "12:00"}</div>
        </div>
        ${itemsTableHtml}
      </div>

      <!-- Section 3: Valores -->
      <div style="margin-bottom: 16px;">
        <div style="font-size: 10.5px; font-weight: 700; color: #9333ea; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; border-left: 3px solid #ec4899; padding-left: 8px;">
          3. Valores e Pagamento
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #fafaf9; border: 1px solid #f5f5f4; padding: 10px 12px; border-radius: 10px; font-size: 10.5px;">
          <div><b style="color: #44403c;">Valor Total:</b> <span style="font-weight: 700; color: #047857;">${brl(contract.value)}</span></div>
          <div><b style="color: #44403c;">Sinal Pago:</b> <span style="font-weight: 700; color: #db2777;">${brl(contract.deposit)}</span></div>
          <div><b style="color: #44403c;">Saldo Restante:</b> <span style="font-weight: 700; color: #b45309;">${brl(contract.value - contract.deposit)}</span></div>
          <div><b style="color: #44403c;">Formas Aceitas:</b> Pix / Dinheiro / Cartão</div>
        </div>
      </div>

      <!-- Section 4: Termos e Cláusulas -->
      <div style="margin-bottom: 20px;">
        <div style="font-size: 10.5px; font-weight: 700; color: #9333ea; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; border-left: 3px solid #ec4899; padding-left: 8px;">
          4. Cláusulas e Termos de Uso e Conservação
        </div>
        <div style="background: #fafaf9; border: 1px solid #f5f5f4; padding: 10px 12px; border-radius: 10px; font-size: 10px; color: #44403c; white-space: pre-line; line-height: 1.5;">
          ${terms}
        </div>
      </div>

      <!-- Section 5: Assinaturas -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px;">
        <div style="text-align: center; border-top: 1px solid #d6d3d1; padding-top: 12px;">
          <p style="font-size: 11.5px; font-weight: 700; color: #1c1917; margin: 0;">${compName}</p>
          <p style="font-size: 9.5px; color: #78716c; margin: 2px 0 0 0;">Locadora</p>
          ${companySettings.ownerName ? `<p style="font-size: 8.5px; color: #a8a29e; margin: 2px 0 0 0;">Resp: ${companySettings.ownerName}</p>` : ""}
        </div>
        ${signatureBoxHtml}
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    if (onProgress) onProgress("Renderizando documento...");
    await new Promise((resolve) => setTimeout(resolve, 200));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: false, // Prevents tainted canvas exception
      backgroundColor: "#ffffff",
      windowWidth: 794,
    });

    if (onProgress) onProgress("Gerando arquivo PDF...");
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const margin = 8;
    const imgWidth = pdfWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - margin * 2);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - margin * 2);
    }

    // Direct and reliable browser download via Blob URL
    const blob = pdf.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1200);

    if (onProgress) onProgress("PDF baixado com sucesso!");
  } catch (err) {
    console.warn("html2canvas falhou, utilizando fallback nativo do jsPDF:", err);
    // Bulletproof fallback: native vector jsPDF
    generateNativeJsPdf(contract, companySettings, contractRules, fileName);
    if (onProgress) onProgress("PDF gerado e baixado com sucesso!");
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
