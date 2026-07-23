export const runtime = "nodejs";
export const maxDuration = 30;

const DEFAULT_CONCIERGE_VOICE_ID = "xMagNCpMgZ83QOEsHNre";
const CONCIERGE_MODEL = "eleven_flash_v2_5";

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY ?? process.env.ELEVEN_LABS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ElevenLabs speech is not configured." }, { status: 503 });
  }

  const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const text = typeof input.text === "string" ? input.text.trim().slice(0, 320) : "";
  if (!text) {
    return Response.json({ error: "Speech text is required." }, { status: 400 });
  }

  const voiceId = process.env.CHAPLIN_ELEVENLABS_VOICE_ID ?? DEFAULT_CONCIERGE_VOICE_ID;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: CONCIERGE_MODEL,
        language_code: "en",
        voice_settings: {
          stability: 0.42,
          similarity_boost: 0.82,
          style: 0.34,
          use_speaker_boost: true,
          speed: 0.98,
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok || !response.body) {
    const detail = await response.text();
    console.warn(`[concierge] ElevenLabs speech failed (${response.status}): ${detail.slice(0, 240)}`);
    return Response.json({ error: "Natural voice is temporarily unavailable." }, { status: 502 });
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "content-type": response.headers.get("content-type") ?? "audio/mpeg",
      "cache-control": "no-store",
      "x-chaplin-voice-model": CONCIERGE_MODEL,
    },
  });
}
