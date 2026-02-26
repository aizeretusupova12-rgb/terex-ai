"use client";

import React, { useState } from "react";
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
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={
        "w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none " +
        "focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 " +
        className
      }
    />
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string>("");
  const [err, setErr] = useState<string>("");

  async function logIn() {
    setErr("");
    setInfo("");

    if (!email || !password) {
      setErr("Enter email and password.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    router.replace("/dashboard");
  }

  async function forgotPassword() {
    setErr("");
    setInfo("");

    if (!email) {
      setErr("Enter your email first.");
      return;
    }

    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      setErr(error.message);
      return;
    }

    setInfo("Check your email — password reset link sent.");
  }

  return (
    <Shell>
      <div className="text-center mb-6">
        <div className="text-3xl font-black tracking-tight bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">
          TEREX AI
        </div>
        <div className="text-sm text-white/60 mt-2">Log In — access your account</div>
      </div>

      <div className="space-y-4">
        <Input
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {err && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {err}
          </div>
        )}

        {info && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {info}
          </div>
        )}

        <button
          onClick={logIn}
          disabled={loading}
          className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 py-3 font-bold text-slate-950 shadow-[0_20px_60px_rgba(34,211,238,0.15)] hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Log In"}
        </button>

        <button
          type="button"
          onClick={forgotPassword}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 text-sm font-semibold text-white/80 hover:bg-white/[0.06]"
        >
          Forgot password?
        </button>

        <div className="text-sm text-white/60 text-center">
          Don’t have an account?{" "}
          <Link href="/register" className="text-cyan-300 hover:underline">
            Register
          </Link>
        </div>
      </div>
    </Shell>
  );
}