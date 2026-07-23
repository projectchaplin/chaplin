"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getClientAuthIdentity } from "@/lib/client-auth";

function SuperAdminLoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("chaplin@chaplin.in");
  const [password, setPassword] = useState("chaplin");
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getClientAuthIdentity(true).then((identity) => {
      if (identity?.role === "admin") {
        window.location.replace("/admin");
        return;
      }
      setChecking(false);
    });
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "admin-login", email, password }),
      });
      const data = await response.json() as { error?: string; identity?: { role?: string } };
      if (!response.ok) throw new Error(data.error || "Super Admin sign-in failed.");
      if (data.identity?.role !== "admin") throw new Error("This account does not have Super Admin access.");
      const requestedDestination = searchParams.get("next");
      window.location.assign(requestedDestination?.startsWith("/admin") ? requestedDestination : "/admin");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Super Admin sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md flex-1 items-center px-5 py-10">
      <section className="w-full rounded-2xl border border-line bg-white/[0.045] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-accent">Chaplin operations</p>
        <h1 className="reel-title mt-3 text-4xl leading-none">Super Admin</h1>
        <p className="mt-3 text-sm leading-6 text-grey">Sign in to inspect generation logs, provider failures, assets, spend, and pipeline controls.</p>

        {checking ? (
          <p className="mt-8 text-sm text-grey">Checking your admin session…</p>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-grey">Admin email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required className="w-full rounded-lg border border-line bg-paper px-3.5 py-3 text-sm outline-none focus:border-accent" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-grey">Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="w-full rounded-lg border border-line bg-paper px-3.5 py-3 text-sm outline-none focus:border-accent" />
            </label>
            {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {busy ? "Opening operations…" : "Open Super Admin"}
            </button>
          </form>
        )}

        <Link href="/" className="mt-6 inline-block text-xs font-semibold text-grey hover:text-accent">← Back to Chaplin</Link>
      </section>
    </main>
  );
}

export default function SuperAdminLoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[60vh] items-center justify-center text-sm text-grey">Loading Super Admin…</main>}>
      <SuperAdminLoginForm />
    </Suspense>
  );
}
