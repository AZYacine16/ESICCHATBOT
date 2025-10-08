import { normalize } from "./db";
import { parseDateExpression } from "./date_utils"; // ✅ à placer en haut

export interface Entities {
  formation?: string;
  date?: string;
  service?: string;
  personne?: string;
  lieu?: string;
}

/**
 * Analyse une phrase et en extrait les entités importantes.
 * Types d'entités : formation, service, date, personne, lieu
 */
export function extractEntities(input: string): Entities {
  const text = normalize(input);
  const entities: Entities = {};

  // ---------- FORMATION ----------
  const formations = [
    "data science",
    "cybersecurite",
    "cybersécurité",
    "developpement web",
    "informatique",
    "bts",
    "master",
    "licence",
    "design",
    "gestion",
  ];
  for (const f of formations) {
    if (text.includes(normalize(f))) {
      entities.formation = f;
      break;
    }
  }

  // ---------- SERVICE ----------
  const services = [
    "scolarite",
    "bibliotheque",
    "bibliothèque",
    "resto",
    "resto u",
    "restaurant",
    "infirmerie",
    "sport",
    "sante",
    "santé",
  ];
  for (const s of services) {
    if (text.includes(normalize(s))) {
      entities.service = s;
      break;
    }
  }

  // ---------- DATE ----------
  const dateRegex =
    /\b(\d{1,2}\s?(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|apres[- ]demain|semaine prochaine)\b/i;
  const matchDate = input.match(dateRegex);
  if (matchDate)
    entities.date = parseDateExpression(matchDate[0]) || matchDate[0];

  // ---------- PERSONNE ----------
  const personRegex =
    /\b(M\.|Mme|Monsieur|Madame|Professeur|Dr\.?)\s+[A-ZÉÈÊÂÔÎ][a-zéèêôîïç]+/;
  const matchPerson = input.match(personRegex);
  if (matchPerson) entities.personne = matchPerson[0];

  // ---------- LIEU ----------
  const lieuRegex =
    /\b(salle\s?\d{1,3}|batiment\s?[A-Z]|bâtiment\s?[A-Z]|campus\s\w+)/i;
  const matchLieu = input.match(lieuRegex);
  if (matchLieu) entities.lieu = matchLieu[0];

  return entities;
}
