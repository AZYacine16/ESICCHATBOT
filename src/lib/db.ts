// import Database from "better-sqlite3";
// import fs from "fs";
// import path from "path";
// import bcrypt from "bcryptjs";
// import { randomUUID } from "crypto";

// const projectRoot = process.cwd();
// const dbDir = path.join(projectRoot, "server", "data");
// const dbPath = path.join(dbDir, "app.db");

// if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// export const db = new Database(dbPath);

// db.pragma("journal_mode = WAL");
// db.pragma("foreign_keys = ON");

// export function ensureSchema() {
//   db.exec(`
//     CREATE TABLE IF NOT EXISTS answers (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       key TEXT UNIQUE NOT NULL,
//       value TEXT NOT NULL
//     );

//     CREATE TABLE IF NOT EXISTS logs (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       chat_id TEXT NOT NULL,
//       user_id TEXT NOT NULL,
//       role TEXT NOT NULL,
//       text TEXT NOT NULL,
//       matched INTEGER DEFAULT 0,
//       timestamp TEXT NOT NULL,
//       ip TEXT DEFAULT 'unknown'
//     );

//     CREATE TABLE IF NOT EXISTS users (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       username TEXT UNIQUE NOT NULL,
//       password_hash TEXT NOT NULL,
//       created_at TEXT NOT NULL
//     );

//     CREATE TABLE IF NOT EXISTS sessions (
//       id TEXT PRIMARY KEY,
//       user_id INTEGER NOT NULL,
//       created_at TEXT NOT NULL,
//       expires_at TEXT NOT NULL,
//       FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
//     );
//   `);

//   try {
//     const cols = db.prepare("PRAGMA table_info('logs')").all() as Array<{
//       name: string;
//     }>;

//     const hasUserId = cols.some((c) => c.name === "user_id");
//     if (!hasUserId) {
//       db.exec("ALTER TABLE logs ADD COLUMN user_id INTEGER");
//     }

//     const hasIp = cols.some((c) => c.name === "ip");
//     if (!hasIp) {
//       db.exec("ALTER TABLE logs ADD COLUMN ip TEXT DEFAULT 'unknown'");
//     }
//   } catch (err) {
//     console.error("⚠️ Erreur ensureSchema migration :", err);
//   }
// }

// export function upsertAnswer(key: string, value: string) {
//   const stmt = db.prepare(
//     `INSERT INTO answers (key, value) VALUES (?, ?)
//      ON CONFLICT(key) DO UPDATE SET value=excluded.value`
//   );
//   stmt.run(key, value);
// }

// export function getAllAnswers() {
//   return db.prepare("SELECT key, value FROM answers").all();
// }

// export function findBestAnswer(normalizedQuestion: string) {
//   try {
//     seedAnswers();
//   } catch {}
//   let rows = getAllAnswers();
//   if (!rows || rows.length === 0) {
//     try {
//       const jsonPath = path.join(dbDir, "answers.json");
//       if (fs.existsSync(jsonPath)) {
//         const raw = fs.readFileSync(jsonPath, "utf-8");
//         const obj = JSON.parse(raw) as Record<string, string>;
//         Object.entries(obj).forEach(([k, v]) => upsertAnswer(k, v));
//         rows = getAllAnswers();
//       }
//     } catch {}
//   }

//   for (const row of rows) {
//     const k = normalize(row.key);
//     if (
//       k &&
//       (normalizedQuestion.includes(k) || k.includes(normalizedQuestion))
//     ) {
//       return row.value;
//     }
//   }

//   const qTokens = new Set(normalizedQuestion.split(" ").filter(Boolean));
//   let best = { score: 0, value: null as string | null };
//   for (const row of rows) {
//     const kTokens = new Set(normalize(row.key).split(" ").filter(Boolean));
//     if (kTokens.size === 0) continue;
//     let inter = 0;
//     for (const t of qTokens) if (kTokens.has(t)) inter++;
//     const union = qTokens.size + kTokens.size - inter;
//     const score = union > 0 ? inter / union : 0;
//     if (score > best.score) best = { score, value: row.value };
//   }
//   return best.score >= 0.34 ? best.value : null;
// }

// export function appendLog({
//   chatId,
//   userId,
//   role,
//   text,
//   matched,
//   timestamp,
//   ip,
// }: {
//   chatId: string;
//   userId: number | string;
//   role: "user" | "assistant" | "security";
//   text: string;
//   matched?: boolean;
//   timestamp?: string;
//   ip?: string;
// }) {
//   try {
//     const ts = timestamp || new Date().toISOString();

//     const safeUserId =
//       typeof userId === "number"
//         ? userId
//         : /^[0-9]+$/.test(userId as string)
//         ? Number(userId)
//         : 0;

//     const stmt = db.prepare(`
//       INSERT INTO logs (chat_id, user_id, role, text, matched, timestamp, ip)
//       VALUES (?, ?, ?, ?, ?, ?, ?)
//     `);

