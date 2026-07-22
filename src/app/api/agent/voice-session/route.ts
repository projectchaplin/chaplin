export const runtime = "nodejs";

// Hands the browser a short-lived signed URL for the ElevenLabs Concierge
// agent, so the key never leaves the server.
export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY ?? process.env.ELEVEN_LABS_API_KEY;
  const agentId = process.env.CHAPLIN_ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) {
    return Response.json({ error: "Voice concierge is not configured." }, { status: 503 });
  }
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": apiKey } }
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`ElevenLabs returned ${response.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await response.json()) as { signed_url?: string };
    if (!data.signed_url) throw new Error("No signed_url in ElevenLabs response.");
    return Response.json({ signedUrl: data.signed_url, agentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voice session failed.";
    console.warn("[concierge] voice-session:", message);
    return Response.json({ error: message }, { status: 502 });
  }
}
