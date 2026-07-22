// Seeds the creator feed with the media the studio has actually generated:
// every persisted video and still in media_assets becomes a feed post from the
// actor's maker, so the feed opens full instead of blank. Idempotent — assets
// already posted (same media_url) are skipped on re-run.
import nextEnv from "@next/env";
import postgres from "postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { loadEnvConfig } = nextEnv;
loadEnvConfig(projectDir);

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error("SUPABASE_DB_URL is missing from .env.local");
const connection = connectionString.match(
  /^postgres(?:ql)?:\/\/([^:]+):(.+)@([^:/]+):(\d+)\/([^?]+)(?:\?.*)?$/
);
if (!connection) throw new Error("SUPABASE_DB_URL is not a complete Postgres connection string.");
const [, username, encodedPassword, host, port, database] = connection;
const sql = postgres({
  host,
  port: Number(port),
  database,
  username,
  password: decodeURIComponent(encodedPassword),
  max: 1,
  ssl: "require",
});

const VIDEO_CAPTIONS = [
  (name) => `Five seconds of ${name}, straight out of the studio. The first frame is locked to the identity still, so the face never drifts.`,
  (name) => `New scene render for ${name}. One beat, one turn, no wasted frames.`,
  (name) => `${name} in motion. Same wardrobe, same light logic, new dramatic beat.`,
];
const IMAGE_CAPTIONS = [
  (name) => `Fresh still of ${name} from the identity pipeline. Every anchor held.`,
  (name) => `New frame for ${name} — same face, new moment.`,
  (name) => `${name}, one frozen decision. The eyes carry the whole scene.`,
];

try {
  const assets = await sql`
    select m.id, m.kind, m.url, m.created_at, c.name as character_name, c.maker_id
    from public.media_assets m
    join public.characters c on c.id = m.character_id
    where m.kind in ('video', 'gallery', 'banner', 'avatar') and m.url is not null
    order by m.created_at desc
    limit 60
  `;
  const users = await sql`select id from public.users`;
  const userIds = new Set(users.map((row) => row.id));
  const fallbackAuthors = [...userIds].filter((id) => id !== "u-admin");
  if (!fallbackAuthors.length) fallbackAuthors.push("u-admin");

  const existing = await sql`select media_url from public.feed_posts where media_url is not null`;
  const alreadyPosted = new Set(existing.map((row) => row.media_url));

  let inserted = 0;
  let index = 0;
  for (const asset of assets) {
    if (alreadyPosted.has(asset.url)) continue;
    const mediaKind = asset.kind === "video" ? "video" : "image";
    const captions = mediaKind === "video" ? VIDEO_CAPTIONS : IMAGE_CAPTIONS;
    const body = captions[index % captions.length](asset.character_name);
    const author = userIds.has(asset.maker_id) ? asset.maker_id : fallbackAuthors[index % fallbackAuthors.length];
    // Stagger timestamps so the feed reads as an ongoing stream, newest assets first.
    await sql`
      insert into public.feed_posts (author_id, body, media_kind, media_url, created_at)
      values (${author}, ${body}, ${mediaKind}, ${asset.url}, now() - make_interval(mins => ${20 + index * 47}))
    `;
    alreadyPosted.add(asset.url);
    inserted += 1;
    index += 1;
  }
  const total = await sql`select count(*)::int as count from public.feed_posts`;
  console.log(`Seeded ${inserted} media posts. Feed now has ${total[0].count} posts.`);
} finally {
  await sql.end();
}