//     stmt.run(
//       chatId,
//       safeUserId,
//       role,
//       text,
//       matched ? 1 : 0,
//       ts,
//       ip || "unknown"
//     );
//   } catch (err) {
//     console.error("❌ Erreur appendLog :", err);
//   }
// }

// export function normalize(text: string) {
//   return text
//     .toLowerCase()
//     .normalize("NFD")
//     .replace(/\p{Diacritic}/gu, "")
//     .replace(/<[^>]*>/g, " ")
//     .replace(/[^a-z0-9\s]/g, " ")
//     .replace(/\s+/g, " ")
//     .trim();
// }

// export function authenticateUser(username: string, password: string) {
//   const trimmedUsername = String(username || "").trim();
//   const user = db
//     .prepare("SELECT * FROM users WHERE username=?")
//     .get(trimmedUsername);
//   if (!user) return null;
//   const ok = bcrypt.compareSync(password, user.password_hash);
//   if (!ok) return null;
//   return user;
// }

// export function createSession(userId: number) {
//   const id = randomUUID();
//   const now = new Date();
//   const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
//   db.prepare(
//     "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
//   ).run(id, userId, now.toISOString(), expires.toISOString());
//   return id;
// }

// export function validateSession(sessionId: string) {
//   return db
//     .prepare(
//       "SELECT s.*, u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at > ?"
//     )
//     .get(sessionId, new Date().toISOString());
// }

// export function ensureDefaultUser() {
//   try {
//     const existing = db
//       .prepare("SELECT * FROM users WHERE username=?")
//       .get("akram");
//     const hash = bcrypt.hashSync("akram123", 10);
//     if (!existing) {
//       db.prepare(
//         "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)"
//       ).run("akram", hash, new Date().toISOString());
//     } else {
//       db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
//         hash,
//         existing.id
//       );
//     }
//   } catch {}
// }

// ensureSchema();
// ensureDefaultUser();

// function seedAnswers() {
//   const seedAnswers: Record<string, string> = {
//     "horaires bibliotheque":
//       "La bibliothèque est ouverte du lundi au vendredi de 8h à 18h.",
//     "horaires resto u":
//       "Le restaurant universitaire est ouvert de 11h30 à 14h et de 18h30 à 20h.",
//     "contact scolarite":
//       "Vous pouvez contacter la scolarité à scolarite@campus.fr ou au 01 23 45 67 89.",
//     reglement:
//       "Le règlement intérieur est disponible sur l'intranet du campus.",
//     "dates importantes":
//       "Les examens débutent le 15 juin. Les inscriptions ferment le 30 septembre.",
//     formations:
//       "Nous proposons des formations en Informatique, Gestion, Droit et Design.",
//   };
//   Object.entries(seedAnswers).forEach(([key, value]) =>
//     upsertAnswer(key, value)
//   );
// }

// try {
//   seedAnswers();
// } catch {}
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const projectRoot = process.cwd();
const dbDir = path.join(projectRoot, "server", "data");
const dbPath = path.join(dbDir, "app.db");

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      matched INTEGER DEFAULT 0,
      timestamp TEXT NOT NULL,
      ip TEXT DEFAULT 'unknown'
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  try {
    const cols = db.prepare("PRAGMA table_info('logs')").all() as Array<{
      name: string;
    }>;

    const hasUserId = cols.some((c) => c.name === "user_id");
    if (!hasUserId) {
      db.exec("ALTER TABLE logs ADD COLUMN user_id INTEGER");
    }

    const hasIp = cols.some((c) => c.name === "ip");
    if (!hasIp) {
      db.exec("ALTER TABLE logs ADD COLUMN ip TEXT DEFAULT 'unknown'");
    }
  } catch (err) {
    console.error("⚠️ Erreur ensureSchema migration :", err);
  }
}

