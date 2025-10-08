// "use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// import { v4 as uuidv4 } from "uuid";

// type Message = { id: string; role: "user" | "assistant"; text: string };
// type ChatHistory = {
//   chatId: string;
//   startedAt: string;
//   messages: Message[];
// };

// const SUGGESTIONS = [
//   "Horaires bibliothèque",
//   "Horaires resto U",
//   "Contact scolarité",
//   "Règlement campus",
//   "Dates importantes",
//   "Formations proposées",
// ];

// export default function Home() {
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [input, setInput] = useState("");
//   const [loading, setLoading] = useState(false);
//   const listRef = useRef<HTMLDivElement>(null);
//   const [authed, setAuthed] = useState<boolean | null>(null);
//   const [showHistory, setShowHistory] = useState(false);
//   const [history, setHistory] = useState<ChatHistory[]>([]);
//   const [currentChatId, setCurrentChatId] = useState<string>(uuidv4());

//   useEffect(() => {
//     listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
//   }, [messages]);

//   useEffect(() => {
//     (async () => {
//       try {
//         const res = await fetch("/api/auth/status");
//         setAuthed(res.ok);
//       } catch {
//         setAuthed(false);
//       }
//     })();
//   }, []);

//   useEffect(() => {
//     if (authed === false && typeof window !== "undefined") {
//       window.location.href = "/login";
//     }
//   }, [authed]);

//   const canSend = useMemo(
//     () => input.trim().length > 0 && !loading,
//     [input, loading]
//   );

//   if (authed === null) {
//     return <div className="p-10 text-center">Chargement...</div>;
//   }

//   async function send(question: string) {
//     const q = question.trim();
//     if (!q || !authed) return;

//     const msg: Message = { id: uuidv4(), role: "user", text: q };
//     setMessages((m) => [...m, msg]);
//     setInput("");
//     setLoading(true);

//     try {
//       const res = await fetch("/api/chat", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ question: q, chatId: currentChatId }),
//       });
//       if (res.status === 401) {
//         setAuthed(false);
//         if (typeof window !== "undefined") window.location.href = "/login";
//         return;
//       }
//       const data = await res.json();
//       const text =
//         data?.answer || "Je n’ai pas encore la réponse à cette question.";
//       setMessages((m) => [...m, { id: uuidv4(), role: "assistant", text }]);
//     } catch (e) {
//       setMessages((m) => [
//         ...m,
//         {
//           id: uuidv4(),
//           role: "assistant",
//           text: "Erreur de connexion à l’API.",
//         },
//       ]);
//     } finally {
//       setLoading(false);
//     }
//   }

//   function onSubmit(e: React.FormEvent) {
//     e.preventDefault();
//     if (canSend) send(input);
//   }

//   function newChat() {
//     setMessages([]);
//     setInput("");
//     setCurrentChatId(uuidv4());
//   }

//   async function logout() {
//     try {
//       await fetch("/api/auth/logout", { method: "POST" });
//       window.location.href = "/login";
//     } catch (e) {
//       console.error("Erreur de déconnexion:", e);
//     }
//   }

//   async function toggleHistory() {
//     if (!showHistory) {
//       try {
//         const res = await fetch("/api/history");
//         const data = await res.json();

//         // On suppose que l'API renvoie des conversations complètes
//         // Exemple: [{ chatId, startedAt, messages: [...] }, ...]
//         setHistory(data.chats || []);
//       } catch (e) {
//         console.error("Erreur chargement historique:", e);
//       }
//     }
//     setShowHistory((v) => !v);
//   }

//   function loadChat(chat: ChatHistory) {
//     setMessages(chat.messages || []);
//     setCurrentChatId(chat.chatId);
//     setShowHistory(false); // refermer le drawer
//   }

//   return (
//     <div
//       className="min-h-screen flex flex-col items-center justify-center p-0 lg:p-6"
//       style={{
//         background: "linear-gradient(to bottom right, #f9fafb, #e5e7eb)",
//       }}
//     >
//       <div className="w-full lg:max-w-3xl bg-white rounded-none lg:rounded-2xl shadow-none lg:shadow-xl border-0 lg:border border-gray-200 flex flex-col h-[100vh] lg:h-[80vh] relative">
//         {/* Header */}
//         <header
//           className="flex items-center justify-between p-4 sm:p-5"
//           style={{ background: "linear-gradient(to right, #2563eb, #1e3a8a)" }}
//         >
//           <h1 className="text-lg font-semibold text-white">Assistant Campus</h1>
//           <div className="flex items-center gap-2">
//             <button
//               onClick={newChat}
//               className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm font-medium hover:bg-white/30 transition"
//             >
//               Nouveau chat
//             </button>
//             <button
//               onClick={toggleHistory}
//               className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm font-medium hover:bg-white/30 transition"
//             >
//               Historique
//             </button>
//             <button
//               onClick={logout}
//               className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
//             >
//               Déconnexion
//             </button>
//           </div>
//         </header>

