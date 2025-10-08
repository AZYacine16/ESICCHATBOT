"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !username.trim() ||
      !password
    ) {
      setError("Tous les champs sont obligatoires");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:4000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ⚡ permet d’envoyer/recevoir les cookies
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username.trim(),
          password,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Échec de l'inscription");
      }

      router.push("/login?message=Compte créé avec succès");
    } catch (e: any) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F9FAFB]">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-gray-100">
        <div className="p-8 flex flex-col items-center text-center">
          <Image
            src="/ESIC.jpg"
            alt="ESIC"
            width={72}
            height={72}
            className="rounded-xl shadow-md"
          />
          <h1 className="mt-5 text-2xl font-bold text-[#1E3A8A]">
            Créer un compte
          </h1>
          <p className="text-sm text-gray-500 mt-1" style={{ color: "black" }}>
            Rejoignez notre assistant campus
          </p>
        </div>

        <form onSubmit={onSubmit} className="p-8 pt-0 space-y-5">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
              {error}
            </div>
          )}

          {/* Prénom et Nom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Prénom
              </label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-500"
                placeholder="Prénom"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Nom</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-500"
                placeholder="Nom"
                required
              />
            </div>
          </div>

          {/* Identifiant */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Identifiant
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-500"
              placeholder="Votre identifiant"
              required
            />
          </div>

          {/* Mot de passe */}
          <div className="relative">
            <label className="text-sm font-medium text-gray-700">
              Mot de passe
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-500"
              placeholder="••••••••"
              minLength={6}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-gray-500 hover:text-gray-700 text-sm"
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>

          {/* Confirmer mot de passe */}
          <div className="relative">
            <label className="text-sm font-medium text-gray-700">
              Confirmer le mot de passe
            </label>
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-500"
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-9 text-gray-500 hover:text-gray-700 text-sm"
            >
              {showConfirmPassword ? "🙈" : "👁"}
            </button>
          </div>

          {/* Bouton */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] shadow-md hover:opacity-90 transition"
          >
            {loading ? "Création du compte..." : "Créer mon compte"}
          </button>
        </form>

        <div className="p-6 pt-0 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-600">
            Déjà un compte ?{" "}
            <button
              onClick={() => router.push("/login")}
              className="text-sm font-medium text-[#1E3A8A] hover:underline"
            >
              Se connecter
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