export function upsertAnswer(key: string, value: string) {
  const stmt = db.prepare(
    `INSERT INTO answers (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  );
  stmt.run(key, value);
}

export function getAllAnswers() {
  return db.prepare("SELECT key, value FROM answers").all();
}

// -------------------- Normalization --------------------
export function normalize(text: string) {
  if (!text) return "";
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // remove accents
    .replace(/<[^>]*>/g, " ") // strip tags
    .replace(/[^a-z0-9\s]/g, " ") // keep ascii alnum and spaces
    .replace(/\s+/g, " ")
    .trim();
}

// -------------------- Levenshtein (small & fast) --------------------
function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  const m = a.length,
    n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const v0 = new Array(n + 1);
  const v1 = new Array(n + 1);
  for (let i = 0; i <= n; i++) v0[i] = i;
  for (let i = 0; i < m; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < n; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= n; j++) v0[j] = v1[j];
  }
  return v1[n];
}

// -------------------- Improved fuzzy matcher --------------------
export function findBestAnswer(normalizedQuestion: string) {
  try {
    seedAnswers();
  } catch {}
  let rows = getAllAnswers();
  if (!rows || rows.length === 0) {
    try {
      const jsonPath = path.join(dbDir, "answers.json");
      if (fs.existsSync(jsonPath)) {
        const raw = fs.readFileSync(jsonPath, "utf-8");
        const obj = JSON.parse(raw) as Record<string, string>;
        Object.entries(obj).forEach(([k, v]) => upsertAnswer(k, v));
        rows = getAllAnswers();
      }
    } catch {}
  }

  const qNorm = normalize(normalizedQuestion || "");
  if (!qNorm) return null;

  // 1) exact / substring matches (best UX)
  for (const row of rows) {
    const k = normalize(row.key);
    if (!k) continue;
    if (k === qNorm || k.includes(qNorm) || qNorm.includes(k)) {
      return row.value;
    }
  }

  // 2) fuzzy: combine Jaccard (token overlap) + Levenshtein ratio
  const qTokens = new Set(qNorm.split(" ").filter(Boolean));
  let best = { score: 0, value: null as string | null };

  for (const row of rows) {
    const kNorm = normalize(row.key);
    if (!kNorm) continue;
    const kTokensArr = kNorm.split(" ").filter(Boolean);
    const kTokens = new Set(kTokensArr);
    if (kTokens.size === 0) continue;

    // jaccard
    let inter = 0;
    for (const t of qTokens) if (kTokens.has(t)) inter++;
    const union = qTokens.size + kTokens.size - inter;
    const jaccard = union > 0 ? inter / union : 0;

    // levenshtein normalized (1: exact, 0: totally diff)
    const maxLen = Math.max(qNorm.length, kNorm.length);
    const levScore = maxLen > 0 ? 1 - levenshtein(qNorm, kNorm) / maxLen : 0;

    // combined weighting
    const score = 0.6 * jaccard + 0.4 * levScore;

    if (score > best.score) best = { score, value: row.value };
  }

  // threshold tuned for good UX
  return best.score >= 0.28 ? best.value : null;
}

export function appendLog({
  chatId,
  userId,
  role,
  text,
  matched,
  timestamp,
  ip,
}: {
  chatId: string;
  userId: number | string;
  role: "user" | "assistant" | "security";
  text: string;
  matched?: boolean;
  timestamp?: string;
  ip?: string;
}) {
  try {
    const ts = timestamp || new Date().toISOString();

    const safeUserId =
      typeof userId === "number"
        ? userId
        : /^[0-9]+$/.test(userId as string)
        ? Number(userId)
        : 0;

    const stmt = db.prepare(`
      INSERT INTO logs (chat_id, user_id, role, text, matched, timestamp, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      chatId,
      safeUserId,
      role,
      text,
      matched ? 1 : 0,
      ts,
      ip || "unknown"
    );
  } catch (err) {
    console.error("❌ Erreur appendLog :", err);
  }
}

export function authenticateUser(username: string, password: string) {
  const trimmedUsername = String(username || "").trim();
  const user = db
    .prepare("SELECT * FROM users WHERE username=?")
    .get(trimmedUsername);
  if (!user) return null;
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return null;
  return user;
}

export function createSession(userId: number) {
  const id = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  db.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(id, userId, now.toISOString(), expires.toISOString());
  return id;
}

export function validateSession(sessionId: string) {
  return db
    .prepare(
      "SELECT s.*, u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at > ?"
    )
    .get(sessionId, new Date().toISOString());
}

export function ensureDefaultUser() {
  try {
    const existing = db
      .prepare("SELECT * FROM users WHERE username=?")
      .get("akram");
    const hash = bcrypt.hashSync("akram123", 10);
    if (!existing) {
      db.prepare(
        "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)"
      ).run("akram", hash, new Date().toISOString());
    } else {
      db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
        hash,
        existing.id
      );
    }
  } catch {}
}

ensureSchema();
ensureDefaultUser();

function seedAnswers() {
  const seedAnswers: Record<string, string> = {
    "horaires bibliotheque":
      "La bibliothèque est ouverte du lundi au vendredi de 8h à 18h.",
    "horaires resto u":
      "Le restaurant universitaire est ouvert de 11h30 à 14h et de 18h30 à 20h.",
    "contact scolarite":
      "Vous pouvez contacter la scolarité à scolarite@campus.fr ou au 01 23 45 67 89.",
    reglement:
      "Le règlement intérieur est disponible sur l'intranet du campus.",
    "dates importantes":
      "Les examens débutent le 15 juin. Les inscriptions ferment le 30 septembre.",
    formations:
      "Nous proposons des formations en Informatique, Gestion, Droit et Design.",
  };
  Object.entries(seedAnswers).forEach(([key, value]) =>
    upsertAnswer(key, value)
  );
}

try {
  seedAnswers();
} catch {}