//         {/* Messages */}
//         <div
//           ref={listRef}
//           className="flex-1 overflow-auto p-4 sm:p-5 space-y-3 bg-gray-50"
//         >
//           {messages.length === 0 && authed !== false && (
//             <div className="text-sm text-gray-500 text-center mt-10">
//               Pose une question sur le campus 📚
//             </div>
//           )}
//           {messages.map((m) => (
//             <div
//               key={m.id}
//               className={m.role === "user" ? "text-right" : "text-left"}
//             >
//               {m.role === "assistant" &&
//               m.text.startsWith("CONTACT_SCOLARITE") ? (
//                 <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-gray-800 shadow-sm max-w-sm">
//                   <h3 className="font-semibold text-blue-700 mb-2">
//                     📌 Service Scolarité
//                   </h3>
//                   <p>📧 scolarite@campus.fr</p>
//                   <p>📞 01 23 45 67 89</p>
//                   <p>📍 Bâtiment A, 2ème étage, bureau 203</p>
//                   <p>🕒 Lundi – Vendredi, 9h00 – 17h00</p>
//                 </div>
//               ) : (
//                 <div
//                   className={
//                     "inline-block px-4 py-2.5 rounded-2xl max-w-[75%] " +
//                     (m.role === "user"
//                       ? "bg-blue-600 text-white"
//                       : "bg-gray-200 text-gray-900")
//                   }
//                 >
//                   {m.text}
//                 </div>
//               )}
//             </div>
//           ))}
//         </div>

//         {/* Input */}
//         <form
//           onSubmit={onSubmit}
//           className="p-4 sm:p-5 border-t border-gray-200 bg-white space-y-3"
//         >
//           <div className="flex items-center gap-2">
//             <input
//               value={input}
//               onChange={(e) => setInput(e.target.value)}
//               placeholder="Écris ta question..."
//               className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
//             />
//             <button
//               type="submit"
//               disabled={!canSend}
//               className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-sm"
//             >
//               {loading ? "Envoi..." : "Envoyer"}
//             </button>
//           </div>
//           <div className="flex flex-wrap gap-2">
//             {SUGGESTIONS.map((s) => (
//               <button
//                 key={s}
//                 type="button"
//                 onClick={() => send(s)}
//                 className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-100"
//               >
//                 {s}
//               </button>
//             ))}
//           </div>
//         </form>

//        {/* Drawer Historique */}
// <div
//   className={`fixed top-0 right-0 h-full
//               w-full sm:w-72 md:w-80 lg:w-96
//               max-w-xs sm:max-w-sm bg-white
//               border-l border-gray-200 shadow-lg
//               transform transition-transform duration-300
//               ${showHistory ? "translate-x-0" : "translate-x-full"}`}
// >
//   <div className="p-4 flex justify-between items-center border-b">
//     <h2 className="text-lg font-semibold text-gray-700">📜 Historique</h2>
//     <button
//       onClick={() => setShowHistory(false)}
//       className="text-sm text-gray-500 hover:text-gray-800"
//     >
//       ✖
//     </button>
//   </div>
//   <div className="p-4 overflow-auto h-full space-y-2">
//     {history.length === 0 ? (
//       <p className="text-sm text-gray-500">
//         Aucune conversation enregistrée.
//       </p>
//     ) : (
//       <ul className="space-y-2">
//         {history.map((chat) => (
//           <li
//             key={chat.chatId}
//             onClick={() => loadChat(chat)}
//             className="p-3 border rounded-lg hover:bg-gray-100 cursor-pointer transition"
//           >
//             <p className="text-sm font-medium text-gray-800 truncate">
//               💬 Chat du {new Date(chat.startedAt).toLocaleString()}
//             </p>
//             <p className="text-xs text-gray-500 truncate">
//               {chat.messages[0]?.text || "Conversation"}
//             </p>
//           </li>
//         ))}
//       </ul>
//     )}
//   </div>
// </div>

//       </div>
//     </div>
//   );
// }
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

type Message = { id: string; role: "user" | "assistant"; text: string };
type ChatHistory = {
  chatId: string;
  startedAt: string;
  messages: Message[];
};

