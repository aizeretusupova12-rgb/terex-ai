"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/** =========================
 *  Date helpers (no hydration bugs)
 *  ========================= */
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function fromISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeekMonday(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const js = d.getDay(); // 0 Sun..6 Sat
  const diff = js === 0 ? -6 : 1 - js; // back/forward to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

function parseHHMM(s: string) {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return { hh: Number.isFinite(h) ? h : 19, mm: Number.isFinite(m) ? m : 0 };
}

function fmtTimeFromMinutes(totalMin: number) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function daysUntil(deadlineISO: string, fromISO: string) {
  const a = fromISODate(fromISO).getTime();
  const b = fromISODate(deadlineISO).getTime();
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Supabase days format in your DB:
 * days = ["1","2","3","4","5","6","7"] where
 * 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
 *
 * JS getDay(): 0=Sun, 1=Mon ... 6=Sat
 */
function isoToDbDayKey(iso: string) {
  const js = new Date(iso + "T00:00:00").getDay(); // 0..6
  return js === 0 ? "7" : String(js); // "1".."7"
}

const DAY_LABEL_DB: Record<string, string> = {
  "1": "Mon",
  "2": "Tue",
  "3": "Wed",
  "4": "Thu",
  "5": "Fri",
  "6": "Sat",
  "7": "Sun",
};

/** =========================
 *  Types
 *  ========================= */
type Habit = {
  id: string;
  title: string;
  minutes: number;
  days: string[]; // text[] from DB like ["1","2","3"]
};

type Completion = { habit_id: string; day: string }; // day is YYYY-MM-DD
type Task = {
  id: string;
  title: string;
  type: "deadline" | "study";
  minutes: number;
  priority: number; // 1..10
  deadline: string | null; // YYYY-MM-DD
  for_day: string; // YYYY-MM-DD
};

type PlanItem = {
  id: string;
  title: string;
  type: "habit" | "deadline" | "study";
  minutes: number;
  score: number;
  breakdown: { base: number; urgency: number; streakBonus: number };
};

/** =========================
 *  UI tiny components
 *  ========================= */
function Card(props: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
      {(props.title || props.right) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="font-bold">{props.title}</div>
          {props.right}
        </div>
      )}
      <div className="p-5">{props.children}</div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  /** ---------- Safe today (client only) ---------- */
  const [todayISO, setTodayISO] = useState("");
  useEffect(() => setTodayISO(toISODateLocal(new Date())), []);

  /** ---------- Auth ---------- */
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  /** ---------- Data ---------- */
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  /** ---------- Planner controls ---------- */
  const [selectedDayISO, setSelectedDayISO] = useState("");
  const [availableMinutes, setAvailableMinutes] = useState(180);
  const [startTime, setStartTime] = useState("19:00");
  const [breakMinutes, setBreakMinutes] = useState(5);

  /** ---------- Week selector ---------- */
  const [weekOffset, setWeekOffset] = useState(0);

  /** ---------- Task form ---------- */
  const [tTitle, setTTitle] = useState("");
  const [tType, setTType] = useState<"study" | "deadline">("study");
  const [tMinutes, setTMinutes] = useState(30);
  const [tPriority, setTPriority] = useState(6);
  const [tDeadline, setTDeadline] = useState("");

  /** ---------- Pomodoro ---------- */
  const [pomMode, setPomMode] = useState<"25_5" | "task">("25_5");
  const [isRunning, setIsRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const tickRef = useRef<number | null>(null);

  /** ---------- Selected plan item ---------- */
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  /** =========================
   *  Load user
   *  ========================= */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      setEmail(data.user.email ?? "");
    })();
  }, [router]);

  useEffect(() => {
    if (todayISO && !selectedDayISO) setSelectedDayISO(todayISO);
  }, [todayISO, selectedDayISO]);

  /** =========================
   *  Fetch habits + completions
   *  ========================= */
  useEffect(() => {
    if (!userId) return;

    (async () => {
      const { data: h, error: hErr } = await supabase
        .from("habits")
        .select("id,title,minutes,days")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (hErr) return alert(hErr.message);
      setHabits((h as any) ?? []);

      const { data: c, error: cErr } = await supabase
        .from("habit_completions")
        .select("habit_id,day")
        .eq("user_id", userId);

      if (cErr) return alert(cErr.message);
      // supabase returns day as "YYYY-MM-DD"
      setCompletions((c as any) ?? []);
    })();
  }, [userId]);

  /** =========================
   *  Fetch tasks for selected day
   *  ========================= */
  useEffect(() => {
    if (!userId || !selectedDayISO) return;
    (async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,type,minutes,priority,deadline,for_day")
        .eq("user_id", userId)
        .eq("for_day", selectedDayISO)
        .order("created_at", { ascending: false });

      if (error) return alert(error.message);
      setTasks((data as any) ?? []);
    })();
  }, [userId, selectedDayISO]);

  /** =========================
   *  Weekly dates
   *  ========================= */
  const weekStart = useMemo(() => {
    if (!todayISO) return startOfWeekMonday(new Date());
    const base = startOfWeekMonday(fromISODate(todayISO));
    return addDays(base, weekOffset * 7);
  }, [todayISO, weekOffset]);

  const weekDates = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart]);
  const weekISOs = useMemo(() => weekDates.map(toISODateLocal), [weekDates]);

  /** =========================
   *  Completion map: habitId -> Set(YYYY-MM-DD)
   *  ========================= */
  const completionMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const c of completions) {
      if (!map[c.habit_id]) map[c.habit_id] = new Set<string>();
      map[c.habit_id].add(c.day);
    }
    return map;
  }, [completions]);

  /** =========================
   *  Habits for selected day (FIXED for your DB format)
   *  ========================= */
  const selectedDayKey = useMemo(() => {
    if (!selectedDayISO) return "1";
    return isoToDbDayKey(selectedDayISO); // "1".."7"
  }, [selectedDayISO]);

  const habitsToday = useMemo(() => {
    return habits.filter((h) => (h.days ?? []).map(String).includes(selectedDayKey));
  }, [habits, selectedDayKey]);

  /** =========================
   *  Streak (consecutive scheduled days completed)
   *  ========================= */
  function streakForHabit(h: Habit) {
    if (!todayISO) return 0;
    const set = completionMap[h.id] || new Set<string>();
    let streak = 0;

    let cursor = fromISODate(todayISO);
    for (let i = 0; i < 90; i++) {
      const iso = toISODateLocal(cursor);
      const key = isoToDbDayKey(iso); // "1".."7"
      const scheduled = (h.days ?? []).includes(key);

      if (!scheduled) {
        cursor = addDays(cursor, -1);
        continue;
      }
      if (!set.has(iso)) break;

      streak += 1;
      cursor = addDays(cursor, -1);
    }

    return streak;
  }

  /** =========================
   *  Score (week completions + streak bonuses)
   *  ========================= */
  const score = useMemo(() => {
    let s = 0;
    for (const h of habits) {
      const set = completionMap[h.id] || new Set<string>();
      for (const iso of weekISOs) if (set.has(iso)) s += 1;
      if (todayISO && streakForHabit(h) >= 3) s += 2;
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits, completionMap, weekISOs, todayISO]);

  /** =========================
   *  Toggle completion
   *  ========================= */
  async function toggleComplete(habitId: string, isoDay: string) {
    if (!userId) return;

    const set = completionMap[habitId] || new Set<string>();
    const done = set.has(isoDay);

    if (!done) {
      const { data, error } = await supabase
        .from("habit_completions")
        .insert({ user_id: userId, habit_id: habitId, day: isoDay })
        .select("habit_id,day")
        .single();

      if (error) return alert(error.message);
      setCompletions((p) => [...p, data as any]);
    } else {
      const { error } = await supabase
        .from("habit_completions")
        .delete()
        .eq("user_id", userId)
        .eq("habit_id", habitId)
        .eq("day", isoDay);

      if (error) return alert(error.message);
      setCompletions((p) => p.filter((c) => !(c.habit_id === habitId && c.day === isoDay)));
    }
  }

  /** =========================
   *  Tasks add / delete
   *  ========================= */
  async function addTask() {
    if (!userId) return;
    const title = tTitle.trim();
    if (!title) return;

    const payload = {
      user_id: userId,
      title,
      type: tType,
      minutes: Math.max(1, Number(tMinutes) || 30),
      priority: Math.min(10, Math.max(1, Number(tPriority) || 5)),
      deadline: tType === "deadline" ? (tDeadline || selectedDayISO) : null,
      for_day: selectedDayISO,
    };

    const { data, error } = await supabase.from("tasks").insert(payload).select("*").single();
    if (error) return alert(error.message);

    setTasks((p) => [data as any, ...p]);
    setTTitle("");
    setTMinutes(30);
  }

  async function removeTask(id: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return alert(error.message);
    setTasks((p) => p.filter((t) => t.id !== id));
  }

  /** =========================
   *  Plan generation (simple + stable)
   *  ========================= */
  const planResult = useMemo(() => {
    if (!todayISO || !selectedDayISO) return null;

    const candidates: PlanItem[] = [];

    // tasks
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

    // habits for that day
    for (const h of habitsToday) {
      const base = 6;
      const urgency = 0;
      const streakBonus = streakForHabit(h) >= 3 ? 2 : 0;
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
    for (const item of candidates) {
      if (plan.find((p) => p.id === item.id)) continue;
      if (used + item.minutes <= availableMinutes) {
        plan.push(item);
        used += item.minutes;
      }
    }

    return {
      plan,
      usedMinutes: used,
      remainingMinutes: Math.max(0, availableMinutes - used),
      totalScore: plan.reduce((s, x) => s + x.score, 0),
    };
  }, [todayISO, selectedDayISO, tasks, habitsToday, availableMinutes]); // habitsToday now stable

  useEffect(() => {
    if (planResult?.plan?.[0]?.id) setSelectedPlanId(planResult.plan[0].id);
  }, [planResult?.plan]);

  const selectedPlanItem = useMemo(() => {
    if (!planResult || !selectedPlanId) return null;
    return planResult.plan.find((p) => p.id === selectedPlanId) || null;
  }, [planResult, selectedPlanId]);

  /** =========================
   *  Calendar slots
   *  ========================= */
  const calendar = useMemo(() => {
    if (!planResult) return [];
    const { hh, mm } = parseHHMM(startTime);
    let cursor = hh * 60 + mm;

    const out: Array<{ start: string; end: string; title: string; minutes: number; isBreak?: boolean }> = [];

    planResult.plan.forEach((item, idx) => {
      const s = fmtTimeFromMinutes(cursor);
      cursor += item.minutes;
      const e = fmtTimeFromMinutes(cursor);
      out.push({ start: s, end: e, title: item.title, minutes: item.minutes });

      if (breakMinutes > 0 && idx !== planResult.plan.length - 1) {
        const bs = fmtTimeFromMinutes(cursor);
        cursor += breakMinutes;
        const be = fmtTimeFromMinutes(cursor);
        out.push({ start: bs, end: be, title: "Break", minutes: breakMinutes, isBreak: true });
      }
    });

    return out;
  }, [planResult, startTime, breakMinutes]);

  /** =========================
   *  Pomodoro timer
   *  ========================= */
  useEffect(() => {
    if (isRunning) return;

    if (pomMode === "25_5") setSecondsLeft(25 * 60);
    else setSecondsLeft(Math.max(60, (selectedPlanItem?.minutes ?? 25) * 60));
  }, [pomMode, selectedPlanItem?.minutes, isRunning]);

  useEffect(() => {
    if (!isRunning) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }

    tickRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setIsRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [isRunning]);

  const pomMM = Math.floor(secondsLeft / 60);
  const pomSS = secondsLeft % 60;

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!todayISO || !userId || !selectedDayISO) {
    return <div className="min-h-screen p-8 text-white/70">Loading...</div>;
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-black">Let’s plan your day</div>
            <div className="text-sm text-white/60">{email}</div>
            <div className="mt-2">
              <Link href="/onboarding" className="text-cyan-300 text-xs hover:underline">
                wanna change your habits? click here →
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-xs">
              Score: <span className="font-bold text-cyan-300">{score}</span>
            </div>
            <button
              onClick={logout}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm hover:bg-white/[0.06]"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Week controls + day pills */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2">
            <button onClick={() => setWeekOffset((p) => p - 1)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.06]">
              ← Prev
            </button>
            <button onClick={() => setWeekOffset(0)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.06]">
              This week
            </button>
            <button onClick={() => setWeekOffset((p) => p + 1)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.06]">
              Next →
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {weekDates.map((d) => {
              const iso = toISODateLocal(d);
              const key = isoToDbDayKey(iso);
              const active = iso === selectedDayISO;
              return (
                <button
                  key={iso}
                  onClick={() => setSelectedDayISO(iso)}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    active ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/80"
                  }`}
                >
                  <div className="font-bold">{DAY_LABEL_DB[key]}</div>
                  <div className="text-[10px] text-white/60">{iso.slice(5)}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT */}
          <div className="lg:col-span-5 space-y-6">
            <Card title="Today settings">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] uppercase text-white/50 font-bold mb-1">Minutes today</div>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                    value={availableMinutes}
                    onChange={(e) => setAvailableMinutes(Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <div className="text-[10px] uppercase text-white/50 font-bold mb-1">Start time</div>
                  <input
                    type="time"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-[10px] uppercase text-white/50 font-bold mb-1">Break (min)</div>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
            </Card>

            <Card
              title="Your habits for this day"
              right={<div className="text-xs text-white/60">{habitsToday.length} items</div>}
            >
              <div className="space-y-2">
                {habitsToday.length === 0 ? (
                  <div className="text-white/60 text-sm">
                    No habits scheduled for this day. <span className="text-white/40">(dayKey={selectedDayKey})</span>
                  </div>
                ) : (
                  habitsToday.map((h) => {
                    const set = completionMap[h.id] || new Set<string>();
                    const done = set.has(selectedDayISO);
                    const streak = streakForHabit(h);
                    const bonus = streak >= 3 ? " (+bonus)" : "";

                    return (
                      <div key={h.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                        <div>
                          <div className="font-bold">{h.title}</div>
                          <div className="text-xs text-white/60">
                            {h.minutes}m • streak:{" "}
                            <span className={streak >= 3 ? "text-emerald-300 font-bold" : ""}>{streak}</span>
                            {bonus}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleComplete(h.id, selectedDayISO)}
                          className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                            done ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/80"
                          }`}
                        >
                          {done ? "Done ✓" : "Mark"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            <Card title="Add task (deadline / study)">
              <div className="space-y-3">
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm outline-none focus:border-cyan-500/50"
                  placeholder="Task title..."
                  value={tTitle}
                  onChange={(e) => setTTitle(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase text-white/50 font-bold mb-1">Type</div>
                    <select
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm outline-none"
                      value={tType}
                      onChange={(e) => setTType(e.target.value as any)}
                    >
                      <option value="study">Study</option>
                      <option value="deadline">Deadline</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-white/50 font-bold mb-1">Minutes</div>
                    <input
                      type="number"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm outline-none"
                      value={tMinutes}
                      onChange={(e) => setTMinutes(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase text-white/50 font-bold mb-1">Priority (1-10)</div>
                    <input
                      type="number"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm outline-none"
                      value={tPriority}
                      onChange={(e) => setTPriority(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-white/50 font-bold mb-1">Deadline date</div>
                    <input
                      type="date"
                      disabled={tType !== "deadline"}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm outline-none disabled:opacity-40"
                      value={tDeadline}
                      onChange={(e) => setTDeadline(e.target.value)}
                    />
                  </div>
                </div>

                <button onClick={addTask} className="w-full rounded-xl bg-cyan-500 py-2 font-bold text-slate-900 hover:bg-cyan-400">
                  Add task
                </button>

                <div className="mt-3 space-y-2">
                  {tasks.length === 0 ? (
                    <div className="text-white/60 text-sm">No tasks for this day yet.</div>
                  ) : (
                    tasks.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                        <div>
                          <div className="font-bold">{t.title}</div>
                          <div className="text-xs text-white/60">
                            {t.minutes}m • priority {t.priority}{" "}
                            {t.type === "deadline" && t.deadline ? `• deadline ${t.deadline}` : ""}
                          </div>
                        </div>
                        <button
                          onClick={() => removeTask(t.id)}
                          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/20"
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-7 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase text-white/50 font-bold">Used</div>
                <div className="text-2xl font-black">{planResult?.usedMinutes ?? 0}m</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase text-white/50 font-bold">Remaining</div>
                <div className="text-2xl font-black">{planResult?.remainingMinutes ?? availableMinutes}m</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase text-white/50 font-bold">Items</div>
                <div className="text-2xl font-black">{planResult?.plan.length ?? 0}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase text-white/50 font-bold">Optimization</div>
                <div className="text-2xl font-black text-cyan-300">{planResult?.totalScore?.toFixed(0) ?? "0"}</div>
              </div>
            </div>

            <Card title="Optimized plan">
              {!planResult || planResult.plan.length === 0 ? (
                <div className="text-white/60 text-sm">Add tasks or habits — plan will appear here.</div>
              ) : (
                <div className="space-y-2">
                  {planResult.plan.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`w-full text-left rounded-xl border px-4 py-3 ${
                        selectedPlanId === p.id
                          ? "border-cyan-500/30 bg-cyan-500/10"
                          : "border-white/10 bg-black/20 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold">{p.title}</div>
                          <div className="text-xs text-white/60">{p.minutes}m • {p.type}</div>
                        </div>
                        <div className="text-xs font-bold text-cyan-300">score {p.score.toFixed(0)}</div>
                      </div>
                      <div className="mt-2 flex gap-2 text-[10px] text-white/60">
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5">base {p.breakdown.base}</span>
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5">urg {p.breakdown.urgency}</span>
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5">streak +{p.breakdown.streakBonus}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-bold mb-2">Calendar</div>
                {calendar.length === 0 ? (
                  <div className="text-white/60 text-sm">No schedule yet.</div>
                ) : (
                  <div className="space-y-2">
                    {calendar.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="text-white/70 font-mono">
                          {c.start}–{c.end}
                        </div>
                        <div className={c.isBreak ? "text-white/50" : "font-semibold"}>{c.title}</div>
                        <div className="text-white/50">{c.minutes}m</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card title="Pomodoro" right={<div className="text-xs text-white/60">Selected: {selectedPlanItem?.title ?? "none"}</div>}>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setPomMode("25_5")}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    pomMode === "25_5" ? "border-cyan-500/30 bg-cyan-500/10" : "border-white/10 bg-black/20 hover:bg-white/[0.05]"
                  }`}
                >
                  25 / 5
                </button>
                <button
                  onClick={() => setPomMode("task")}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    pomMode === "task" ? "border-cyan-500/30 bg-cyan-500/10" : "border-white/10 bg-black/20 hover:bg-white/[0.05]"
                  }`}
                >
                  Use selected task minutes
                </button>
              </div>

              <div className="text-5xl font-black tracking-tight mb-4">
                {pad2(Math.floor(secondsLeft / 60))}:{pad2(secondsLeft % 60)}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsRunning((p) => !p)}
                  className="rounded-xl bg-cyan-500 px-4 py-2 font-bold text-slate-900 hover:bg-cyan-400"
                >
                  {isRunning ? "Pause" : "Start"}
                </button>

                <button
                  onClick={() => {
                    setIsRunning(false);
                    setSecondsLeft(pomMode === "25_5" ? 25 * 60 : Math.max(60, (selectedPlanItem?.minutes ?? 25) * 60));
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm hover:bg-white/[0.06]"
                >
                  Reset
                </button>
              </div>
            </Card>

            <Card title="Weekly grid (Mon–Sun)" right={<div className="text-xs text-white/60">click to toggle</div>}>
              <div className="overflow-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-8 gap-2 mb-2">
                    <div className="text-xs text-white/60 font-bold px-2">Habit</div>
                    {weekDates.map((d) => {
                      const iso = toISODateLocal(d);
                      const key = isoToDbDayKey(iso);
                      const active = iso === selectedDayISO;
                      return (
                        <div key={iso} className={`rounded-xl border px-2 py-2 text-xs font-bold ${active ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200" : "border-white/10 bg-black/20 text-white/80"}`}>
                          <div>{DAY_LABEL_DB[key]}</div>
                          <div className="text-[10px] text-white/60">{iso.slice(5)}</div>
                        </div>
                      );
                    })}
                  </div>

                  {habits.length === 0 ? (
                    <div className="text-white/60 text-sm">
                      No habits. Go to <Link className="text-cyan-300 underline" href="/onboarding">onboarding</Link>.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {habits.map((h) => {
                        const set = completionMap[h.id] || new Set<string>();
                        const st = streakForHabit(h);
                        return (
                          <div key={h.id} className="grid grid-cols-8 gap-2 items-center">
                            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                              <div className="font-bold">{h.title}</div>
                              <div className="text-[10px] text-white/60">
                                {h.minutes}m • days {(h.days ?? []).join(",")} • streak {st}{st >= 3 ? " (+bonus)" : ""}
                              </div>
                            </div>

                            {weekDates.map((d) => {
                              const iso = toISODateLocal(d);
                              const key = isoToDbDayKey(iso);
                              const scheduled = (h.days ?? []).includes(key);
                              const done = set.has(iso);

                              return (
                                <button
                                  key={h.id + iso}
                                  onClick={() => toggleComplete(h.id, iso)}
                                  className={`rounded-xl border px-2 py-3 text-xs font-black ${
                                    !scheduled
                                      ? "border-white/5 bg-white/[0.02] text-white/25"
                                      : done
                                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                                      : "border-white/10 bg-black/20 hover:bg-white/[0.05] text-white/70"
                                  }`}
                                  title={scheduled ? "toggle" : "not scheduled"}
                                >
                                  {!scheduled ? "·" : done ? "✓" : "—"}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}