// // import { NextResponse } from "next/server";
// // import { v4 as uuidv4 } from "uuid";
// // export const runtime = "nodejs";
// // import {
// //   validateSession,
// //   findBestAnswer,
// //   appendLog,
// //   normalize,
// // } from "@/lib/db";

// // /**
// //  * SCRUM-17 additions:
// //  * - detectInjection(input): basic regex-based detector
// //  * - securityAttempts: in-memory counter per key (IP or user) to detect repeated attempts
// //  *
// //  * NOTE: in production, remplacez securityAttempts par Redis/DB pour persistance et scale.
// //  */

// // // --- Détecteur basique d'injection (XSS / SQLi / JS)
// // function detectInjection(input: string): {
// //   detected: boolean;
// //   pattern?: string;
// // } {
// //   if (!input || typeof input !== "string") return { detected: false };

// //   // Patterns (ordre : plus spécifiques -> plus généraux)
// //   const patterns: { name: string; re: RegExp }[] = [
// //     { name: "xss_script_tag", re: /<script\b[^>]*>([\s\S]*?)<\/script>/i },
// //     { name: "xss_event_handler", re: /on\w+\s*=/i }, // onerror= onload= etc.
// //     { name: "xss_img_onerror", re: /<img\b[^>]*onerror\s*=/i },
// //     { name: "js_eval", re: /\beval\s*\(/i },
// //     { name: "js_fetch_xhr", re: /\b(fetch|XMLHttpRequest)\b/i },
// //     { name: "sqli_union_select", re: /\bunion\b[\s\S]*\bselect\b/i },
// //     {
// //       name: "sqli_tautology",
// //       re: /(['"`]).*?\1\s*or\s+['"`]?.*?['"`]?\s*=\s*['"`]?.*?['"`]?/i,
// //     },
// //     {
// //       name: "sqli_drop",
// //       re: /\b(drop|delete|insert|update|alter)\b\s+table\b/i,
// //     },
// //     { name: "sql_semicolon", re: /;.*\b(drop|select|insert|delete|update)\b/i },
// //     // catch-all suspicious chars + keywords
// //     {
// //       name: "suspicious_chars_keywords",
// //       re: /(<\/?\w+[^>]*>)|(--\s*$)|(\b(alert|prompt|onerror|onload|exec|system)\b)/i,
// //     },
// //   ];

// //   for (const p of patterns) {
// //     if (p.re.test(input)) {
// //       return { detected: true, pattern: p.name };
// //     }
// //   }
// //   return { detected: false };
// // }

// // // --- Comptage simple des tentatives pour alerte (in-memory).
// // // Key = ip OR userId (préférence IP). Valeur = { count, firstAttemptTs }
// // const securityAttempts = new Map<
// //   string,
// //   { count: number; firstTs: number; lastTs: number }
// // >();

// // // Seuils (configurables)
// // const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // fenêtre : 10 minutes
// // const ATTEMPT_THRESHOLD = 5; // 5 tentatives suspectes déclenchent alerte

// // export async function POST(req: Request) {
// //   try {
// //     // 🔐 Auth guard
// //     const cookies = req.headers.get("cookie") || "";
// //     const sessionId = cookies.split("sid=")[1]?.split(";")[0];

// //     if (!sessionId) {
// //       return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
// //     }

// //     // Acceptation d'un SID de test en dev pour faciliter les tests locaux
// //     let session = null;
// //     if (
// //       process.env.NODE_ENV !== "production" &&
// //       sessionId === "test-session-1"
// //     ) {
// //       session = { user_id: "test-user" }; // session factice pour dev
// //     } else {
// //       session = validateSession(sessionId);
// //     }

// //     if (!session) {
// //       return NextResponse.json({ error: "Session invalide" }, { status: 401 });
// //     }

// //     const { question, chatId: incomingChatId } = await req.json();
// //     if (!question) {
// //       return NextResponse.json({ error: "Question vide" }, { status: 400 });
// //     }

