"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    // If user opened this page with a valid recovery session, Supabase will set it automatically.
    // We just mark UI as ready.
    setReady(true);
  }, []);

  async function updatePassword() {
    setErr("");
    setOk("");

    if (password.length < 6) return setErr("Password must be at least 6 characters.");
    if (password !== confirm) return setErr("Passwords do not match.");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) return setErr(error.message);

    setOk("Password updated. Redirecting to dashboard...");
    setTimeout(() => router.replace("/dashboard"), 900);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <div className="text-2xl font-black tracking-tight mb-1">TEREX AI</div>
        <div className="text-sm text-white/60 mb-6">Reset password</div>

        {!ready ? (
          <div className="text-white/60 text-sm">Loading…</div>
        ) : (
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm outline-none focus:border-cyan-500/50"
              placeholder="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm outline-none focus:border-cyan-500/50"
              placeholder="Confirm new password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />

            {err && <div className="text-sm text-rose-300">{err}</div>}
            {ok && <div className="text-sm text-emerald-300">{ok}</div>}

            <button
              onClick={updatePassword}
              disabled={loading}
              className="w-full rounded-xl bg-cyan-500 py-2 font-bold text-slate-900 hover:bg-cyan-400 disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update password"}
            </button>

            <div className="text-sm text-white/60">
              Back to{" "}
              <a className="text-cyan-300 hover:underline" href="/login">
                Sign in
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}