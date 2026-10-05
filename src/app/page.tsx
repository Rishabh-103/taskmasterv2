"use client";

import { useEffect, useState } from "react";
import AuthForm from "@/components/AuthForm";
import Dashboard from "@/components/Dashboard";
import { api } from "@/lib/client";
import type { ClientUser } from "@/lib/types";

export default function Home() {
  // undefined = still checking the session, null = logged out
  const [user, setUser] = useState<ClientUser | null | undefined>(undefined);

  useEffect(() => {
    api<{ user: ClientUser }>("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-green-50 text-gray-500">Loading...</div>;
  }
  if (user === null) return <AuthForm onAuth={setUser} />;
  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}
