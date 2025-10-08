// @ts-nocheck

import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { authenticateUser, createSession } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Identifiants requis" },
        { status: 400 }
      );
    }

    const user = authenticateUser(username, password);
    if (!user) {
      return NextResponse.json(
        { error: "Identifiant ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    const sessionId = createSession(user.id);

    const response = NextResponse.json({ ok: true });
    response.cookies.set("sid", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 jours
    });

    return response;
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
