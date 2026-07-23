import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { attachMediaPipelineOutput, getMediaPipelineRun } from "@/lib/server/media-pipeline";
import { saveMediaAsset } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

const execute = promisify(execFile);

async function download(url: string, destination: string) {
  const parsed = new URL(url);
  const storageHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : "";
  if (parsed.protocol !== "https:" || parsed.hostname !== storageHost) {
    throw new Error("Shot media must come from Chaplin's configured storage.");
  }
  const response = await fetch(parsed);
  if (!response.ok) throw new Error(`Download shot media: ${response.status}.`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

export async function POST(request: Request) {
  let workDirectory = "";
  try {
    const input = await request.json() as Record<string, unknown>;
    const runId = typeof input.runId === "string" ? input.runId : "";
    const characterId = typeof input.characterId === "string" ? input.characterId : "";
    const shotUrls = Array.isArray(input.shotUrls)
      ? input.shotUrls.filter((value): value is string => typeof value === "string" && Boolean(value))
      : [];
    const frameUrls = Array.isArray(input.frameUrls)
      ? input.frameUrls.filter((value): value is string => typeof value === "string" && Boolean(value))
      : [];
    const sceneDurationSeconds = Math.min(5, Math.max(1, Number(input.sceneDurationSeconds) || 4));
    const finalDurationSeconds = Math.min(120, Math.max(1, Number(input.finalDurationSeconds) || shotUrls.length * sceneDurationSeconds));
    if (!runId || !characterId || shotUrls.length < 1 || shotUrls.length > 20) {
      throw new Error("A pipeline run, actor, and between one and twenty scene URLs are required.");
    }
    const run = await getMediaPipelineRun(runId);
    if (!run) throw new Error("Pipeline run was not found.");
    if (run.outputType !== "punch") throw new Error("This assembler currently expects a Punch production.");

    workDirectory = await mkdtemp(path.join(tmpdir(), "chaplin-punch-"));
    const shotPaths = shotUrls.map((_, index) => path.join(workDirectory, `scene-${index + 1}.mp4`));
    const outputPath = path.join(workDirectory, "punch-master.mp4");
    await Promise.all(shotUrls.map((url, index) => download(url, shotPaths[index])));

    await execute("ffmpeg", [
      "-y",
      ...shotPaths.flatMap((shotPath) => ["-i", shotPath]),
      "-filter_complex",
      [
        ...shotPaths.map((_, index) => (
          `[${index}:v]trim=duration=${sceneDurationSeconds},scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,fps=24,setsar=1,setpts=PTS-STARTPTS[v${index}]`
        )),
        `${shotPaths.map((_, index) => `[v${index}]`).join("")}concat=n=${shotPaths.length}:v=1:a=0[vout]`,
      ].join(";"),
      "-map", "[vout]",
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "20",
      "-pix_fmt", "yuv420p",
      "-t", String(finalDurationSeconds),
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
      durationSeconds: finalDurationSeconds,
      metadata: {
        pipelineRunId: run.id,
        outputType: "punch",
        sourceUrls: shotUrls,
        sourceFrameUrls: frameUrls,
        sceneDurationSeconds,
        finalDurationSeconds,
      },
    });
    const renderedOutput = {
      url: asset.url,
      durationSeconds: finalDurationSeconds,
      shotUrls,
      frameUrls,
      sceneDurationSeconds,
      renderedAt: new Date().toISOString(),
    };
    const updatedRun = await attachMediaPipelineOutput({
      runId,
      stepKeys: ["assembly", "mastering", "creative-review"],
      output: renderedOutput,
      outputAssetId: asset.id,
    });
    return Response.json({ url: asset.url, assetId: asset.id, run: updatedRun });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not assemble the Punch output." },
      { status: 500 },
    );
  } finally {
    if (workDirectory) await rm(workDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