// //     // --- Analyse de sécurité AVANT traitement
// //     const ip =
// //       req.headers.get("x-forwarded-for") ||
// //       req.headers.get("x-real-ip") ||
// //       "unknown";
// //     const userAgent = req.headers.get("user-agent") || "unknown";
// //     const detection = detectInjection(question);

// //     if (detection.detected) {
// //       // Log sécurité détaillé
// //       const secChatId = incomingChatId || uuidv4();
// //       const timestamp = new Date().toISOString();

// //       appendLog({
// //         chatId: secChatId,
// //         userId: session.user_id,
// //         role: "security",
// //         text: `[SECURITY ALERT] Tentative d'injection détectée`,
// //         matched: false,
// //         timestamp,
// //         ip,
// //         userAgent,
// //         pattern: detection.pattern || "unknown_pattern",
// //         raw: question.length > 200 ? question.slice(0, 200) + "..." : question, // éviter sur-log
// //       });

// //       // Incrémenter compteur par IP (ou par user si ip unknown)
// //       const key = ip !== "unknown" ? `ip:${ip}` : `user:${session.user_id}`;
// //       const now = Date.now();
// //       const prev = securityAttempts.get(key);
// //       if (!prev || now - prev.firstTs > ATTEMPT_WINDOW_MS) {
// //         securityAttempts.set(key, { count: 1, firstTs: now, lastTs: now });
// //       } else {
// //         prev.count += 1;
// //         prev.lastTs = now;
// //         securityAttempts.set(key, prev);

// //         // Si dépassement du seuil, créer une alerte (log + éventuellement autre action)
// //         if (prev.count >= ATTEMPT_THRESHOLD) {
// //           appendLog({
// //             chatId: secChatId,
// //             userId: session.user_id,
// //             role: "security",
// //             text: `[SECURITY ALERT] Seuil atteint (${prev.count}) pour ${key}. Action recommandée: bannissement temporaire ou investigation.`,
// //             matched: false,
// //             timestamp: new Date().toISOString(),
// //             ip,
// //             userAgent,
// //             pattern: detection.pattern || "unknown_pattern",
// //           });

// //           // Optionnel : vous pouvez ici déclencher une notification externe (mail/Slack) via une job/queue.
// //         }
// //       }

// //       // Réponse générique sans détails techniques
// //       return NextResponse.json(
// //         { error: "Requête invalide détectée." },
// //         { status: 400 }
// //       );
// //     }

// //     const q = normalize(question);
// //     const chatId = incomingChatId || uuidv4();

// //     // 🧩 Réponses directes
// //     const directAnswers: Record<string, string> = {
// //       // 📚 Bibliothèque
// //       "horaires bibliotheque":
// //         "📚 La bibliothèque est ouverte du lundi au vendredi de 8h à 18h.",

// //       // 🍽️ Restaurant universitaire
// //       "horaires resto u":
// //         "🍽️ Le restaurant universitaire est ouvert de 11h30 à 14h et de 18h30 à 20h.",

// //       // 👩‍💼 Contact scolarité
// //       "contact scolarite": "CONTACT_SCOLARITE",

// //       // ✅ US-008 : Règles de vie du campus
// //       "regles de vie": `
// // 📘 Voici les principales <b>règles de vie du campus</b> :<br/><br/>
// // ✅ Respecter les horaires et les salles attribuées.<br/>
// // 🚭 Interdiction de fumer dans les bâtiments.<br/>
// // 🤝 Respect mutuel entre étudiants et enseignants.<br/>
// // 💻 Utilisation responsable des ressources numériques.<br/><br/>
// // 👉 Le <b>règlement intérieur complet</b> est disponible sur <b>Teams</b>, dans la classe :<br/>
// // <em>ESIS-2_CPDIA-2_2025-2026</em>.`,

// //       "reglement campus": "regles de vie",
// //       reglement: "regles de vie",
// //       "règles de vie": "regles de vie",
// //       "charte de bonne conduite": "regles de vie",
// //       "consignes de sécurité": "regles de vie",

