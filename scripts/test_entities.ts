import { extractEntities } from "../src/lib/entities";

const tests = [
  "Quand sont les examens de Data Science 2e année ?",
  "Quels sont les horaires de la bibliothèque ce samedi ?",
  "Je suis en Master cybersécurité, où sont les cours ?",
  "J’ai vu M. Dupont dans le bâtiment A.",
  "La réunion a lieu lundi prochain en salle 203.",
  "Quels sont les horaires du resto U lundi prochain ?", // 🔥 test date relative
];

for (const q of tests) {
  console.log("\nQuestion :", q);
  console.log("→ Entités :", extractEntities(q));
}
