import { readFile } from "node:fs/promises";

const baseUrl = process.env.CHAPLIN_BASE_URL ?? "http://127.0.0.1:3000";

function parseEnv(source) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return [];
    const separator = line.indexOf("=");
    if (separator < 1) return [];
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return [[line.slice(0, separator).trim(), value]];
  }));
}

async function api(path, options) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    signal: AbortSignal.timeout(60_000),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const fileEnv = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8"));
  const env = { ...fileEnv, ...process.env };
  assert(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY, "Supabase cleanup credentials are missing.");

  let runId = null;
  const idempotencyKey = `verification:${crypto.randomUUID()}`;
  try {
    const created = await api("/api/pipeline", {
      method: "POST",
      body: JSON.stringify({
        scopeType: "actor",
        scopeId: "c-selene",
        outputType: "spark",
        spec: { verification: true, paidGeneration: false },
        idempotencyKey,
      }),
    });
    assert(created.response.status === 201 && created.payload.run?.id, `Create run failed with HTTP ${created.response.status}.`);
    runId = created.payload.run.id;
    assert(created.payload.run.steps[0]?.status === "ready", "The first pipeline step was not ready.");
    assert(created.payload.run.steps.slice(1).every((step) => step.status === "blocked"), "Downstream steps were not blocked.");

    const duplicate = await api("/api/pipeline", {
      method: "POST",
      body: JSON.stringify({
        scopeType: "actor",
        scopeId: "c-selene",
        outputType: "spark",
        spec: { verification: true, paidGeneration: false },
        idempotencyKey,
      }),
    });
    assert(duplicate.response.status === 201 && duplicate.payload.run?.id === runId, "Pipeline idempotency returned a different run.");

    let state = created.payload.run;
    for (const action of ["queue", "start", "complete"]) {
      const transition = await api(`/api/pipeline/${runId}`, {
        method: "PATCH",
        body: JSON.stringify({
          stepKey: "plan-lock",
          action,
          output: action === "complete" ? { verifiedAt: new Date().toISOString() } : undefined,
        }),
      });
      assert(transition.response.ok, `${action} transition failed with HTTP ${transition.response.status}.`);
      state = transition.payload.run;
    }
    assert(state.steps.find((step) => step.key === "plan-lock")?.status === "succeeded", "Plan lock did not succeed.");
    assert(state.steps.find((step) => step.key === "reference-frame")?.status === "ready", "Reference frame did not unlock.");

    const invalid = await api(`/api/pipeline/${runId}`, {
      method: "PATCH",
      body: JSON.stringify({ stepKey: "reference-frame", action: "complete" }),
    });
    assert(invalid.response.status === 400, "An invalid ready-to-complete transition was accepted.");

    const loaded = await api(`/api/pipeline/${runId}`, { method: "GET" });
    assert(loaded.response.ok && loaded.payload.run?.id === runId, "The persisted pipeline could not be reloaded.");

    console.table([
      { check: "Create ordered run", passed: true, detail: `${state.steps.length} stages` },
      { check: "Idempotent creation", passed: true, detail: runId },
      { check: "Queue → running → succeeded", passed: true, detail: "plan-lock" },
      { check: "Unlock next stage", passed: true, detail: "reference-frame ready" },
      { check: "Reject invalid transition", passed: true, detail: "HTTP 400" },
      { check: "Reload persisted state", passed: true, detail: state.status },
    ]);
    console.log("Pipeline orchestration state machine verified without starting a paid provider job.");
  } finally {
    if (runId) {
      const cleanup = await fetch(`${env.SUPABASE_URL}/rest/v1/media_pipeline_runs?id=eq.${encodeURIComponent(runId)}`, {
        method: "DELETE",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: "return=minimal",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!cleanup.ok) throw new Error(`Verification cleanup failed with HTTP ${cleanup.status}.`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
