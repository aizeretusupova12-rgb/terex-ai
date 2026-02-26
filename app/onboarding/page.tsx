"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DayKey, DAY_LABEL } from "@/lib/date";

type Habit = { id: string; title: string; minutes: number; days: DayKey[] };

export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(15);
  const [days, setDays] = useState<Record<DayKey, boolean>>({
    1: true, 2: true, 3: true, 4: true, 5: true, 6: false, 7: false
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return router.replace("/login");
      setUserId(data.user.id);

      const { data: h } = await supabase.from("habits").select("*").eq("user_id", data.user.id).order("created_at", { ascending: false });
      setHabits((h as any) ?? []);
    })();
  }, [router]);

  const selectedDays = useMemo(() => {
    return (Object.keys(days) as unknown as DayKey[]).filter((k) => days[k]);
  }, [days]);

  async function addHabit() {
    if (!userId) return;
    if (!title.trim()) return;
    if (selectedDays.length === 0) return;

    const { data, error } = await supabase
      .from("habits")
      .insert({
        user_id: userId,
        title: title.trim(),
        minutes: Math.max(1, Number(minutes) || 15),
        days: selectedDays,
      })
      .select("*")
      .single();

    if (error) return alert(error.message);

    setHabits((p) => [data as any, ...p]);
    setTitle("");
    setMinutes(15);
  }

  async function removeHabit(id: string) {
    const ok = confirm("Delete habit?");
    if (!ok) return;

    const { error } = await supabase.from("habits").delete().eq("id", id);
    if (error) return alert(error.message);

    setHabits((p) => p.filter((h) => h.id !== id));
  }

  async function finish() {
    // if user has at least 1 habit -> go dashboard
    if (habits.length === 0) {
      alert("Add at least one habit.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-black">TEREX AI</div>
            <div className="text-sm text-white/60">Habit setup (one-time). You can edit later from dashboard.</div>
          </div>
          <button onClick={finish} className="rounded-xl bg-cyan-500 px-4 py-2 font-bold text-slate-900 hover:bg-cyan-400">
            Continue →
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-lg font-bold mb-4">Add habit</div>

            <div className="space-y-3">
              <input
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm outline-none focus:border-cyan-500/50"
                placeholder="e.g. German practice"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase text-white/50 font-bold mb-1">Minutes</div>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm outline-none"
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <div className="text-[10px] uppercase text-white/50 font-bold mb-1">Days</div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(DAY_LABEL) as unknown as DayKey[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDays((p) => ({ ...p, [d]: !p[d] }))}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${
                          days[d]
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                            : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.07]"
                        }`}
                      >
                        {DAY_LABEL[d]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={addHabit}
                className="w-full rounded-xl bg-cyan-500 py-2 font-bold text-slate-900 hover:bg-cyan-400"
              >
                Add habit
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-bold">Your habits</div>
              <div className="text-xs text-white/60">{habits.length} total</div>
            </div>

            <div className="space-y-2">
              {habits.length === 0 ? (
                <div className="text-white/60">No habits yet.</div>
              ) : (
                habits.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    <div>
                      <div className="font-bold">{h.title}</div>
                      <div className="text-xs text-white/60">
                        {h.minutes}m • {h.days.map((d) => DAY_LABEL[d]).join(", ")}
                      </div>
                    </div>
                    <button
                      onClick={() => removeHabit(h.id)}
                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/20"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 text-xs text-white/50">
              On dashboard you’ll see “wanna change your habits? click here” to return here.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}