// //       // ✅ US-009 : Dates importantes
// //       "dates importantes": `
// // 🗓️ Voici les prochaines <b>dates importantes</b> du calendrier académique :<br/><br/>
// // 📅 <b>Rentrée universitaire :</b> 22 septembre 2025<br/>
// // 📝 <b>Début des examens du semestre 1 :</b> 19 janvier 2025<br/>
// // 📅 <b>Journée Portes Ouvertes :</b> 15 mars 2025<br/>
// // 🌸 <b>Vacances de printemps :</b> 20 avril → 04 mai 2025<br/>
// // 🎓 <b>Fin des cours du semestre 2 :</b> 30 juin 2025<br/>
// // ☀️ <b>Vacances d’été :</b> à partir du 1er juillet 2025`,

// //       examens:
// //         "📝 Les examens du semestre 1 débutent le <b>19 janvier 2025</b>.",
// //       vacances: "☀️ Les vacances d'été commencent le <b>1er juillet 2025</b>.",

// //       // ✅ US-010 : Formations proposées
// //       "formations proposees": `
// // 🎓 L’ESIC propose plusieurs formations en <b>informatique</b> et en <b>commerce</b> :<br/><br/>

// // <b>BTS :</b><br/>
// // • BTS Management Commercial Opérationnel (MCO)<br/>
// // • BTS Gestion de la PME (GPME)<br/>
// // • BTS Cybersécurité Informatique et Réseaux, Électronique<br/>
// // • BTS SIO, option SISR (Infrastructures & Réseaux)<br/>
// // • BTS Négociation et Digitalisation de la Relation Client (NDRC)<br/>
// // • BTS Support à l’Action Managériale (SAM)<br/>
// // • BTS Cybersécurité (option CIEL)<br/><br/>

// // <b>Commerce :</b><br/>
// // • Chef de Projet Digital<br/>
// // • Prépa Community Manager<br/>
// // • TP - Responsable d'établissement marchand<br/>
// // • Responsable Commerce et Marketing<br/>
// // • Responsable d'activité commerciale et marketing<br/>
// // • Ingénieur d'Affaires<br/><br/>

// // <b>Informatique :</b><br/>
// // • Technicien Supérieur Systèmes et Réseaux<br/>
// // • Concepteur de solutions no code<br/>
// // • Administrateur d'infrastructures sécurisées<br/>
// // • Concepteur développeur d'applications<br/>
// // • Master Expert en Systèmes d’Information et Sécurité<br/>
// // • Chef de projet Data et Intelligence Artificielle<br/><br/>

// // <b>Autres :</b><br/>
// // • CAP AEPE<br/>
// // • TP SAMS
// // `,

// //       // synonymes
// //       formations: "formations proposees",
// //       formation: "formations proposees",
// //       bts: "formations proposees",
// //       master: "formations proposees",
// //       informatique: "formations proposees",
// //       commerce: "formations proposees",
// //       programmes: "formations proposees",
// //     };

// //     // 🔍 Recherche de réponse + gestion des redirections internes
// //     let found = directAnswers[q];

// //     // Si la valeur d'une clé redirige vers une autre (ex: "reglement campus" → "regles de vie")
// //     if (found && directAnswers[found]) {
// //       found = directAnswers[found];
// //     }

// //     if (!found) {
// //       found = findBestAnswer(q);
// //     }

// //     const response = found || "Je n'ai pas encore la réponse à cette question.";

// //     // 🧾 Sauvegarde (question)
// //     appendLog({
// //       chatId,
// //       userId: session.user_id,
// //       role: "user",
// //       text: question,
// //       matched: 1,
// //       timestamp: new Date().toISOString(),
// //       ip:
// //         req.headers.get("x-forwarded-for") ||
// //         req.headers.get("x-real-ip") ||
// //         "unknown",
// //     });

// //     // 🧾 Sauvegarde (réponse)
// //     appendLog({
// //       chatId,
// //       userId: session.user_id,
// //       role: "assistant",
// //       text: response,
// //       matched: Boolean(found),
// //       timestamp: new Date().toISOString(),
// //       ip: "server",
// //     });

