// scripts/test_classifier.ts
import { classifyQuestion } from "../src/lib/classifier"; // <-- crée ce fichier si tu ne l'as pas

const tests: [string, string][] = [
  ["Quels sont les horaires de la bibliothèque ?", "service_campus"],
  ["Comment obtenir un certificat de scolarité ?", "procedure_admin"],
  ["Où est le bureau du responsable pédagogique ?", "contact"],
  ["Quelles sont les règles de vie ?", "reglement"],
  ["Quels sont les débouchés du BTS ?", "formation"],
  ["J'ai un problème avec mon compte étudiant", "reclamation"],
  ["Quand sont les examens ?", "emploi_du_temps"],
];

let ok = 0;
for (const [q, exp] of tests) {
  const out = classifyQuestion(q);
  console.log(
    `"${q}" => ${out} ${out === exp ? "✔ OK" : `✖ FAIL (expected ${exp})`}`
  );
  if (out === exp) ok++;
}
console.log(`\nResult: Passed ${ok} / ${tests.length}`);
process.exit(0);
