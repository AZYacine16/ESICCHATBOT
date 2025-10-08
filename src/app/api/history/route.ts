import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { validateSession, db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const cookies = req.headers.get("cookie") || "";
    const sessionId = cookies.split("sid=")[1]?.split(";")[0];
    if (!sessionId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Acceptation d'un SID de test en dev pour faciliter les tests locaux
    let session = null;
    if (
      process.env.NODE_ENV !== "production" &&
      sessionId === "test-session-1"
    ) {
      session = { user_id: "test-user" }; // session factice pour dev
    } else {
      session = validateSession(sessionId);
    }

    if (!session) {
      return NextResponse.json({ error: "Session invalide" }, { status: 401 });
    }

    // Récupération des logs avec regroupement par chat_id
    const rows = db
      .prepare(
        `SELECT id, chat_id, role, text, timestamp
         FROM logs
         WHERE user_id = ?
         ORDER BY chat_id DESC, timestamp ASC`
      )
      .all(session.user_id);

    // Regroupement par chat_id
    const chats: {
      chatId: string;
      startedAt: string;
      messages: { id: number; role: "user" | "assistant"; text: string }[];
    }[] = [];

    for (const row of rows) {
      let chat = chats.find((c) => c.chatId === row.chat_id);
      if (!chat) {
        chat = {
          chatId: row.chat_id,
          startedAt: row.timestamp,
          messages: [],
        };
        chats.push(chat);
      }

      chat.messages.push({
        id: row.id,
        role: row.role || "user",
        text: row.text,
      });
    }

    return NextResponse.json({ chats });
  } catch (e) {
    console.error("Erreur /api/history:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
