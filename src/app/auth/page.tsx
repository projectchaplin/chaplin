"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

type Mode = "signup" | "login";

function AuthForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(searchParams.get("confirmed") ? "Email confirmed. Sign in to continue." : "");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, name, email, password }),
      });
      const data = await response.json() as { error?: string; requiresEmailConfirmation?: boolean; identity?: { role: string } };
      if (!response.ok) throw new Error(data.error || "Authentication failed.");
      if (data.requiresEmailConfirmation) {
        setMessage("Check your email to confirm the account, then return here to sign in.");
        setMode("login");
        return;
      }
      const requestedDestination = searchParams.get("next");
      const destination = requestedDestination?.startsWith("/") ? requestedDestination : data.identity?.role === "admin" ? "/admin" : "/feed";
      window.location.assign(destination);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-5 py-10 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="max-w-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-accent">Join Chaplin</p>
        <h1 className="reel-title mt-4 text-5xl leading-[0.95] sm:text-6xl">Create under your own name.</h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-grey">Every Chaplin account is a Creator account for now. Your actors, drafts, reels, ads, and micro dramas stay together in your Studio.</p>
        <Link href="/" className="mt-7 inline-block text-sm font-semibold text-accent hover:text-accent-light">← Explore the cast first</Link>
      </section>

      <section className="rounded-2xl border border-line bg-white/[0.045] p-5 shadow-2xl backdrop-blur-xl sm:p-7">
        <div className="grid grid-cols-2 rounded-full border border-line p-1">
          {(["signup", "login"] as Mode[]).map((option) => <button key={option} type="button" onClick={() => { setMode(option); setError(""); setMessage(""); }} className={`rounded-full px-4 py-2.5 text-sm font-semibold ${mode === option ? "bg-accent text-white" : "text-grey hover:text-ink"}`}>{option === "signup" ? "Create account" : "Sign in"}</button>)}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-5">
          {mode === "signup" && <div className="rounded-xl border border-accent/40 bg-accent/10 p-4">
            <span className="block text-sm font-semibold">Creator account</span>
            <span className="mt-1 block text-xs leading-5 text-grey">Your private drafts and published work will be attached to this login.</span>
          </div>}

          {mode === "signup" && <label className="block"><span className="mb-1.5 block text-xs font-semibold text-grey">Name or studio</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required className="w-full rounded-lg border border-line bg-paper px-3.5 py-3 text-sm outline-none focus:border-accent" /></label>}
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-grey">Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="w-full rounded-lg border border-line bg-paper px-3.5 py-3 text-sm outline-none focus:border-accent" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-grey">Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required className="w-full rounded-lg border border-line bg-paper px-3.5 py-3 text-sm outline-none focus:border-accent" /><span className="mt-1 block text-[10px] text-grey">Minimum 8 characters.</span></label>

          {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
          {message && <p className="rounded-lg border border-accent-secondary/40 bg-accent-secondary/10 px-3 py-2 text-xs text-accent-light">{message}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy ? "Please wait…" : mode === "signup" ? "Create creator account" : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[60vh] items-center justify-center text-sm text-grey">Loading account…</main>}>
      <AuthForm />
    </Suspense>
  );
}
