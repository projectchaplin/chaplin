const baseUrl = process.env.PIPELINE_BASE_URL ?? "http://127.0.0.1:3100";
const characterId = process.env.PIPELINE_CHARACTER_ID ?? "c-selene";

function check(name, passed, detail) {
  return { name, passed: Boolean(passed), detail };
}

async function mediaCheck(name, asset, expectedType) {
  if (!asset?.url?.startsWith("https://")) {
    return check(name, false, "Missing persistent HTTPS CDN asset");
  }
  const response = await fetch(asset.url, { method: "HEAD" });
  const contentType = response.headers.get("content-type") ?? "unknown";
  return check(
    name,
    response.ok && contentType.startsWith(expectedType),
    `${response.status} ${contentType} · ${asset.provider}`
  );
}

async function main() {
  const [adminResponse, stateResponse] = await Promise.all([
    fetch(`${baseUrl}/admin`),
    fetch(`${baseUrl}/api/generate?characterId=${encodeURIComponent(characterId)}`),
  ]);
  const adminHtml = await adminResponse.text();
  if (!stateResponse.ok) throw new Error(`Production state returned ${stateResponse.status}`);
  const state = await stateResponse.json();
  const assets = state.production?.assets ?? [];
  const find = (kind, provider) =>
    assets.find((asset) => asset.kind === kind && asset.provider === provider);
  const dialogue = find("dialogue", "elevenlabs");

  const results = [
    check("Admin control room", adminResponse.ok && adminHtml.includes("ADMIN CONTROL ROOM"), `${adminResponse.status}`),
    check(
      "Admin cost ledger",
      adminHtml.includes("Generation spend") && adminHtml.includes("Complete history") && adminHtml.includes("Provider credits"),
      "USD · INR · normalized tokens · provider usage"
    ),
    check("Supabase connection", state.database, state.database ? "configured" : "missing"),
    check("Locked ElevenLabs voice", state.production?.voiceId, state.production?.voiceId ? "present" : "missing"),
    check(
      "Dialogue voice continuity",
      dialogue?.metadata?.voiceId === state.production?.voiceId && dialogue?.metadata?.model === "eleven_multilingual_v2",
      dialogue?.metadata?.voiceId === state.production?.voiceId
        ? `${dialogue.metadata.model} · locked voice recorded`
        : "latest dialogue does not match the active locked voice"
    ),
    check(
      "ElevenLabs provider run",
      state.providers?.elevenLabs?.hasSucceeded,
      state.providers?.elevenLabs?.hasSucceeded
        ? `successful run recorded${state.providers.elevenLabs.status === "succeeded" ? "" : `; latest ${state.providers.elevenLabs.status}`}`
        : state.providers?.elevenLabs?.status ?? "not run"
    ),
    await mediaCheck("Dialogue on CDN", dialogue, "audio/"),
    await mediaCheck("Signature SFX on CDN", find("sfx", "elevenlabs"), "audio/"),
    await mediaCheck("Theme score on CDN", find("theme", "elevenlabs"), "audio/"),
    await mediaCheck("Uploaded reference on CDN", find("gallery", "upload"), "image/"),
    await mediaCheck("Seedream image on CDN", find("gallery", "byteplus"), "image/"),
    await mediaCheck("Seedance video on CDN", find("video", "byteplus"), "video/"),
  ];

  console.table(results);
  const failures = results.filter((result) => !result.passed);
  if (failures.length > 0) {
    const seedError = state.providers?.seedModels?.error;
    if (seedError) console.error(`Latest Seed model error: ${seedError}`);
    throw new Error(`${failures.length} pipeline check${failures.length === 1 ? "" : "s"} failed.`);
  }
  console.log(`End-to-end pipeline verified for ${characterId}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
