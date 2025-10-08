// scripts/test_classifier.cjs
// lance: node scripts/test_classifier.cjs

// Permet de require des .ts via ts-node (CommonJS wrapper)
require("ts-node/register");

// adapte le chemin si besoin : '../src/lib/classifier.ts' (ou '../src/lib/classifier')
const classifier = require("../src/lib/classifier.ts");

// si classifier exporte named export classifyQuestion
const classifyQuestion =
  classifier.classifyQuestion || classifier.default?.classifyQuestion;

// fallback si module.exports = function(...)
const maybeFn = typeof classifier === "function" ? classifier : null;

if (!classifyQuestion && !maybeFn) {
  console.error(
    "Impossible de trouver `classifyQuestion` dans src/lib/classifier.ts"
  );
  process.exit(2);
}
const fn = classifyQuestion || maybeFn;

// jeux de tests
const tests = [
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
  try {
    const out = fn(q);
    const pass = out === exp;
    console.log(
      (pass ? "✔" : "✖") +
        ` "${q}" => ${out}${pass ? "" : ` (expected ${exp})`}`
    );
    if (pass) ok++;
  } catch (err) {
    console.error("Erreur pour :", q, err);
  }
}
console.log(`\nResult: Passed ${ok} / ${tests.length}`);
if (ok !== tests.length) process.exitCode = 1;
