import { normalize } from "./normalize"; // ré-utilise normalize existant

export function classifyQuestion(input: string): string {
  const text = normalize(String(input || ""));

  // catégories -> mots-clés (entities en premier)
  const categories: Record<string, { entities: string[]; kws: string[] }> = {
    // 🟢 service_campus passe avant emploi_du_temps
    service_campus: {
      entities: [
        "bibliotheque",
        "bibliothèque",
        "resto",
        "resto u",
        "restaurant",
        "sport",
        "sante",
        "santé",
        "infirmerie",
      ],
      kws: [
        "bibliotheque",
        "bibliothèque",
        "resto",
        "restaurant",
        "sport",
        "sante",
        "infirmerie",
      ],
    },

    emploi_du_temps: {
      entities: [
        "examen",
        "examens",
        "date",
        "dates",
        "horaire",
        "horaires",
        "planning",
        "emploi",
        "emploi du temps",
        "calendrier",
      ],
      kws: [
        "exam",
        "examens",
        "horaire",
        "horaires",
        "planning",
        "date",
        "calendrier",
      ],
    },

    procedure_admin: {
      entities: [
        "certificat",
        "certificats",
        "inscription",
        "inscriptions",
        "stage",
        "alternance",
        "attestation",
      ],
      kws: ["certificat", "inscription", "stage", "alternance", "attestation"],
    },

    reglement: {
      entities: [
        "règles",
        "regles",
        "sanction",
        "absence",
        "absences",
        "règlement",
      ],
      kws: ["règle", "règles", "regle", "regles", "sanction", "absence"],
    },

    formation: {
      entities: [
        "formation",
        "formations",
        "bts",
        "master",
        "programme",
        "module",
        "débouché",
        "debouché",
        "debouchés",
      ],
      kws: [
        "formation",
        "formations",
        "bts",
        "master",
        "programme",
        "module",
        "debouché",
      ],
    },

    contact: {
      entities: [
        "email",
        "e-mail",
        "mail",
        "bureau",
        "responsable",
        "poste",
        "téléphone",
        "telephone",
      ],
      kws: [
        "email",
        "contact",
        "bureau",
        "responsable",
        "telephone",
        "téléphone",
        "poste",
      ],
    },

    reclamation: {
      entities: [
        "problème",
        "probleme",
        "aide",
        "réclamation",
        "reclamation",
        "support",
        "bug",
      ],
      kws: ["probleme", "problème", "aide", "reclamation", "support", "bug"],
    },
  };

  // 1) Vérifier entités fortes : si l'une d'elles apparait -> retour immédiat
  for (const [cat, obj] of Object.entries(categories)) {
    for (const ent of obj.entities) {
      if (!ent) continue;
      if (text.includes(normalize(ent))) {
        return cat;
      }
    }
  }

  // 2) Scoring plus fin (kw hits, entity hits heavier)
  const scores: Record<string, number> = {};
  for (const [cat, obj] of Object.entries(categories)) {
    let s = 0;
    for (const kw of obj.kws) {
      if (!kw) continue;
      if (text.includes(normalize(kw))) s += 1;
    }
    scores[cat] = s;
  }

  // pick best
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestCat, bestScore] = sorted[0] ?? ["unknown", 0];

  if (bestScore <= 0) return "unknown";
  return bestCat;
}
