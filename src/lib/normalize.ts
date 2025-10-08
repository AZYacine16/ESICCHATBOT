// src/lib/normalize.ts
export function normalize(text: string): string {
  if (!text) return "";
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // supprime les accents
    .replace(/<[^>]*>/g, " ") // supprime balises HTML
    .replace(/[^a-z0-9\s]/g, " ") // conserve seulement lettres/chiffres/espaces
    .replace(/\s+/g, " ")
    .trim();
}
