const baseUrl = process.env.CHAPLIN_BASE_URL ?? "http://127.0.0.1:3000";

function result(name, passed, detail) {
  return { name, passed: Boolean(passed), detail };
}

async function json(path, options) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    signal: AbortSignal.timeout(60_000),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function mediaCheck(name, value, expectedType) {
  if (typeof value !== "string" || !value) return result(name, false, "missing media URL");
  const url = new URL(value, baseUrl);
  const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30_000) });
  const contentType = response.headers.get("content-type") ?? "unknown";
  return result(name, response.ok && contentType.startsWith(expectedType), `${response.status} ${contentType}`);
}

function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") ?? ""];
  return values
    .map((value) => value.split(";", 1)[0])
    .filter(Boolean)
    .join("; ");
}

async function main() {
  const publicRoutes = ["/", "/characters", "/create", "/feed", "/studio", "/studio/write", "/studio/pipelines", "/auth"];
  const publicChecks = await Promise.all(publicRoutes.map(async (path) => {
    const response = await fetch(`${baseUrl}${path}`, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
    return result(`Page ${path}`, response.status === 200, `HTTP ${response.status}`);
  }));

  const login = await json("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "admin-login",
      email: process.env.SUPER_ADMIN_EMAIL ?? "chaplin@chaplin.in",
      password: process.env.SUPER_ADMIN_PASSWORD ?? "chaplin",
    }),
  });
  const cookies = cookieHeader(login.response);
  const accessToken = /(?:^|;\s*)chaplin-access-token=([^;]+)/.exec(cookies)?.[1];
  const adminChecks = [
    result(
      "Super Admin authentication",
      login.response.ok && login.payload.identity?.role === "admin" && Boolean(accessToken),
      login.response.ok ? login.payload.identity?.email ?? "admin session returned" : login.payload.error ?? `HTTP ${login.response.status}`,
    ),
  ];
  for (const path of ["/admin", "/admin/logs", "/admin/pipeline"]) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Cookie: cookies },
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
    });
    adminChecks.push(result(`Authenticated ${path}`, response.status === 200, `HTTP ${response.status}`));
  }

  const [broll, characters, feed, state, pipeline, invalidGeneration, unknownGeneration] = await Promise.all([
    json("/api/broll"),
    json("/api/characters"),
    json("/api/feed"),
    json("/api/generate?characterId=c-selene"),
    json("/api/pipeline?scopeType=actor&scopeId=c-selene"),
    json("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    json("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "not-a-pipeline", characterId: "c-selene" }),
    }),
  ]);

  const brollItems = Array.isArray(broll.payload.characters) ? broll.payload.characters : [];
  const characterItems = Array.isArray(characters.payload.characters) ? characters.payload.characters : [];
  const feedItems = Array.isArray(feed.payload.posts) ? feed.payload.posts : [];
  const assets = Array.isArray(state.payload.production?.assets) ? state.payload.production.assets : [];
  const asset = (kind, provider) => assets.find((item) => item.kind === kind && (!provider || item.provider === provider));
  const catalogTypes = new Set((pipeline.payload.catalog ?? []).map((item) => item.type));
  const spark = (pipeline.payload.catalog ?? []).find((item) => item.type === "spark");
  const feedAuthors = new Set(feedItems.map((post) => post.author?.id).filter(Boolean));
  const feedMedia = feedItems.filter((post) => post.mediaUrl || post.sharedPost?.mediaUrl);
  const providerGuardChecks = [];
  for (const [provider, configured, keyName, model] of [
    ["openrouter", state.payload.openRouter, "OPENROUTER_API_KEY", "google/gemini-2.5-flash-image"],
    ["openai", state.payload.openAI, "OPENAI_API_KEY", "gpt-image-2"],
  ]) {
    if (configured) {
      providerGuardChecks.push(result(`Admin ${provider} readiness guard`, true, "provider configured"));
      continue;
    }
    const guardedSave = await json("/api/admin/pipeline", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({
        config: {
          ...state.payload.pipeline,
          stages: {
            ...state.payload.pipeline?.stages,
            image: {
              ...state.payload.pipeline?.stages?.image,
              provider,
              model,
            },
          },
        },
      }),
    });
    providerGuardChecks.push(result(
      `Admin ${provider} readiness guard`,
      guardedSave.response.status === 400 && String(guardedSave.payload.error).includes(keyName),
      `HTTP ${guardedSave.response.status}`,
    ));
  }

  const apiChecks = [
    result("B-roll API", broll.response.ok && brollItems.length >= 2, `${brollItems.length} playable entries`),
    result("Shared actor catalogue", characters.response.ok && characterItems.length >= 10, `${characterItems.length} actors`),
    result("Cross-account creator feed", feed.response.ok && feedItems.length > 0 && feedAuthors.size >= 2 && feedMedia.length > 0, `${feedItems.length} posts · ${feedAuthors.size} creators · ${feedMedia.length} media posts`),
    result("Supabase production state", state.response.ok && state.payload.database === true, state.payload.database ? "connected" : "not connected"),
    result(
      "Active media providers",
      state.payload.elevenLabs === true
        && state.payload.seedModels === true
        && state.payload.pipeline?.stages?.image?.provider === "byteplus"
        && state.payload.pipeline?.stages?.video?.provider === "byteplus",
      `${state.payload.pipeline?.stages?.image?.provider ?? "missing"} image · ${state.payload.pipeline?.stages?.video?.provider ?? "missing"} video`,
    ),
    result(
      "Optional image alternatives",
      state.payload.openRouter === false
        && state.payload.openAI === false
        && !["openrouter", "openai"].includes(state.payload.pipeline?.stages?.image?.provider),
      "unconfigured providers are not selected",
    ),
    result("Generation input validation", invalidGeneration.response.status === 400, `HTTP ${invalidGeneration.response.status}`),
    result("Unknown generation action", unknownGeneration.response.status === 400, `HTTP ${unknownGeneration.response.status}`),
    result("Locked voice continuity", state.payload.production?.voiceId && asset("dialogue", "elevenlabs")?.metadata?.voiceId === state.payload.production.voiceId, state.payload.production?.voiceId ? "dialogue uses locked voice" : "voice is not locked"),
    result("ElevenLabs successful history", state.payload.providers?.elevenLabs?.hasSucceeded, state.payload.providers?.elevenLabs?.status ?? "not run"),
    result("Seed model successful history", state.payload.providers?.seedModels?.hasSucceeded, state.payload.providers?.seedModels?.status ?? "not run"),
    result(
      "Pipeline catalogue",
      ["identity_still", "gallery_still", "spark", "punch", "shot", "episode", "spot", "trailer", "delivery_package"].every((type) => catalogTypes.has(type)),
      `${catalogTypes.size} output contracts`,
    ),
    result(
      "Spark provider handoffs",
      ["seedream", "seedance", "elevenlabs", "ffmpeg", "human"].every((executor) => spark?.steps?.some((step) => step.executor === executor)),
      `${spark?.steps?.length ?? 0} ordered stages`,
    ),
    ...providerGuardChecks,
  ];

  const mediaChecks = [
    await mediaCheck("Homepage B-roll media", brollItems[0]?.videoUrl, "video/"),
    await mediaCheck("Locked dialogue asset", asset("dialogue", "elevenlabs")?.url, "audio/"),
    await mediaCheck("Signature SFX asset", asset("sfx", "elevenlabs")?.url, "audio/"),
    await mediaCheck("Theme asset", asset("theme", "elevenlabs")?.url, "audio/"),
    await mediaCheck("Seedream image asset", asset("gallery", "byteplus")?.url, "image/"),
    await mediaCheck("Seedance video asset", asset("video", "byteplus")?.url, "video/"),
  ];

  const mobileChecks = [];
  for (const path of ["/api/v1/mobile/characters", "/api/v1/mobile/library"]) {
    const anonymous = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(30_000) });
    mobileChecks.push(result(`Protected ${path}`, anonymous.status === 401, `anonymous HTTP ${anonymous.status}`));
    if (accessToken) {
      const authenticated = await fetch(`${baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${decodeURIComponent(accessToken)}` },
        signal: AbortSignal.timeout(60_000),
      });
      mobileChecks.push(result(`Authenticated ${path}`, authenticated.status === 200, `HTTP ${authenticated.status}`));
    }
  }

  const checks = [...publicChecks, ...adminChecks, ...apiChecks, ...mediaChecks, ...mobileChecks];
  console.table(checks);
  const failures = checks.filter((check) => !check.passed);
  if (failures.length) throw new Error(`${failures.length} system verification check${failures.length === 1 ? "" : "s"} failed.`);
  console.log("Chaplin web, admin, data, media, pipeline contracts, and mobile API boundaries verified.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
