import { extractEntities } from "../src/lib/entities.js";

const tests = [
  "Je suis en Data Science 2e année",
  "Quels sont les horaires de la bibliothèque ce samedi ?",
  "Où est le bureau de M. Dupont au campus principal ?",
];

for (const input of tests) {
  const res = extractEntities(String(input)); // ✅ conversion en string
  console.log(`"${input}" =>`, res);
}
