import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { getMediaPipelineRun } from "@/lib/server/media-pipeline";
import { saveMediaAsset } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

const execute = promisify(execFile);

function stepUrl(run: NonNullable<Awaited<ReturnType<typeof getMediaPipelineRun>>>, key: string) {
  const value = run.steps.find((step) => step.key === key)?.output.url;
  if (typeof value !== "string" || !value) throw new Error(`${key} has no generated media URL.`);
  return value;
}

async function download(url: string, destination: string) {
  const parsed = new URL(url);
  const storageHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : "";
  if (parsed.protocol !== "https:" || parsed.hostname !== storageHost) {
    throw new Error("Pipeline media must come from Chaplin’s configured Supabase storage.");
  }
  const response = await fetch(parsed);
  if (!response.ok) throw new Error(`Download pipeline media: ${response.status}.`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

export async function POST(request: Request) {
  let workDirectory = "";
  try {
    const input = await request.json() as Record<string, unknown>;
    const runId = typeof input.runId === "string" ? input.runId : "";
    const characterId = typeof input.characterId === "string" ? input.characterId : "";
    if (!runId || !characterId) throw new Error("Pipeline run and character are required.");
    const run = await getMediaPipelineRun(runId);
    if (!run) throw new Error("Pipeline run was not found.");

    workDirectory = await mkdtemp(path.join(tmpdir(), "chaplin-mix-"));
    const videoPath = path.join(workDirectory, "motion.mp4");
    const dialoguePath = path.join(workDirectory, "dialogue.mp3");
    const sfxPath = path.join(workDirectory, "sfx.mp3");
    const roomTonePath = path.join(workDirectory, "room-tone.mp3");
    const outputPath = path.join(workDirectory, "master.mp4");

    await Promise.all([
      download(stepUrl(run, "motion-plate"), videoPath),
      download(stepUrl(run, "dialogue"), dialoguePath),
      download(stepUrl(run, "sfx"), sfxPath),
      download(stepUrl(run, "room-tone"), roomTonePath),
    ]);

    await execute("ffmpeg", [
      "-y",
      "-i", videoPath,
      "-i", dialoguePath,
      "-i", sfxPath,
      "-i", roomTonePath,
      "-filter_complex",
      "[1:a]volume=1.0[a1];[2:a]volume=0.72,adelay=350|350[a2];[3:a]volume=0.22[a3];[a1][a2][a3]amix=inputs=3:duration=longest:dropout_transition=0,atrim=0:5[aout]",
      "-map", "0:v:0",
      "-map", "[aout]",
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
      "-t", "5",
      "-movflags", "+faststart",
      outputPath,
    ], { maxBuffer: 10 * 1024 * 1024, windowsHide: true });

    const output = await readFile(outputPath);
    const bytes = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
    const asset = await saveMediaAsset({
      characterId,
      kind: "video",
      provider: "ffmpeg",
      bytes,
      contentType: "video/mp4",
      durationSeconds: 5,
      metadata: {
        pipelineRunId: run.id,
        sourceSteps: ["motion-plate", "dialogue", "sfx", "room-tone"],
      },
    });
    return Response.json({ url: asset.url, assetId: asset.id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not mix the shot." }, { status: 500 });
  } finally {
    if (workDirectory) await rm(workDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