// //     return NextResponse.json({ answer: response, chatId });
// //   } catch (e) {
// //     console.error("Erreur chat:", e);
// //     return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
// //   }
// // }
// import { NextResponse } from "next/server";
// import { v4 as uuidv4 } from "uuid";
// export const runtime = "nodejs";
// import {
//   validateSession,
//   findBestAnswer,
//   appendLog,
//   normalize,
// } from "@/lib/db";

// /**
//  * SCRUM-17 additions:
//  * - detectInjection(input): basic regex-based detector
//  * - securityAttempts: in-memory counter per key (IP or user) to detect repeated attempts
//  *
//  * NOTE: in production, remplacez securityAttempts par Redis/DB pour persistance et scale.
//  */

// // --- Détecteur basique d'injection (XSS / SQLi / JS)
// function detectInjection(input: string): {
//   detected: boolean;
//   pattern?: string;
// } {
//   if (!input || typeof input !== "string") return { detected: false };

//   const patterns: { name: string; re: RegExp }[] = [
//     { name: "xss_script_tag", re: /<script\b[^>]*>([\s\S]*?)<\/script>/i },
//     { name: "xss_event_handler", re: /on\w+\s*=/i }, // onerror= onload= etc.
//     { name: "xss_img_onerror", re: /<img\b[^>]*onerror\s*=/i },
//     { name: "js_eval", re: /\beval\s*\(/i },
//     { name: "js_fetch_xhr", re: /\b(fetch|XMLHttpRequest)\b/i },
//     { name: "sqli_union_select", re: /\bunion\b[\s\S]*\bselect\b/i },
//     {
//       name: "sqli_tautology",
//       re: /(['"`]).*?\1\s*or\s+['"`]?.*?['"`]?\s*=\s*['"`]?.*?['"`]?/i,
//     },
//     {
//       name: "sqli_drop",
//       re: /\b(drop|delete|insert|update|alter)\b\s+table\b/i,
//     },
//     { name: "sql_semicolon", re: /;.*\b(drop|select|insert|delete|update)\b/i },
//     {
//       name: "suspicious_chars_keywords",
//       re: /(<\/?\w+[^>]*>)|(--\s*$)|(\b(alert|prompt|onerror|onload|exec|system)\b)/i,
//     },
//   ];

//   for (const p of patterns) {
//     if (p.re.test(input)) {
//       return { detected: true, pattern: p.name };
//     }
//   }
//   return { detected: false };
// }

// // --- Comptage simple des tentatives pour alerte (in-memory).
// const securityAttempts = new Map<
//   string,
//   { count: number; firstTs: number; lastTs: number }
// >();

// // Seuils (configurables)
// const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // fenêtre : 10 minutes
// const ATTEMPT_THRESHOLD = 5; // 5 tentatives suspectes déclenchent alerte

// export async function POST(req: Request) {
//   try {
//     // 🔐 Auth guard
//     const cookies = req.headers.get("cookie") || "";
//     const sessionId = cookies.split("sid=")[1]?.split(";")[0];

//     if (!sessionId) {
//       return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
//     }

//     // Acceptation d'un SID de test en dev pour faciliter les tests locaux
//     let session: any = null;
//     if (
//       process.env.NODE_ENV !== "production" &&
//       sessionId === "test-session-1"
//     ) {
//       session = { user_id: "test-user" }; // session factice pour dev
//     } else {
//       session = validateSession(sessionId);
//     }

//     if (!session) {
//       return NextResponse.json({ error: "Session invalide" }, { status: 401 });
//     }

//     const { question, chatId: incomingChatId } = await req.json();
//     if (!question) {
//       return NextResponse.json({ error: "Question vide" }, { status: 400 });
//     }

//     // --- Analyse de sécurité AVANT traitement
//     const ip =
//       req.headers.get("x-forwarded-for") ||
//       req.headers.get("x-real-ip") ||
//       "unknown";
//     const userAgent = req.headers.get("user-agent") || "unknown";
//     const detection = detectInjection(question);