const SUGGESTIONS = [
  "Horaires bibliothèque",
  "Horaires resto U",
  "Contact scolarité",
  "Règlement campus",
  "Dates importantes",
  "Formations proposées",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>(uuidv4());

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/status");
        setAuthed(res.ok);
      } catch {
        setAuthed(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (authed === false && typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, [authed]);

  const canSend = useMemo(
    () => input.trim().length > 0 && !loading,
    [input, loading]
  );

  if (authed === null) {
    return <div className="p-10 text-center">Chargement...</div>;
  }

  async function send(question: string) {
    const q = question.trim();
    if (!q || !authed) return;

    const msg: Message = { id: uuidv4(), role: "user", text: q };
    setMessages((m) => [...m, msg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, chatId: currentChatId }),
      });
      if (res.status === 401) {
        setAuthed(false);
        if (typeof window !== "undefined") window.location.href = "/login";
        return;
      }
      const data = await res.json();
      const text =
        data?.answer || "Je n’ai pas encore la réponse à cette question.";
      setMessages((m) => [...m, { id: uuidv4(), role: "assistant", text }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: uuidv4(),
          role: "assistant",
          text: "Erreur de connexion à l’API.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (canSend) send(input);
  }

  function newChat() {
    setMessages([]);
    setInput("");
    setCurrentChatId(uuidv4());
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (e) {
      console.error("Erreur de déconnexion:", e);
    }
  }

  async function toggleHistory() {
    if (!showHistory) {
      try {
        const res = await fetch("/api/history");
        const data = await res.json();
        setHistory(data.chats || []);
      } catch (e) {
        console.error("Erreur chargement historique:", e);
      }
    }
    setShowHistory((v) => !v);
  }

  function loadChat(chat: ChatHistory) {
    setMessages(chat.messages || []);
    setCurrentChatId(chat.chatId);
    setShowHistory(false);
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-0 lg:p-6"
      style={{
        background: "linear-gradient(to bottom right, #f9fafb, #e5e7eb)",
      }}
    >
      <div className="w-full lg:max-w-5xl bg-white rounded-none lg:rounded-2xl shadow-none lg:shadow-xl border-0 lg:border border-gray-200 flex flex-col h-[100vh] lg:h-[80vh] relative">
        {/* Header */}
        <header
          className="flex items-center justify-between p-4 sm:p-5"
          style={{ background: "linear-gradient(to right, #2563eb, #1e3a8a)" }}
        >
          <h1 className="text-lg font-semibold text-white">Assistant Campus</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={newChat}
              className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm font-medium hover:bg-white/30 transition"
            >
              Nouveau chat
            </button>
            <button
              onClick={toggleHistory}
              className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm font-medium hover:bg-white/30 transition"
            >
              Historique
            </button>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
            >
              Déconnexion
            </button>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={listRef}
          className="flex-1 overflow-auto p-4 sm:p-5 space-y-3 bg-gray-50"
        >
          {messages.length === 0 && authed !== false && (
            <div className="text-sm text-gray-500 text-center mt-10">
              Pose une question sur le campus 📚
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={m.role === "user" ? "text-right" : "text-left"}
            >
              {m.role === "assistant" &&
              m.text.startsWith("CONTACT_SCOLARITE") ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-gray-800 shadow-sm max-w-sm">
                  <h3 className="font-semibold text-blue-700 mb-2">
                    📌 Service Scolarité
                  </h3>
                  <p>📧 scolarite@campus.fr</p>
                  <p>📞 01 23 45 67 89</p>
                  <p>📍 Bâtiment A, 2ème étage, bureau 203</p>
                  <p>🕒 Lundi – Vendredi, 9h00 – 17h00</p>
                </div>
              ) : (
                <div
                  className={
                    "inline-block px-4 py-2.5 rounded-2xl max-w-[75%] " +
                    (m.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-900")
                  }
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: m.text.replace(/\n/g, "<br/>"),
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={onSubmit}
          className="p-4 sm:p-5 border-t border-gray-200 bg-white space-y-3"
        >
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Écris ta question..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-sm"
            >
              {loading ? "Envoi..." : "Envoyer"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-100"
              >
                {s}
              </button>
            ))}
          </div>
        </form>

        {/* Drawer Historique (toujours coulissant, peu importe la taille d'écran) */}
        <div
          className={`fixed top-0 right-0 h-full 
              w-full sm:w-72 md:w-80 lg:w-96 
              bg-white border-l border-gray-200 shadow-lg 
              transform transition-transform duration-300 z-50 
              ${showHistory ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="p-4 flex justify-between items-center border-b">
            <h2 className="text-lg font-semibold text-gray-700">
              📜 Historique
            </h2>
            <button
              onClick={() => setShowHistory(false)}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              ✖
            </button>
          </div>
          <div className="p-4 overflow-auto h-full space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">
                Aucune conversation enregistrée.
              </p>
            ) : (
              <ul className="space-y-2">
                {history.map((chat) => (
                  <li
                    key={chat.chatId}
                    onClick={() => loadChat(chat)}
                    className="p-3 border rounded-lg hover:bg-gray-100 cursor-pointer transition"
                  >
                    <p className="text-sm font-medium text-gray-800 truncate">
                      💬 Chat du {new Date(chat.startedAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {chat.messages[0]?.text || "Conversation"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
