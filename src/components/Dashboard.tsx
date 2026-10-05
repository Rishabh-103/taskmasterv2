"use client";

import { Flame, HomeIcon, LogOut, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import HabitRow from "@/components/HabitRow";
import Modal from "@/components/Modal";
import { ApiError, api } from "@/lib/client";
import type { ClientHabit, ClientUser } from "@/lib/types";

export default function Dashboard({ user, onLogout }: { user: ClientUser; onLogout: () => void }) {
  const [habits, setHabits] = useState<ClientHabit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteMode, setDeleteMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Any 401 means the session expired: send the user back to the login form.
  const handle = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof ApiError && err.status === 401) return onLogout();
      return err instanceof Error ? err.message : fallback;
    },
    [onLogout],
  );

  const fetchHabits = useCallback(
    () =>
      api<ClientHabit[]>("/api/habits")
        .then(
          (data) => {
            setHabits(data);
            setError("");
          },
          (err) => {
            if (handle(err, "") !== undefined) {
              setError("Unable to load your habits. Please check your connection or try again later.");
            }
          },
        )
        .finally(() => setLoading(false)),
    [handle],
  );

  useEffect(() => {
    fetchHabits();
    // "Completed" is computed on the server, so refresh when the tab regains focus (e.g. after midnight).
    const refresh = () => document.visibilityState === "visible" && fetchHabits();
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [fetchHabits]);

  const replace = (habit: ClientHabit) => setHabits((prev) => prev.map((h) => (h._id === habit._id ? habit : h)));

  const run = async (path: string, method: string, body: unknown, fallback: string) => {
    setNotice("");
    try {
      const { habit } = await api<{ habit: ClientHabit }>(path, { method, body });
      replace(habit);
    } catch (err) {
      const msg = handle(err, fallback);
      if (msg) setNotice(msg);
      fetchHabits(); // resync with the server (e.g. after a 409)
    }
  };

  const completeHabit = (id: string) => run(`/api/habits/${id}/complete`, "POST", undefined, "Unable to complete habit.");
  const updateHabit = (id: string, updates: object) => run(`/api/habits/${id}`, "PATCH", updates, "Unable to update habit.");

  const deleteSelected = async () => {
    if (!deleteMode) return setDeleteMode(true);
    if (selectedIds.size === 0) return setNotice("Select at least one habit to delete.");
    if (!confirm("Delete selected habits?")) return;
    try {
      await api("/api/habits", { method: "DELETE", body: { ids: Array.from(selectedIds) } });
      setHabits((prev) => prev.filter((h) => !selectedIds.has(h._id)));
      setSelectedIds(new Set());
      setDeleteMode(false);
      setNotice("");
    } catch (err) {
      const msg = handle(err, "Unable to delete habits.");
      if (msg) setNotice(msg);
    }
  };

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    onLogout();
  };

  const sorted = useMemo(() => [...habits].sort((a, b) => Number(a.completed) - Number(b.completed)), [habits]);
  const doneCount = habits.filter((h) => h.completed).length;
  const bestStreak = habits.reduce((m, h) => Math.max(m, h.bestStreak), 0);

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const btn = "rounded-lg border border-black/20 bg-white/60 px-4 py-2 font-semibold transition duration-150 hover:scale-105 active:scale-95";

  return (
    <div className="min-h-screen bg-green-50">
      <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-black/10 bg-green-100 px-5 py-3 shadow-sm">
        <span className="flex items-center gap-2 font-semibold"><HomeIcon className="h-6 w-6" /> Taskmaster</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-gray-700 sm:inline">{user.email}</span>
          <button onClick={logout} className="flex items-center gap-1 rounded-lg p-2 transition hover:bg-black/10" aria-label="Log out">
            <LogOut className="h-5 w-5" /> Log out
          </button>
        </div>
      </nav>

      <main className="flex justify-center px-4 py-10">
        <div className="w-full max-w-5xl rounded-2xl border border-black/10 bg-amber-100 p-6 shadow-xl">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-bold">{today}</h2>
              <p className="text-sm text-gray-600">
                {doneCount} of {habits.length} habit{habits.length !== 1 ? "s" : ""} done this period
                {bestStreak > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-orange-600"><Flame className="h-4 w-4" /> best streak {bestStreak}</span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <button className={`${btn} hover:bg-white`} onClick={() => setIsModalOpen(true)}>+ Add Habit</button>
              <button className={`${btn} hover:bg-red-100`} onClick={deleteSelected}>
                <Trash2 className="mr-1 inline h-4 w-4" />
                {deleteMode ? "Confirm Delete" : "Delete"}
              </button>
              {deleteMode && (
                <button className={`${btn} hover:bg-white`} onClick={() => { setDeleteMode(false); setSelectedIds(new Set()); }}>Cancel</button>
              )}
            </div>
          </div>

          {isModalOpen && (
            <Modal
              addHabit={(h) => { setHabits((prev) => [...prev, h]); setIsModalOpen(false); }}
              changeModalStatus={() => setIsModalOpen(false)}
            />
          )}

          {notice && <div role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{notice}</div>}

          {error && (
            <div role="alert" className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4">
              <h3 className="font-semibold text-red-700">Unable to load habits</h3>
              <p className="mt-1 text-sm text-red-600">{error}</p>
              <button onClick={fetchHabits} className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm transition hover:bg-red-100">Retry</button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl bg-white/30">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-black/20 bg-black/5">
                  {deleteMode && <th className="w-10 px-4 py-3" />}
                  <th className="w-2/5 px-4 py-3 text-left font-semibold">Task Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Streak</th>
                  <th className="px-4 py-3 text-left font-semibold">Count</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={deleteMode ? 6 : 5} className="py-10 text-center text-gray-500">Loading habits...</td></tr>
                ) : habits.length === 0 ? (
                  <tr><td colSpan={deleteMode ? 6 : 5} className="py-10 text-center text-gray-500">No habits yet. Add your first habit!</td></tr>
                ) : (
                  sorted.map((habit) => (
                    <HabitRow
                      key={habit._id}
                      habit={habit}
                      deleteMode={deleteMode}
                      selected={selectedIds.has(habit._id)}
                      editingId={editingId}
                      tempName={tempName}
                      setTempName={setTempName}
                      setEditingId={setEditingId}
                      onToggleSelect={() =>
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(habit._id)) next.delete(habit._id);
                          else next.add(habit._id);
                          return next;
                        })
                      }
                      onUpdate={updateHabit}
                      onComplete={completeHabit}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