//     if (detection.detected) {
//       // Build a compact security message compatible with current appendLog signature
//       const secChatId = incomingChatId || uuidv4();
//       const timestamp = new Date().toISOString();
//       const pattern = detection.pattern || "unknown";

//       // Log de sécurité — texte unique contenant pattern et extrait de la requête
//       const truncated =
//         question.length > 200 ? question.slice(0, 200) + "..." : question;
//       const secText = `[SECURITY ALERT] Tentative d'injection détectée (${pattern}) : ${truncated}`;

//       // Append security log (compatible avec appendLog signature)
//       try {
//         appendLog({
//           chatId: secChatId,
//           userId: session.user_id || 0,
//           role: "security",
//           text: secText,
//           matched: false,
//           timestamp,
//           ip,
//         });
//         // console.debug possible pour dev
//         // console.log("[SECURITY] logged", { userId: session.user_id, ip, pattern });
//       } catch (err) {
//         console.error("[SECURITY] appendLog error:", err);
//       }

//       // Incrémenter compteur par IP (ou par user si ip unknown)
//       const key = ip !== "unknown" ? `ip:${ip}` : `user:${session.user_id}`;
//       const now = Date.now();
//       const prev = securityAttempts.get(key);
//       if (!prev || now - prev.firstTs > ATTEMPT_WINDOW_MS) {
//         securityAttempts.set(key, { count: 1, firstTs: now, lastTs: now });
//       } else {
//         prev.count += 1;
//         prev.lastTs = now;
//         securityAttempts.set(key, prev);

//         // Si dépassement du seuil, créer une alerte (log + éventuellement autre action)
//         if (prev.count >= ATTEMPT_THRESHOLD) {
//           const alertText = `[SECURITY ALERT] Seuil atteint (${prev.count}) pour ${key}. Action recommandée: bannissement temporaire ou investigation.`;
//           try {
//             appendLog({
//               chatId: secChatId,
//               userId: session.user_id || 0,
//               role: "security",
//               text: alertText,
//               matched: false,
//               timestamp: new Date().toISOString(),
//               ip,
//             });
//           } catch (err) {
//             console.error("[SECURITY] appendLog threshold error:", err);
//           }
//           // Optionnel : en prod, on devrait notifier une équipe (mail/Slack) via job/queue.
//         }
//       }

//       // Réponse générique sans détails techniques
//       return NextResponse.json(
//         { error: "Requête invalide détectée." },
//         { status: 400 }
//       );
//     }

//     // --- Suite du traitement normal
//     const q = normalize(question);
//     const chatId = incomingChatId || uuidv4();

//     // 🧩 Réponses directes
//     const directAnswers: Record<string, string> = {
//       // 📚 Bibliothèque
//       "horaires bibliotheque":
//         "📚 La bibliothèque est ouverte du lundi au vendredi de 8h à 18h.",

//       // 🍽️ Restaurant universitaire
//       "horaires resto u":
//         "🍽️ Le restaurant universitaire est ouvert de 11h30 à 14h et de 18h30 à 20h.",

//       // 👩‍💼 Contact scolarité
//       "contact scolarite": "CONTACT_SCOLARITE",

//       // ✅ US-008 : Règles de vie du campus
//       "regles de vie": `
// 📘 Voici les principales <b>règles de vie du campus</b> :<br/><br/>
// ✅ Respecter les horaires et les salles attribuées.<br/>
// 🚭 Interdiction de fumer dans les bâtiments.<br/>
// 🤝 Respect mutuel entre étudiants et enseignants.<br/>
// 💻 Utilisation responsable des ressources numériques.<br/><br/>
// 👉 Le <b>règlement intérieur complet</b> est disponible sur <b>Teams</b>, dans la classe :<br/>
// <em>ESIS-2_CPDIA-2_2025-2026</em>.`,

