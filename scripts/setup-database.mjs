import nextEnv from "@next/env";
import postgres from "postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  await sql.file(path.join(projectDir, "supabase", "migrations", "202607210001_admin_catalog.sql"));
  console.log("Supabase schema and character-media bucket are ready.");
} finally {
  await sql.end();
}
