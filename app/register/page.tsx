"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ---------- UI ---------- */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute top-40 -right-24 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.4)] p-8">
        {children}
      </div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
    />
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function createAccount() {
    setErr("");
    setOk("");

    if (password.length < 6)
      return setErr("Password must be at least 6 characters.");
    if (password !== confirm)
      return setErr("Passwords do not match.");

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) return setErr(error.message);

    setOk("Account created successfully.");

    // если email confirmation выключен — можно сразу в dashboard
    router.replace("/dashboard");
  }

  return (
    <Shell>
      <div className="text-center mb-6">
        <div className="text-3xl font-black tracking-tight bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">
          TEREX AI
        </div>
        <div className="text-sm text-white/60 mt-2">
          Register — create your account
        </div>
      </div>

      <div className="space-y-4">
        <Input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Input
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        {err && <div className="text-sm text-rose-300">{err}</div>}
        {ok && <div className="text-sm text-emerald-300">{ok}</div>}

        <button
          onClick={createAccount}
          disabled={loading}
          className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 py-3 font-bold text-slate-950 shadow-[0_20px_60px_rgba(34,211,238,0.15)] hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <div className="text-sm text-white/60 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-cyan-300 hover:underline">
            Log In
          </Link>
        </div>
      </div>
    </Shell>
  );
}