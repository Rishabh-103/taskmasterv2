"use client";

import { CirclePlus, Flame } from "lucide-react";
import { useRef } from "react";
import type { ClientHabit } from "@/lib/types";

type Props = {
  habit: ClientHabit;
  deleteMode: boolean;
  selected: boolean;
  editingId: string | null;
  tempName: string;
  setTempName: (v: string) => void;
  setEditingId: (v: string | null) => void;
  onToggleSelect: () => void;
  onUpdate: (id: string, updates: { name?: string; type?: ClientHabit["type"] }) => void;
  onComplete: (id: string) => void;
};

export default function HabitRow({
  habit, deleteMode, selected, editingId, tempName, setTempName, setEditingId, onToggleSelect, onUpdate, onComplete,
}: Props) {
  const completed = habit.completed;
  const cancelled = useRef(false);

  // Enter/Escape just blur the input, so the save-or-cancel decision lives in one place.
  const commit = () => {
    const name = tempName.trim();
    if (!cancelled.current && name && name !== habit.name) onUpdate(habit._id, { name });
    cancelled.current = false;
    setEditingId(null);
  };

  return (
    <tr
      className={`border-b border-black/10 transition-all duration-150 hover:bg-white/50 ${completed ? "bg-green-50 text-gray-500" : ""} ${selected ? "bg-red-100/60" : ""}`}
    >
      {deleteMode && (
        <td className="px-4 py-3">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label={`Select ${habit.name}`} className="h-4 w-4 cursor-pointer" />
        </td>
      )}

      <td className="px-4 py-3 font-medium">
        {editingId === habit._id ? (
          <input
            autoFocus
            value={tempName}
            maxLength={80}
            className="w-full rounded-lg border border-black/20 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300"
            onChange={(e) => setTempName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") { cancelled.current = true; e.currentTarget.blur(); }
            }}
          />
        ) : (
          <button
            className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition hover:bg-white/60"
            onClick={() => { setEditingId(habit._id); setTempName(habit.name); }}
          >
            {completed && <span className="font-bold text-green-600">✓</span>}
            <span className={completed ? "line-through" : ""}>{habit.name}</span>
          </button>
        )}
      </td>

      <td className="px-4 py-3" title={`Best streak: ${habit.bestStreak}`}>
        <span className={`inline-flex items-center gap-1 ${habit.streak > 0 ? "text-orange-600" : "text-gray-400"}`}>
          <Flame className="h-4 w-4" />
          {habit.streak}
        </span>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="min-w-6 font-medium">{habit.count}</span>
          <button
            disabled={completed}
            aria-label={`Mark ${habit.name} done`}
            className={`rounded-full p-1 transition ${completed ? "cursor-not-allowed text-gray-400" : "hover:bg-green-100 hover:text-green-700"}`}
            onClick={() => onComplete(habit._id)}
          >
            <CirclePlus className="h-5 w-5" />
          </button>
        </div>
      </td>

      <td className="px-4 py-3">
        <select
          value={habit.type}
          aria-label={`Frequency of ${habit.name}`}
          className="rounded-lg border border-black/20 bg-white/80 px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-green-300"
          onChange={(e) => onUpdate(habit._id, { type: e.target.value as ClientHabit["type"] })}
        >
          <option value="Daily">Daily</option>
          <option value="Weekly">Weekly</option>
          <option value="Monthly">Monthly</option>
        </select>
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
        {new Date(habit.createdAt).toLocaleDateString("en-GB")}
      </td>
    </tr>
  );
}
