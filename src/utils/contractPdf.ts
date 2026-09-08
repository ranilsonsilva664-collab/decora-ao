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

export async function downloadContractPdf({
  contract,
  companySettings,
  contractRules = "",
  tenantId = "",
  onProgress,
}: GeneratePdfOptions): Promise<void> {
  if (onProgress) onProgress("Preparando documento do contrato...");

  const compName = companySettings.name || companySettings.tradeName || "RAYDECOR Pegue e Monte";
  const logo = companySettings.logo || "";
  const signUrl = `${window.location.origin}/assinar/${tenantId || "empresa"}/${contract.id}`;
  const cleanClientName = (contract.clientName || "Cliente").replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ]/g, "_");

  // Create temporary container
  const container = document.createElement("div");
  container.id = "temp-contract-pdf-render";
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px"; // A4 width at 96 DPI
  container.style.background = "#ffffff";
  container.style.color = "#1c1917";
  container.style.fontFamily = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  container.style.padding = "40px";
  container.style.boxSizing = "border-box";
  container.style.zIndex = "-9999";

  const terms = contract.customTerms || companySettings.terms || contractRules || "Conforme regras de conservação e devolução acordadas.";

  const itemsTableHtml =
    contract.items && contract.items.length > 0
      ? `
      <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px;">
        <thead>
          <tr style="background: #fdf2f8; color: #be185d;">
            <th style="text-align: left; padding: 8px 10px; border-radius: 6px 0 0 6px;">Item / Peça do Acervo</th>
            <th style="text-align: center; padding: 8px 10px;">Qtd</th>
            <th style="text-align: right; padding: 8px 10px; border-radius: 0 6px 6px 0;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${contract.items
            .map(
              (it) => `
            <tr style="border-bottom: 1px solid #f5f5f4;">
              <td style="padding: 8px 10px; font-weight: 500;">${it.name}</td>
              <td style="padding: 8px 10px; text-align: center; color: #78716c;">${it.quantity}x</td>
              <td style="padding: 8px 10px; text-align: right; font-weight: 600;">${brl(it.subtotal)}</td>
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
          contract.signatureImage
            ? `<div style="margin: 4px 0;"><img src="${contract.signatureImage}" style="height: 48px; max-width: 180px; object-fit: contain; margin: 0 auto; display: block;" alt="Assinatura" /></div>`
            : ""
        }
        <p style="font-size: 12px; font-weight: 700; color: #1c1917; margin: 0;">${contract.signature || contract.clientName}</p>
        <p style="font-size: 10px; color: #78716c; margin: 2px 0 0 0;">CPF: ${contract.cpf || "Registrado"}</p>
        <p style="font-size: 9px; color: #a8a29e; margin: 2px 0 0 0;">Data/Hora: ${contract.signedAt ? fmtDate(contract.signedAt) : "Confirmado"}</p>
      </div>
    `
    : `
      <div style="text-align: center; border-top: 1px solid #d6d3d1; padding-top: 12px;">
        <div style="margin-top: 25px; border-bottom: 1px dashed #a8a29e; width: 80%; margin-left: auto; margin-right: auto;"></div>
        <p style="font-size: 12px; font-weight: 700; color: #1c1917; margin: 6px 0 0 0;">${contract.clientName}</p>
        <p style="font-size: 10px; color: #78716c; margin: 2px 0 0 0;">Locatária (Aguardando Assinatura)</p>
        <p style="font-size: 9px; color: #ec4899; margin: 4px 0 0 0; word-break: break-all;">Link para assinar: ${signUrl}</p>
      </div>
    `;

  container.innerHTML = `
    <div style="border: 1px solid #fce7f3; border-radius: 16px; padding: 32px; background: #ffffff;">
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #fce7f3; padding-bottom: 18px; margin-bottom: 22px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          ${
            logo
              ? `<img src="${logo}" style="height: 60px; width: 60px; object-fit: cover; border-radius: 12px; border: 1px solid #fbcfe8;" crossorigin="anonymous" />`
              : ""
          }
          <div>
            <h1 style="font-size: 18px; color: #db2777; font-weight: 800; margin: 0; line-height: 1.2;">${compName}</h1>
            <p style="font-size: 11px; color: #78716c; margin: 3px 0 0 0;">Instrumento Particular de Locação de Bens Móveis — Pegue e Monte</p>
            ${companySettings.cnpjCpf ? `<p style="font-size: 10px; color: #a8a29e; margin: 2px 0 0 0;">CNPJ/CPF: ${companySettings.cnpjCpf}</p>` : ""}
          </div>
        </div>
        <div style="text-align: right;">
          <span style="background: #fdf2f8; color: #be185d; border: 1px solid #fbcfe8; padding: 5px 12px; border-radius: 999px; font-weight: 700; font-size: 10px; text-transform: uppercase;">
            Contrato #${contract.id.slice(0, 8).toUpperCase()}
          </span>
          <p style="font-size: 9px; color: #a8a29e; margin: 4px 2px 0 0;">Emissão: ${fmtDate(contract.createdAt || new Date().toISOString())}</p>
        </div>
      </div>

      <!-- Section 1: Partes -->
      <div style="margin-bottom: 18px;">
        <div style="font-size: 11px; font-weight: 700; color: #9333ea; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-left: 3px solid #ec4899; padding-left: 8px;">
          1. Partes Contratantes
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #fafaf9; border: 1px solid #f5f5f4; padding: 12px 14px; border-radius: 10px; font-size: 11px;">
          <div><b style="color: #44403c;">LOCADORA:</b> ${compName}</div>
          <div><b style="color: #44403c;">RESPONSÁVEL:</b> ${companySettings.ownerName || "A Gerência"}</div>
          <div><b style="color: #44403c;">LOCATÁRIA:</b> ${contract.clientName}</div>
          <div><b style="color: #44403c;">CPF DA CLIENTE:</b> ${contract.cpf || "Não informado"}</div>
        </div>
      </div>

      <!-- Section 2: Cronograma -->
      <div style="margin-bottom: 18px;">
        <div style="font-size: 11px; font-weight: 700; color: #9333ea; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-left: 3px solid #ec4899; padding-left: 8px;">
          2. Objeto e Cronograma da Locação
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #fafaf9; border: 1px solid #f5f5f4; padding: 12px 14px; border-radius: 10px; font-size: 11px;">
          <div><b style="color: #44403c;">Tema Contratado:</b> ${contract.theme}</div>
          <div><b style="color: #44403c;">Data do Evento:</b> ${fmtDate(contract.partyDate)}</div>
          <div><b style="color: #44403c;">Data da Retirada:</b> ${fmtDate(contract.pickupDate || contract.partyDate)} às ${contract.pickupTime || "09:00"}</div>
          <div><b style="color: #44403c;">Data da Devolução:</b> ${fmtDate(contract.returnDate || contract.partyDate)} às ${contract.returnTime || "12:00"}</div>
        </div>
        ${itemsTableHtml}
      </div>

      <!-- Section 3: Valores -->
      <div style="margin-bottom: 18px;">
        <div style="font-size: 11px; font-weight: 700; color: #9333ea; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-left: 3px solid #ec4899; padding-left: 8px;">
          3. Valores e Pagamento
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #fafaf9; border: 1px solid #f5f5f4; padding: 12px 14px; border-radius: 10px; font-size: 11px;">
          <div><b style="color: #44403c;">Valor Total da Locação:</b> <span style="font-weight: 700; color: #047857;">${brl(contract.value)}</span></div>
          <div><b style="color: #44403c;">Sinal Pago (Reserva):</b> <span style="font-weight: 700; color: #db2777;">${brl(contract.deposit)}</span></div>
          <div><b style="color: #44403c;">Saldo Restante na Retirada:</b> <span style="font-weight: 700; color: #b45309;">${brl(contract.value - contract.deposit)}</span></div>
          <div><b style="color: #44403c;">Formas Aceitas:</b> Pix / Dinheiro / Cartão</div>
        </div>
      </div>

      <!-- Section 4: Termos e Cláusulas -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 700; color: #9333ea; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-left: 3px solid #ec4899; padding-left: 8px;">
          4. Cláusulas e Termos de Uso e Conservação
        </div>
        <div style="background: #fafaf9; border: 1px solid #f5f5f4; padding: 12px 14px; border-radius: 10px; font-size: 10.5px; color: #44403c; white-space: pre-line; line-height: 1.55; max-height: none;">
          ${terms}
        </div>
      </div>

      <!-- Section 5: Assinaturas -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 30px;">
        <div style="text-align: center; border-top: 1px solid #d6d3d1; padding-top: 12px;">
          <p style="font-size: 12px; font-weight: 700; color: #1c1917; margin: 0;">${compName}</p>
          <p style="font-size: 10px; color: #78716c; margin: 2px 0 0 0;">Locadora</p>
          ${companySettings.ownerName ? `<p style="font-size: 9px; color: #a8a29e; margin: 2px 0 0 0;">Resp: ${companySettings.ownerName}</p>` : ""}
        </div>
        ${signatureBoxHtml}
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    if (onProgress) onProgress("Renderizando documento em alta resolução...");
    // Allow images to load if any
    await new Promise((resolve) => setTimeout(resolve, 350));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: "#ffffff",
      windowWidth: 794,
    });

    if (onProgress) onProgress("Gerando arquivo PDF...");
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const margin = 10;
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

    const fileName = `Contrato_${cleanClientName}.pdf`;

    // Try native file sharing on mobile if available
    let shared = false;
    if (navigator.canShare) {
      try {
        const blob = pdf.output("blob");
        const file = new File([blob], fileName, { type: "application/pdf" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Contrato — ${contract.clientName}`,
            text: `Contrato de Locação de ${contract.clientName} (${contract.theme})`,
            files: [file],
          });
          shared = true;
        }
      } catch (err) {
        console.warn("Native share skipped or cancelled, downloading directly", err);
      }
    }

    if (!shared) {
      pdf.save(fileName);
    }

    if (onProgress) onProgress("PDF gerado e baixado com sucesso!");
  } finally {
    document.body.removeChild(container);
  }
}
