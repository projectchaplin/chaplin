import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export type AnthropicImageBlock = {
  type: "image";
  source:
    | { type: "url"; url: string }
    | { type: "base64"; media_type: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; data: string };
};

function mediaType(reference: string): "image/png" | "image/jpeg" | "image/webp" | "image/gif" {
  const pathname = reference.toLowerCase().split(/[?#]/, 1)[0];
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".gif")) return "image/gif";
  return "image/webp";
}

/** Builds a Claude vision content block from a persisted actor reference. */
export async function anthropicImageBlock(reference: string): Promise<AnthropicImageBlock> {
  if (/^https?:\/\//i.test(reference)) {
    return { type: "image", source: { type: "url", url: reference } };
  }

  const dataUrl = reference.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/i);
  if (dataUrl) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: dataUrl[1].toLowerCase() as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: dataUrl[2],
      },
    };
  }

  if (!reference.startsWith("/")) throw new Error("Actor visual reference is not a valid image URL.");
  const publicRoot = path.resolve(process.cwd(), "public");
  const filePath = path.resolve(publicRoot, `.${reference}`);
  const relativePath = path.relative(publicRoot, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) throw new Error("Actor visual reference escaped the public directory.");
  const bytes = await readFile(filePath);
  return {
    type: "image",
    source: { type: "base64", media_type: mediaType(reference), data: bytes.toString("base64") },
  };
}
