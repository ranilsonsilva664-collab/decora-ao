export const waLink = (phone: string, text?: string) => {
  const clean = phone.replace(/\D/g, "");
  const t = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${clean}${t}`;
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
