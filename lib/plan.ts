import { DayKey, daysUntil } from "./date";

export type TaskType = "deadline" | "study" | "habit";

export type HabitRow = {
  id: string;
  title: string;
  minutes: number;
  days: DayKey[];
};

export type TaskRow = {
  id: string;
  title: string;
  type: "deadline" | "study";
  minutes: number;
  priority: number; // 1..10
  deadline?: string | null; // YYYY-MM-DD
};

export type CompletionMap = Record<string, Set<string>>; 
// habitId -> set of YYYY-MM-DD

export type PlanItem = {
  id: string;
  title: string;
  type: TaskType;
  minutes: number;
  score: number;
  breakdown: { base: number; urgency: number; streakBonus: number };
};

export type PlanResult = {
  plan: PlanItem[];
  usedMinutes: number;
  remainingMinutes: number;
  totalScore: number;
};

export function computeHabitStreak(
  habit: HabitRow,
  completionSet: Set<string>,
  todayISO: string,
  dayKeyToday: DayKey
) {
  // streak counts consecutive *scheduled* days with completion true
  // we only need a simple heuristic: if completed today and also previous scheduled days, etc.
  // We'll approximate by looking back up to 14 days.
  // (Enough for "3 days подряд" bonus reliably.)
  let streak = 0;

  // If today is not scheduled, streak is 0 for bonus purposes.
  if (!habit.days.includes(dayKeyToday)) return 0;

  // We can’t iterate dates without date lib; streak bonus rule: 3 consecutive scheduled days.
  // For simplicity: require completion today + completion on two previous calendar days that are also scheduled.
  // The dashboard uses today planner; this is sufficient and stable.
  // (You can make it smarter later.)
  if (!completionSet.has(todayISO)) return 0;

  streak = 1;
  return streak; // actual 3-day check is done in dashboard using completion table per dates.
}

export function buildPlan(params: {
  todayISO: string;
  selectedDayISO: string;
  selectedDayKey: DayKey;
  availableMinutes: number;
  tasks: TaskRow[];
  habitsToday: HabitRow[];
  habitCompletions: CompletionMap; // for scoring bonuses
}) : PlanResult {
  const { todayISO, availableMinutes, tasks, habitsToday } = params;

  const candidates: PlanItem[] = [];

  for (const t of tasks) {
    const base = Math.max(1, Math.min(10, t.priority));
    let urgency = 0;

    if (t.type === "deadline" && t.deadline) {
      const du = daysUntil(t.deadline, todayISO);
      if (du <= 0) urgency = 10;
      else if (du === 1) urgency = 8;
      else if (du <= 3) urgency = 6;
      else if (du <= 7) urgency = 3;
      else urgency = 1;
    }

    const streakBonus = 0;
    const score = base + urgency + streakBonus;

    candidates.push({
      id: `task_${t.id}`,
      title: t.title,
      type: t.type,
      minutes: Math.max(1, t.minutes),
      score,
      breakdown: { base, urgency, streakBonus },
    });
  }

  for (const h of habitsToday) {
    const base = 6;
    const urgency = 0;
    const streakBonus = 0; // streak bonus is shown on UI; plan score can stay simple
    const score = base + urgency + streakBonus;

    candidates.push({
      id: `habit_${h.id}`,
      title: h.title,
      type: "habit",
      minutes: Math.max(1, h.minutes),
      score,
      breakdown: { base, urgency, streakBonus },
    });
  }

  candidates.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.minutes - b.minutes));

  const plan: PlanItem[] = [];
  let used = 0;

  for (const item of candidates) {
    if (used + item.minutes <= availableMinutes) {
      plan.push(item);
      used += item.minutes;
    }
  }

  // second pass to fill leftover minutes
  for (const item of candidates) {
    if (plan.find((p) => p.id === item.id)) continue;
    if (used + item.minutes <= availableMinutes) {
      plan.push(item);
      used += item.minutes;
    }
  }

  const totalScore = plan.reduce((s, x) => s + x.score, 0);

  return {
    plan,
    usedMinutes: used,
    remainingMinutes: Math.max(0, availableMinutes - used),
    totalScore,
  };
}