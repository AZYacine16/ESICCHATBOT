export function parseDateExpression(expr: string): string | undefined {
  const now = new Date();
  const lower = expr
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  const days = [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
  ];
  const months = [
    "janvier",
    "fevrier",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "aout",
    "septembre",
    "octobre",
    "novembre",
    "decembre",
  ];

  // ----- relatifs -----
  if (lower.includes("demain")) {
    now.setDate(now.getDate() + 1);
    return now.toISOString().split("T")[0];
  }
  if (lower.includes("apres") || lower.includes("après")) {
    now.setDate(now.getDate() + 2);
    return now.toISOString().split("T")[0];
  }
  if (lower.includes("semaine prochaine")) {
    now.setDate(now.getDate() + 7);
    return now.toISOString().split("T")[0];
  }

  // ----- jour de la semaine -----
  for (let i = 0; i < 7; i++) {
    if (lower.includes(days[i])) {
      const diff = (i + 7 - now.getDay()) % 7 || 7;
      now.setDate(now.getDate() + diff);
      return now.toISOString().split("T")[0];
    }
  }

  // ----- date absolue "15 mars" -----
  const abs = lower.match(/(\d{1,2})\s*(\w+)/);
  if (abs && months.includes(abs[2])) {
    const month = months.indexOf(abs[2]);
    const day = parseInt(abs[1]);
    const year = now.getFullYear();
    const date = new Date(year, month, day);
    return date.toISOString().split("T")[0];
  }

  return undefined;
}
