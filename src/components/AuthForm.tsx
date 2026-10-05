"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import type { ClientUser } from "@/lib/types";

export default function AuthForm({ onAuth }: { onAuth: (user: ClientUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api<{ user: ClientUser }>(`/api/auth/${mode}`, { method: "POST", body: { email, password } });
      onAuth(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const input = "rounded-lg border border-black/20 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300";

  return (
    <div className="flex min-h-screen items-center justify-center bg-green-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-black/10 bg-amber-100 p-6 shadow-xl">
        <h1 className="text-3xl font-bold">Taskmaster</h1>
        <p className="mb-5 mt-1 text-sm text-gray-600">
          {mode === "login" ? "Log in to see your habits." : "Create an account to start tracking."}
        </p>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Email
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Password
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={input}
            />
          </label>
        </div>

        {error && <p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-lg border border-black/20 bg-green-100 px-4 py-2 font-semibold transition hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
          className="mt-3 w-full text-center text-sm text-gray-700 underline"
        >
          {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
