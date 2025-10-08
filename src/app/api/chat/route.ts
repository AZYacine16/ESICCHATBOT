import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
export const runtime = "nodejs";
import {
  validateSession,
  findBestAnswer,
  appendLog,
  normalize,
} from "@/lib/db";

/**
 * SCRUM-17 + SCRUM-18 + SCRUM-19:
 * - detectInjection(input) : basic regex detector (XSS / SQLi / JS)
 * - securityAttempts: in-memory counter per key (IP or user) for SCRUM-17
 * - rate limiting: per-user timestamps + ban map for SCRUM-18
 * - classifyQuestion: rule-based classifier for categories (SCRUM-19)
 *
 * NOTE: pour la production, remplacez Maps par Redis pour persistance & scale.
 */

// ---------------------- Injection detection (SCRUM-17) ----------------------
function detectInjection(input: string): {
  detected: boolean;
  pattern?: string;
} {
  if (!input || typeof input !== "string") return { detected: false };

  const patterns: { name: string; re: RegExp }[] = [
    { name: "xss_script_tag", re: /<script\b[^>]*>([\s\S]*?)<\/script>/i },
    { name: "xss_event_handler", re: /on\w+\s*=/i },
    { name: "xss_img_onerror", re: /<img\b[^>]*onerror\s*=/i },
    { name: "js_eval", re: /\beval\s*\(/i },
    { name: "js_fetch_xhr", re: /\b(fetch|XMLHttpRequest)\b/i },
    { name: "sqli_union_select", re: /\bunion\b[\s\S]*\bselect\b/i },
    {
      name: "sqli_tautology",
      re: /(['"`]).*?\1\s*or\s+['"`]?.*?['"`]?\s*=\s*['"`]?.*?['"`]?/i,
    },
    {
      name: "sqli_drop",
      re: /\b(drop|delete|insert|update|alter)\b\s+table\b/i,
    },
    { name: "sql_semicolon", re: /;.*\b(drop|select|insert|delete|update)\b/i },
    {
      name: "suspicious_chars_keywords",
      re: /(<\/?\w+[^>]*>)|(--\s*$)|(\b(alert|prompt|onerror|onload|exec|system)\b)/i,
    },
  ];

  for (const p of patterns) {
    if (p.re.test(input)) {
      return { detected: true, pattern: p.name };
    }
  }
  return { detected: false };
}

// ---------------------- Security attempts counting (SCRUM-17) ----------------------
const securityAttempts = new Map<
  string,
  { count: number; firstTs: number; lastTs: number }
>();
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const ATTEMPT_THRESHOLD = 5;

// ---------------------- Rate limiting (SCRUM-18) ----------------------
const RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS
  ? Number(process.env.RATE_LIMIT_WINDOW_MS)
  : 60 * 60 * 1000; // 1h
const RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX
  ? Number(process.env.RATE_LIMIT_MAX)
  : 10; // default 10
const RATE_LIMIT_BAN_MS = process.env.RATE_LIMIT_BAN_MS
  ? Number(process.env.RATE_LIMIT_BAN_MS)
  : 30 * 60 * 1000; // 30min
const rateMap = new Map<string, number[]>(); // user:<id> => timestamps
const banMap = new Map<string, number>(); // user:<id> => banExpiryEpochMs

// ---------------------- Direct answers (canonical + aliases) ----------------------
const rawDirect: Record<string, string> = {
  "horaires bibliotheque":
    "📚 La bibliothèque est ouverte du lundi au vendredi de 8h à 18h.",
  "horaires resto u":
    "🍽️ Le restaurant universitaire est ouvert de 11h30 à 14h et de 18h30 à 20h.",
  "contact scolarite": "CONTACT_SCOLARITE",
  "regles de vie": `
📘 Voici les principales <b>règles de vie du campus</b> :<br/><br/>
✅ Respecter les horaires et les salles attribuées.<br/>
🚭 Interdiction de fumer dans les bâtiments.<br/>
🤝 Respect mutuel entre étudiants et enseignants.<br/>
💻 Utilisation responsable des ressources numériques.<br/><br/>
👉 Le <b>règlement intérieur complet</b> est disponible sur <b>Teams</b>, dans la classe :<br/>
<em>ESIS-2_CPDIA-2_2025-2026</em>.`,
  "reglement campus": "regles de vie",
  reglement: "regles de vie",
  "règles de vie": "regles de vie",
  "charte de bonne conduite": "regles de vie",
  "consignes de sécurité": "regles de vie",
  "dates importantes": `
🗓️ Voici les prochaines <b>dates importantes</b> du calendrier académique :<br/><br/>
📅 <b>Rentrée universitaire :</b> 22 septembre 2025<br/>
📝 <b>Début des examens du semestre 1 :</b> 19 janvier 2025<br/>
📅 <b>Journée Portes Ouvertes :</b> 15 mars 2025<br/>
🌸 <b>Vacances de printemps :</b> 20 avril → 04 mai 2025<br/>
🎓 <b>Fin des cours du semestre 2 :</b> 30 juin 2025<br/>
☀️ <b>Vacances d’été :</b> à partir du 1er juillet 2025`,
  examens: "📝 Les examens du semestre 1 débutent le <b>19 janvier 2025</b>.",
  vacances: "☀️ Les vacances d'été commencent le <b>1er juillet 2025</b>.",
  "formations proposees": `
🎓 L’ESIC propose plusieurs formations en <b>informatique</b> et en <b>commerce</b> :<br/><br/>

<b>BTS :</b><br/>
• BTS Management Commercial Opérationnel (MCO)<br/>
• BTS Gestion de la PME (GPME)<br/>
• BTS Cybersécurité Informatique et Réseaux, Électronique<br/>
• BTS SIO, option SISR (Infrastructures & Réseaux)<br/>
• BTS Négociation et Digitalisation de la Relation Client (NDRC)<br/>
• BTS Support à l’Action Managériale (SAM)<br/>
• BTS Cybersécurité (option CIEL)<br/><br/>

<b>Commerce :</b><br/>
• Chef de Projet Digital<br/>
• Prépa Community Manager<br/>
• TP - Responsable d'établissement marchand<br/>
• Responsable Commerce et Marketing<br/>
• Responsable d'activité commerciale et marketing<br/>
• Ingénieur d'Affaires<br/><br/>

<b>Informatique :</b><br/>
• Technicien Supérieur Systèmes et Réseaux<br/>
• Concepteur de solutions no code<br/>
• Administrateur d'infrastructures sécurisées<br/>
• Concepteur développeur d'applications<br/>
• Master Expert en Systèmes d’Information et Sécurité<br/>
• Chef de projet Data et Intelligence Artificielle<br/><br/>

<b>Autres :</b><br/>
• CAP AEPE<br/>
• TP SAMS
`,

  // synonymes
  formations: "formations proposees",
  formation: "formations proposees",
  bts: "formations proposees",
  master: "formations proposees",
  informatique: "formations proposees",
  commerce: "formations proposees",
  programmes: "formations proposees",
};

const normalizedMap = new Map<string, string>();
for (const [k, v] of Object.entries(rawDirect)) {
  const finalVal = rawDirect[String(v)] ? rawDirect[String(v)] : v;
  normalizedMap.set(normalize(k), finalVal);
}

function resolveAliasByKey(key: string, maxDepth = 8): string | undefined {
  if (!key) return undefined;
  let k = normalize(key);
  let depth = 0;
  while (depth < maxDepth) {
    const val = normalizedMap.get(k);
    if (val === undefined) return undefined;
    const valNorm = normalize(String(val));
    if (normalizedMap.has(valNorm)) {
      if (valNorm === k) return val;
      k = valNorm;
      depth++;
      continue;
    }
    return val;
  }
  return normalizedMap.get(k);
}

// ---------------------- SCRUM-19: simple rule-based classifier ----------------------
function classifyQuestion(raw: string): string {
  if (!raw || typeof raw !== "string") return "unknown";
  const text = normalize(raw);
  // règle prioritaire : si la phrase mentionne horaires + bibliothèque,
  // on considère que c'est lié à l'emploi_du_temps (comportement "5/6")
  if (
    (text.includes("horaire") || text.includes("horaires")) &&
    text.includes("bibliotheque")
  ) {
    return "emploi_du_temps";
  }

  const categories: Record<string, string[]> = {
    emploi_du_temps: [
      "emploi",
      "emploi du temps",
      "planning",
      "horaire",
      "horaires",
      "examen",
      "examens",
      "calendrier",
      "date",
      "dates",
    ],
    procedure_admin: [
      "certificat",
      "inscription",
      "stage",
      "alternance",
      "diplome",
      "attestation",
      "convention",
      "certificat de scolarite",
      "certificat de scolarité",
    ],
    service_campus: [
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
    reglement: [
      "règle",
      "regle",
      "règlement",
      "reglement",
      "sanction",
      "absence",
      "absences",
      "conduite",
      "charte",
      "règles de vie",
      "regles de vie",
    ],
    formation: [
      "formation",
      "formations",
      "programme",
      "module",
      "debouch",
      "débouché",
      "bts",
      "master",
    ],
    contact: [
      "email",
      "contact",
      "bureau",
      "responsable",
      "téléphone",
      "telephone",
      "poste",
      "adresse",
    ],
    reclamation: [
      "probleme",
      "problème",
      "aide",
      "réclamation",
      "reclamation",
      "support",
      "bug",
      "pb",
    ],
  };

  const scores: Record<string, number> = {};
  const matchedKeywords: Record<string, string[]> = {};

  for (const [cat, kws] of Object.entries(categories)) {
    let s = 0;
    matchedKeywords[cat] = [];
    for (const kw of kws) {
      const nkw = normalize(kw);
      if (!nkw) continue;
      if (text.includes(nkw)) {
        // small weight by kw length to prefer longer matches
        const weight = Math.min(5, Math.max(1, Math.floor(nkw.length / 4)));
        s += weight;
        matchedKeywords[cat].push(kw);
      }
    }
    scores[cat] = s;
  }

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "unknown";
  const bestScore = entries[0][1];
  if (bestScore <= 0) return "unknown";

  const tied = entries.filter(([, sc]) => sc === bestScore).map(([k]) => k);
  if (tied.length === 1) return tied[0];

  // tie-breaker by longest matching keyword
  let bestCatByKw: string | null = null;
  let bestKwLen = 0;
  for (const cat of tied) {
    for (const kw of matchedKeywords[cat] || []) {
      const l = normalize(kw).length;
      if (l > bestKwLen) {
        bestKwLen = l;
        bestCatByKw = cat;
      }
    }
  }
  if (bestCatByKw) return bestCatByKw;

  // priority fallback
  const priority = [
    "service_campus",
    "contact",
    "procedure_admin",
    "reglement",
    "formation",
    "reclamation",
    "emploi_du_temps",
  ];
  for (const p of priority) if (tied.includes(p)) return p;

  return tied[0];
}

// ---------------------- POST handler ----------------------
export async function POST(req: Request) {
  try {
    // Auth guard
    const cookies = req.headers.get("cookie") || "";
    const sessionId = cookies.split("sid=")[1]?.split(";")[0];

    if (!sessionId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Dev helper: accept sid=test-session-1 => seeded user id = 1
    let session: any = null;
    if (
      process.env.NODE_ENV !== "production" &&
      sessionId === "test-session-1"
    ) {
      session = { user_id: 1 };
    } else {
      session = validateSession(sessionId);
    }

    if (!session) {
      return NextResponse.json({ error: "Session invalide" }, { status: 401 });
    }

    const { question, chatId: incomingChatId } = await req.json();
    if (!question) {
      return NextResponse.json({ error: "Question vide" }, { status: 400 });
    }

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const userKey = `user:${session.user_id}`;

    // normalize + chat id + category (computed once)
    const q = normalize(question);
    const chatId = incomingChatId || uuidv4();
    const category = classifyQuestion(question);

    // ---------- SCRUM-17: injection detection ----------
    const detection = detectInjection(question);
    if (detection.detected) {
      const secChatId = incomingChatId || uuidv4();
      const pattern = detection.pattern || "unknown";
      const truncated =
        question.length > 200 ? question.slice(0, 200) + "..." : question;
      const secText = `[SECURITY ALERT] Tentative d'injection détectée (${pattern}) : ${truncated}`;

      try {
        appendLog({
          chatId: secChatId,
          userId: session.user_id || 0,
          role: "security",
          text: secText,
          matched: false,
          timestamp: new Date().toISOString(),
          ip,
          category,
        });
      } catch (err) {
        console.error("[SEC-DETECT] appendLog error:", err);
      }

      // increment in-memory securityAttempts
      const key = ip !== "unknown" ? `ip:${ip}` : `user:${session.user_id}`;
      const now = Date.now();
      const prev = securityAttempts.get(key);
      if (!prev || now - prev.firstTs > ATTEMPT_WINDOW_MS) {
        securityAttempts.set(key, { count: 1, firstTs: now, lastTs: now });
      } else {
        prev.count += 1;
        prev.lastTs = now;
        securityAttempts.set(key, prev);
        if (prev.count >= ATTEMPT_THRESHOLD) {
          const alertText = `[SECURITY ALERT] Seuil atteint (${prev.count}) pour ${key}.`;
          try {
            appendLog({
              chatId: secChatId,
              userId: session.user_id || 0,
              role: "security",
              text: alertText,
              matched: false,
              timestamp: new Date().toISOString(),
              ip,
              category,
            });
          } catch (err) {
            console.error("[SEC-DETECT] appendLog threshold error:", err);
          }
        }
      }

      return NextResponse.json(
        { error: "Requête invalide détectée." },
        { status: 400 }
      );
    }

    // ---------- US-013: rate limiting ----------
    const now = Date.now();
    const banExpiry = banMap.get(userKey);
    if (banExpiry && banExpiry > now) {
      const remainingMin = Math.ceil((banExpiry - now) / 60000);
      const message = `Vous avez atteint la limite de questions. Réessayez dans ${remainingMin} minute(s).`;

      try {
        appendLog({
          chatId: incomingChatId || uuidv4(),
          userId: session.user_id || 0,
          role: "security",
          text: `[RATE LIMIT BLOCKED] Tentative alors que user est banni jusqu'à ${new Date(
            banExpiry
          ).toISOString()}`,
          matched: false,
          timestamp: new Date().toISOString(),
          ip,
          category,
        });
      } catch (err) {
        console.error("[RATE] appendLog blocked attempt error:", err);
      }
      return NextResponse.json({ error: message }, { status: 429 });
    }

    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const arr = rateMap.get(userKey) || [];
    const pruned = arr.filter((ts) => ts > windowStart);
    pruned.push(now);
    rateMap.set(userKey, pruned);

    if (pruned.length > RATE_LIMIT_MAX) {
      const banUntil = now + RATE_LIMIT_BAN_MS;
      banMap.set(userKey, banUntil);
      const humanMsg = `Vous avez atteint la limite de questions. Réessayez dans ${Math.ceil(
        RATE_LIMIT_BAN_MS / 60000
      )} minutes.`;

      try {
        appendLog({
          chatId: incomingChatId || uuidv4(),
          userId: session.user_id || 0,
          role: "security",
          text: `[RATE LIMIT EXCEEDED] user=${session.user_id} count=${pruned.length} window_ms=${RATE_LIMIT_WINDOW_MS}`,
          matched: false,
          timestamp: new Date().toISOString(),
          ip,
          category,
        });
      } catch (err) {
        console.error("[RATE] appendLog exceed error:", err);
      }
      return NextResponse.json({ error: humanMsg }, { status: 429 });
    }

    // ---------- Normal processing ----------
    let found = resolveAliasByKey(q);
    if (!found) found = findBestAnswer(q);
    const response = found || "Je n'ai pas encore la réponse à cette question.";

    // Save logs: user question (include category)
    try {
      appendLog({
        chatId,
        userId: session.user_id,
        role: "user",
        text: question,
        matched: Boolean(found),
        timestamp: new Date().toISOString(),
        ip,
        category,
      });
    } catch (err) {
      console.error("appendLog(user) failed:", err);
    }

    // Save assistant log (include category)
    try {
      appendLog({
        chatId,
        userId: session.user_id,
        role: "assistant",
        text: response,
        matched: Boolean(found),
        timestamp: new Date().toISOString(),
        ip: "server",
        category,
      });
    } catch (err) {
      console.error("appendLog(assistant) failed:", err);
    }

    return NextResponse.json({ answer: response, chatId, category });
  } catch (e) {
    console.error("Erreur chat:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
