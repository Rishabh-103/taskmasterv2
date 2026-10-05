import type { HabitType } from "./period";

export type ClientHabit = {
  _id: string;
  name: string;
  type: HabitType;
  count: number;
  streak: number;
  bestStreak: number;
  completed: boolean;
  lastCompletedAt: string | null;
  createdAt: string;
};

export type ClientUser = { email: string };
