"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { ClientHabit } from "@/lib/types";

type HabitType = ClientHabit["type"];

export default function Modal({
  addHabit,
  changeModalStatus,
}: {
  addHabit: (habit: ClientHabit) => void;
  changeModalStatus: () => void;
}) {
  const [dropdown, setDropDown] = useState(false);
  const [name, setName] = useState("");
  const [count, setCount] = useState("");
  const [type, setType] = useState<HabitType>("Daily");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        changeModalStatus();
      }
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [changeModalStatus]);

  const handleAddHabit = async () => {
    const trimmedName = name.trim();
    const parsedCount = count === "" ? 0 : Number(count);

    if (!trimmedName) return setError("Habit name cannot be empty.");
    if (!Number.isInteger(parsedCount) || parsedCount < 0) return setError("Count must be a whole number, 0 or greater.");

    setSaving(true);
    setError("");
    try {
      const data = await api<{ habit: ClientHabit }>("/api/habits", {
        method: "POST",
        body: { name: trimmedName, count: parsedCount, type },
      });
      addHabit(data.habit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create habit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={changeModalStatus}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-black/10 bg-amber-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-black/10 px-6 py-5">
          <h2 className="text-2xl font-bold text-gray-800">New Habit</h2>
          <p className="mt-1 text-sm text-gray-600">
            Build consistency one habit at a time.
          </p>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 px-6 py-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              Habit Name
            </label>

            <input
              type="text"
              placeholder="e.g. Read for 30 minutes"
              value={name}
              autoFocus
              className="rounded-lg border border-black/20 bg-white px-3 py-2 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-green-300"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddHabit();
                }
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              Current Count
            </label>

            <input
              type="number"
              min={0}
              placeholder="0"
              value={count}
              className="rounded-lg border border-black/20 bg-white px-3 py-2 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-green-300"
              onChange={(e) => setCount(e.target.value)}
            />
          </div>

          <div className="relative">
            <label className="text-sm font-medium text-gray-700">
              Habit Type
            </label>

            <button
              type="button"
              onClick={() => setDropDown((prev) => !prev)}
              className="mt-2 flex w-full items-center justify-between rounded-lg border border-black/20 bg-white px-3 py-2 shadow-sm transition hover:bg-green-50"
            >
              <span>{type}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  dropdown ? "rotate-180" : ""
                }`}
              />
            </button>

            {dropdown && (
              <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-lg border border-black/10 bg-white shadow-lg">
                {(["Daily", "Weekly", "Monthly"] as HabitType[]).map(
                  (option) => (
                    <button
                      key={option}
                      type="button"
                      className="w-full px-4 py-2 text-left transition hover:bg-green-100"
                      onClick={() => {
                        setType(option);
                        setDropDown(false);
                      }}
                    >
                      {option}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="mx-6 mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-black/10 px-6 py-4">
          <button
            className="rounded-lg border border-black/20 bg-white px-4 py-2 transition hover:bg-gray-100"
            onClick={changeModalStatus}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            className="rounded-lg border border-black/20 bg-green-100 px-5 py-2 font-medium transition hover:bg-green-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleAddHabit}
            disabled={saving}
          >
            {saving ? "Adding..." : "Add Habit"}
          </button>
        </div>
      </div>
    </div>
  );
}