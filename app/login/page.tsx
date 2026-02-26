"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function signIn() {
    setErr("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) return setErr(error.message);
    router.replace("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <div className="text-2xl font-black tracking-tight mb-1">TEREX AI</div>
        <div className="text-sm text-white/60 mb-6">Sign in</div>

        <div className="space-y-3">
          <input
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm outline-none focus:border-cyan-500/50"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm outline-none focus:border-cyan-500/50"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {err && <div className="text-sm text-rose-300">{err}</div>}

          <button
            onClick={signIn}
            disabled={loading}
            className="w-full rounded-xl bg-cyan-500 py-2 font-bold text-slate-900 hover:bg-cyan-400 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="text-sm text-white/60">
            Don’t have an account?{" "}
            <a className="text-cyan-300 hover:underline" href="/register">
              Sign up
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}