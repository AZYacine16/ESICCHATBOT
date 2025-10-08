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

    // 🧾 Sauvegarde (réponse)
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