//       "reglement campus": "regles de vie",
//       reglement: "regles de vie",
//       "règles de vie": "regles de vie",
//       "charte de bonne conduite": "regles de vie",
//       "consignes de sécurité": "regles de vie",

//       // ✅ US-009 : Dates importantes
//       "dates importantes": `
// 🗓️ Voici les prochaines <b>dates importantes</b> du calendrier académique :<br/><br/>
// 📅 <b>Rentrée universitaire :</b> 22 septembre 2025<br/>
// 📝 <b>Début des examens du semestre 1 :</b> 19 janvier 2025<br/>
// 📅 <b>Journée Portes Ouvertes :</b> 15 mars 2025<br/>
// 🌸 <b>Vacances de printemps :</b> 20 avril → 04 mai 2025<br/>
// 🎓 <b>Fin des cours du semestre 2 :</b> 30 juin 2025<br/>
// ☀️ <b>Vacances d’été :</b> à partir du 1er juillet 2025`,

//       examens:
//         "📝 Les examens du semestre 1 débutent le <b>19 janvier 2025</b>.",
//       vacances: "☀️ Les vacances d'été commencent le <b>1er juillet 2025</b>.",

//       // ✅ US-010 : Formations proposées
//       "formations proposees": `
// 🎓 L’ESIC propose plusieurs formations en <b>informatique</b> et en <b>commerce</b> :<br/><br/>

// <b>BTS :</b><br/>
// • BTS Management Commercial Opérationnel (MCO)<br/>
// • BTS Gestion de la PME (GPME)<br/>
// • BTS Cybersécurité Informatique et Réseaux, Électronique<br/>
// • BTS SIO, option SISR (Infrastructures & Réseaux)<br/>
// • BTS Négociation et Digitalisation de la Relation Client (NDRC)<br/>
// • BTS Support à l’Action Managériale (SAM)<br/>
// • BTS Cybersécurité (option CIEL)<br/><br/>

// <b>Commerce :</b><br/>
// • Chef de Projet Digital<br/>
// • Prépa Community Manager<br/>
// • TP - Responsable d'établissement marchand<br/>
// • Responsable Commerce et Marketing<br/>
// • Responsable d'activité commerciale et marketing<br/>
// • Ingénieur d'Affaires<br/><br/>

// <b>Informatique :</b><br/>
// • Technicien Supérieur Systèmes et Réseaux<br/>
// • Concepteur de solutions no code<br/>
// • Administrateur d'infrastructures sécurisées<br/>
// • Concepteur développeur d'applications<br/>
// • Master Expert en Systèmes d’Information et Sécurité<br/>
// • Chef de projet Data et Intelligence Artificielle<br/><br/>

// <b>Autres :</b><br/>
// • CAP AEPE<br/>
// • TP SAMS
// `,

//       // synonymes
//       formations: "formations proposees",
//       formation: "formations proposees",
//       bts: "formations proposees",
//       master: "formations proposees",
//       informatique: "formations proposees",
//       commerce: "formations proposees",
//       programmes: "formations proposees",
//     };

//     // 🔍 Recherche de réponse + gestion des redirections internes
//     let found = directAnswers[q];

//     // Si la valeur d'une clé redirige vers une autre (ex: "reglement campus" → "regles de vie")
//     if (found && directAnswers[found]) {
//       found = directAnswers[found];
//     }

//     if (!found) {
//       found = findBestAnswer(q);
//     }

//     const response = found || "Je n'ai pas encore la réponse à cette question.";

//     // 🧾 Sauvegarde (question)
//     try {
//       appendLog({
//         chatId,
//         userId: session.user_id,
//         role: "user",
//         text: question,
//         matched: 1,
//         timestamp: new Date().toISOString(),
//         ip:
//           req.headers.get("x-forwarded-for") ||
//           req.headers.get("x-real-ip") ||
//           "unknown",
//       });
//     } catch (err) {
//       console.error("appendLog(user) failed:", err);
//     }

