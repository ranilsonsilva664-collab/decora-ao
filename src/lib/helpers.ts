export const normalizeWaPhone = (phone: string): string => {
  if (!phone) return "";
  let clean = phone.replace(/\D/g, "");
  if (!clean) return "";

  // Remove prefixo internacional 00 se houver
  if (clean.startsWith("00")) {
    clean = clean.slice(2);
  }

  // Se começar com 0 e tiver mais de 10 dígitos (ex: 011999999999 -> 11999999999), remove o 0 inicial
  while (clean.startsWith("0") && clean.length > 10) {
    clean = clean.slice(1);
  }

  // No Brasil, telefones têm 10 dígitos (DDD + 8 dígitos) ou 11 dígitos (DDD + 9 dígitos).
  // Sem o DDI 55, o WhatsApp abre e exibe mensagem de que o cliente não tem WhatsApp / número inválido.
  // Se tiver 10 ou 11 dígitos, adiciona o DDI 55 automaticamente.
  if (clean.length === 10 || clean.length === 11) {
    clean = `55${clean}`;
  }

  return clean;
};

export const waLink = (phone: string, text?: string) => {
  const clean = normalizeWaPhone(phone);
  if (!clean) return "#";
  const t = text ? `&text=${encodeURIComponent(text)}` : "";
  return `https://api.whatsapp.com/send?phone=${clean}${t}`;
};

export const igLink = (handle: string) =>
  `https://instagram.com/${handle.replace(/^@/, "").trim()}`;

export const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
