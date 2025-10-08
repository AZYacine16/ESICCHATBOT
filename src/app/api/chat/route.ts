import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
export const runtime = "nodejs";
import {
  validateSession,
  findBestAnswer,
  appendLog,
  normalize,
} from "@/lib/db";

export async function POST(req: Request) {
  try {
    // 🔐 Auth guard
    const cookies = req.headers.get("cookie") || "";
    const sessionId = cookies.split("sid=")[1]?.split(";")[0];

    if (!sessionId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const session = validateSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session invalide" }, { status: 401 });
    }

    const { question, chatId: incomingChatId } = await req.json();
    if (!question) {
      return NextResponse.json({ error: "Question vide" }, { status: 400 });
    }

    const q = normalize(question);
    const chatId = incomingChatId || uuidv4();

    // 🧩 Réponses directes
    const directAnswers: Record<string, string> = {
      "horaires bibliotheque":
        "📚 La bibliothèque est ouverte du lundi au vendredi de 8h à 18h.",

      "horaires resto u":
        "🍽️ Le restaurant universitaire est ouvert de 11h30 à 14h et de 18h30 à 20h.",

      "contact scolarite": "CONTACT_SCOLARITE",

      "reglement campus":
        "📘 Le règlement intérieur est disponible sur l'intranet du campus (rubrique Vie étudiante).",

      reglement:
        "📘 Le règlement intérieur est disponible sur l'intranet du campus (rubrique Vie étudiante).",

      // ✅ US-009 : Dates importantes du calendrier académique
      "dates importantes": `
🗓️ Voici les prochaines <b>dates importantes</b> du calendrier académique :<br/><br/>
📅 <b>Rentrée universitaire :</b> 22 septembre 2025<br/>
📝 <b>Début des examens du semestre 1 :</b> 19 janvier 2025<br/>
📅 <b>Journée Portes Ouvertes :</b> 15 mars 2025<br/>
🌸 <b>Vacances de printemps :</b> 20 avril → 04 mai 2025<br/>
🎓 <b>Fin des cours du semestre 2 :</b> 30 juin 2025<br/>
☀️ <b>Vacances d’été :</b> à partir du 1er juillet 2025
`,

      examens: `
📝 Les examens du semestre 1 débutent le **19 janvier 2025**.
`,

      vacances: `
☀️ Les vacances d'été commencent le **1er juillet 2025**.
`,

      "formations proposees": `
🎓 Formations proposées : Informatique, Gestion, Droit et Design.
`,

      formations: `
🎓 Formations proposées : Informatique, Gestion, Droit et Design.
`,
    };

    // 🔍 Recherche de réponse
    let found = directAnswers[q] || findBestAnswer(q);
    const response = found || "Je n'ai pas encore la réponse à cette question.";

    // 🧾 Sauvegarde question (utilisateur)
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

    // 🧾 Sauvegarde réponse (assistant)
    appendLog({
      chatId,
      userId: session.user_id,
      role: "assistant",
      text: response,
      matched: Boolean(found),
      timestamp: new Date().toISOString(),
      ip: "server",
    });

    return NextResponse.json({ answer: response, chatId });
  } catch (e) {
    console.error("Erreur chat:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