//     // 🧾 Sauvegarde (réponse)
//     try {
//       appendLog({
//         chatId,
//         userId: session.user_id,
//         role: "assistant",
//         text: response,
//         matched: Boolean(found),
//         timestamp: new Date().toISOString(),
//         ip: "server",
//       });
//     } catch (err) {
//       console.error("appendLog(assistant) failed:", err);
//     }

//     return NextResponse.json({ answer: response, chatId });
//   } catch (e) {
//     console.error("Erreur chat:", e);
//     return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
//   }
// }
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
 * SCRUM-17 additions:
 * - detectInjection(input): basic regex-based detector
 * - securityAttempts: in-memory counter per key (IP or user) to detect repeated attempts
 *
 * NOTE: in production, remplacez securityAttempts par Redis/DB pour persistance et scale.
 */

// --- Détecteur basique d'injection (XSS / SQLi / JS)
function detectInjection(input: string): {
  detected: boolean;
  pattern?: string;
} {
  if (!input || typeof input !== "string") return { detected: false };

  const patterns: { name: string; re: RegExp }[] = [
    { name: "xss_script_tag", re: /<script\b[^>]*>([\s\S]*?)<\/script>/i },
    { name: "xss_event_handler", re: /on\w+\s*=/i }, // onerror= onload= etc.
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

// --- Comptage simple des tentatives pour alerte (in-memory).
const securityAttempts = new Map<
  string,
  { count: number; firstTs: number; lastTs: number }
>();

// Seuils (configurables)
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // fenêtre : 10 minutes
const ATTEMPT_THRESHOLD = 5; // 5 tentatives suspectes déclenchent alerte

export async function POST(req: Request) {
  try {
    // 🔐 Auth guard
    const cookies = req.headers.get("cookie") || "";
    const sessionId = cookies.split("sid=")[1]?.split(";")[0];

    if (!sessionId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Acceptation d'un SID de test en dev pour faciliter les tests locaux
    let session: any = null;
    if (
      process.env.NODE_ENV !== "production" &&
      sessionId === "test-session-1"
    ) {
      // Utilisateur dev existant (seedé): akram — probablement id = 1
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

    // --- Analyse de sécurité AVANT traitement
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const detection = detectInjection(question);

    if (detection.detected) {
      // Build a compact security message compatible with current appendLog signature
      const secChatId = incomingChatId || uuidv4();
      const timestamp = new Date().toISOString();
      const pattern = detection.pattern || "unknown";

      // Log de sécurité — texte unique contenant pattern et extrait de la requête
      const truncated =
        question.length > 200 ? question.slice(0, 200) + "..." : question;
      const secText = `[SECURITY ALERT] Tentative d'injection détectée (${pattern}) : ${truncated}`;

      // DEBUG log juste avant l'appel appendLog (première insertion)
      console.log("[SEC-DETECT] will appendLog (security)", {
        chatId: secChatId,
        userId: session.user_id,
        role: "security",
        pattern,
        ip,
        userAgent,
        truncated: truncated.slice(0, 200),
      });

      // Append security log (compatible avec appendLog signature)
      try {
        appendLog({
          chatId: secChatId,
          userId: session.user_id || 0,
          role: "security",
          text: secText,
          matched: false,
          timestamp,
          ip,
        });
        console.log("[SEC-DETECT] appendLog (security) called successfully");
      } catch (err) {
        console.error("[SEC-DETECT] appendLog error:", err);
      }

      // Incrémenter compteur par IP (ou par user si ip unknown)
      const key = ip !== "unknown" ? `ip:${ip}` : `user:${session.user_id}`;
      const now = Date.now();
      const prev = securityAttempts.get(key);
      if (!prev || now - prev.firstTs > ATTEMPT_WINDOW_MS) {
        securityAttempts.set(key, { count: 1, firstTs: now, lastTs: now });
      } else {
        prev.count += 1;
        prev.lastTs = now;
        securityAttempts.set(key, prev);

        // Si dépassement du seuil, créer une alerte (log + éventuellement autre action)
        if (prev.count >= ATTEMPT_THRESHOLD) {
          const alertText = `[SECURITY ALERT] Seuil atteint (${prev.count}) pour ${key}. Action recommandée: bannissement temporaire ou investigation.`;

          // DEBUG log juste avant l'appel appendLog (seuil)
          console.log("[SEC-DETECT] will appendLog (threshold)", {
            chatId: secChatId,
            userId: session.user_id,
            role: "security",
            count: prev.count,
            key,
            ip,
            userAgent,
          });

          try {
            appendLog({
              chatId: secChatId,
              userId: session.user_id || 0,
              role: "security",
              text: alertText,
              matched: false,
              timestamp: new Date().toISOString(),
              ip,
            });
            console.log(
              "[SEC-DETECT] appendLog (threshold) called successfully"
            );
          } catch (err) {
            console.error("[SEC-DETECT] appendLog threshold error:", err);
          }
          // Optionnel : en prod, on devrait notifier une équipe (mail/Slack) via job/queue.
        }
      }

      // Réponse générique sans détails techniques
      return NextResponse.json(
        { error: "Requête invalide détectée." },
        { status: 400 }
      );
    }

    // --- Suite du traitement normal
    const q = normalize(question);
    const chatId = incomingChatId || uuidv4();

    // 🧩 Réponses directes
    const directAnswers: Record<string, string> = {
      // 📚 Bibliothèque
      "horaires bibliotheque":
        "📚 La bibliothèque est ouverte du lundi au vendredi de 8h à 18h.",

      // 🍽️ Restaurant universitaire
      "horaires resto u":
        "🍽️ Le restaurant universitaire est ouvert de 11h30 à 14h et de 18h30 à 20h.",

      // 👩‍💼 Contact scolarité
      "contact scolarite": "CONTACT_SCOLARITE",

      // ✅ US-008 : Règles de vie du campus
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

      // ✅ US-009 : Dates importantes
      "dates importantes": `
🗓️ Voici les prochaines <b>dates importantes</b> du calendrier académique :<br/><br/>
📅 <b>Rentrée universitaire :</b> 22 septembre 2025<br/>
📝 <b>Début des examens du semestre 1 :</b> 19 janvier 2025<br/>
📅 <b>Journée Portes Ouvertes :</b> 15 mars 2025<br/>
🌸 <b>Vacances de printemps :</b> 20 avril → 04 mai 2025<br/>
🎓 <b>Fin des cours du semestre 2 :</b> 30 juin 2025<br/>
☀️ <b>Vacances d’été :</b> à partir du 1er juillet 2025`,

      examens:
        "📝 Les examens du semestre 1 débutent le <b>19 janvier 2025</b>.",
      vacances: "☀️ Les vacances d'été commencent le <b>1er juillet 2025</b>.",

      // ✅ US-010 : Formations proposées
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

    // 🔍 Recherche de réponse + gestion des redirections internes
    let found = directAnswers[q];

    // Si la valeur d'une clé redirige vers une autre (ex: "reglement campus" → "regles de vie")
    if (found && directAnswers[found]) {
      found = directAnswers[found];
    }

    if (!found) {
      found = findBestAnswer(q);
    }

    const response = found || "Je n'ai pas encore la réponse à cette question.";

    // 🧾 Sauvegarde (question)
    try {
      appendLog({
        chatId,
        userId: session.user_id,
        role: "user",
        text: question,
        matched: 1,
        timestamp: new Date().toISOString(),
        ip:
          req.headers.get("x-forwarded-for") ||
          req.headers.get("x-real-ip") ||
          "unknown",
      });
    } catch (err) {
      console.error("appendLog(user) failed:", err);
    }

    // 🧾 Sauvegarde (réponse)
    try {
      appendLog({
        chatId,
        userId: session.user_id,
        role: "assistant",
        text: response,
        matched: Boolean(found),
        timestamp: new Date().toISOString(),
        ip: "server",
      });
    } catch (err) {
      console.error("appendLog(assistant) failed:", err);
    }

    return NextResponse.json({ answer: response, chatId });
  } catch (e) {
    console.error("Erreur chat:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
