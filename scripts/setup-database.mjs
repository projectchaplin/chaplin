import nextEnv from "@next/env";
import postgres from "postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdir } from "node:fs/promises";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { loadEnvConfig } = nextEnv;
loadEnvConfig(projectDir);

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  throw new Error("SUPABASE_DB_URL is missing from .env.local");
}

const connection = connectionString.match(
  /^postgres(?:ql)?:\/\/([^:]+):(.+)@([^:/]+):(\d+)\/([^?]+)(?:\?.*)?$/
);
if (!connection) {
  throw new Error("SUPABASE_DB_URL is not a complete Postgres connection string.");
}

const [, username, encodedPassword, host, port, database] = connection;
const password = decodeURIComponent(encodedPassword);
const sql = postgres({
  host,
  port: Number(port),
  database,
  username,
  password,
  max: 1,
  ssl: "require",
});
try {
  const migrationsDir = path.join(projectDir, "supabase", "migrations");
  const migrations = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const migration of migrations) {
    await sql.file(path.join(migrationsDir, migration));
  }
  console.log("Supabase schema and character-media bucket are ready.");
} finally {
  await sql.end();
}
