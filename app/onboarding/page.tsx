"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { DayKey, DAY_LABEL } from "@/lib/date";

type Habit = { id: string; title: string; minutes: number; days: DayKey[] };

/** ---------- Premium UI ---------- */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute top-40 -right-24 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.08),transparent_40%),radial_gradient(circle_at_80%_20%,rgba(99,102,241,0.10),transparent_45%),radial-gradient(circle_at_50%_90%,rgba(236,72,153,0.08),transparent_45%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">{children}</div>
    </div>
  );
}

function Card({ title, right, children }: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
          <div className="font-bold tracking-tight">{title}</div>
          {right}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase text-white/50 font-bold mb-1">{children}</div>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 " +
        (props.className ?? "")
      }
    />
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        "w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 py-3 font-bold text-slate-950 shadow-[0_20px_60px_rgba(34,211,238,0.15)] active:scale-[0.99] disabled:opacity-60 " +
        (props.className ?? "")
      }
    />
  );
}

function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        "rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm hover:bg-white/[0.06] active:scale-[0.99] " +
        (props.className ?? "")
      }
    />
  );
}

function Chip({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        "px-3 py-2 rounded-2xl border text-xs font-bold active:scale-[0.99] " +
        (active
          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
          : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.07]")
      }
    >
      {children}
    </button>
  );
}

/** ---------- Page ---------- */
export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(15);
  const [days, setDays] = useState<Record<DayKey, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: false,
    7: false,
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return router.replace("/login");
      setUserId(data.user.id);

      const { data: h, error } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: false });

      if (error) return alert(error.message);
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
        days: selectedDays, // keep your existing DB format
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
    if (habits.length === 0) {
      alert("Add at least one habit.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
            <div className="h-3 w-3 rounded-full bg-cyan-400" />
            <div className="text-sm font-extrabold tracking-tight">TEREX AI</div>
          </div>

          <div className="mt-4 text-3xl font-black tracking-tight bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">
            Habit setup
          </div>
          <div className="mt-2 text-sm text-white/60">
            One-time configuration. You can edit later from Dashboard.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <GhostButton onClick={() => router.replace("/dashboard")}>Skip</GhostButton>
          <button
            onClick={finish}
            className="rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 py-2 font-bold text-slate-950 shadow-[0_20px_60px_rgba(34,211,238,0.15)] active:scale-[0.99]"
          >
            Continue →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Add habit */}
        <div className="lg:col-span-5">
          <Card title="Add habit" right={<div className="text-xs text-white/60">{selectedDays.length} days selected</div>}>
            <div className="space-y-4">
              <div>
                <Label>Habit title</Label>
                <Input
                  placeholder="e.g. German practice"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addHabit();
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Minutes per day</Label>
                  <Input
                    type="number"
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <Label>Days</Label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(DAY_LABEL) as unknown as DayKey[]).map((d) => (
                      <Chip key={d} active={days[d]} onClick={() => setDays((p) => ({ ...p, [d]: !p[d] }))}>
                        {DAY_LABEL[d]}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>

              <PrimaryButton onClick={addHabit} disabled={!title.trim() || selectedDays.length === 0}>
                Add habit
              </PrimaryButton>

              <div className="text-xs text-white/50">
                Tip: select exact weekdays (Mon/Wed/Fri etc.). Dashboard will show only habits for that day.
              </div>
            </div>
          </Card>
        </div>

        {/* Right: List */}
        <div className="lg:col-span-7">
          <Card title="Your habits" right={<div className="text-xs text-white/60">{habits.length} total</div>}>
            <div className="space-y-2">
              {habits.length === 0 ? (
                <div className="text-white/60">No habits yet. Add your first habit on the left.</div>
              ) : (
                habits.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <div>
                      <div className="font-bold">{h.title}</div>
                      <div className="text-xs text-white/60">
                        {h.minutes}m • {h.days.map((d) => DAY_LABEL[d]).join(", ")}
                      </div>
                    </div>

                    <button
                      onClick={() => removeHabit(h.id)}
                      className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/20 active:scale-[0.99]"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 text-xs text-white/50">
              On Dashboard you’ll see{" "}
              <span className="text-cyan-200 font-bold">“wanna change your habits? click here”</span> to return here.
            </div>

            <div className="mt-3 text-xs text-white/50">
              Need to log out?{" "}
              <Link className="text-cyan-300 hover:underline" href="/dashboard">
                go back to dashboard
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}