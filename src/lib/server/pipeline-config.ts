import "server-only";

import {
  DEFAULT_PIPELINE_CONFIG,
  normalizePipelineConfig,
  type PipelineConfig,
} from "@/lib/pipeline-config";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

type PipelineSettingsRow = {
  config: unknown;
  revision: number;
  updated_at: string;
  updated_by: string | null;
};

export async function getPipelineConfig(): Promise<PipelineConfig> {
  const result = await getSupabaseAdminClient()
    .from("pipeline_settings")
    .select("config,revision,updated_at,updated_by")
    .eq("id", "active")
    .maybeSingle();

  if (result.error) {
    if (/pipeline_settings|schema cache|does not exist/i.test(result.error.message)) {
      return DEFAULT_PIPELINE_CONFIG;
    }
    throw new Error(`Load pipeline settings: ${result.error.message}`);
  }
  const row = result.data as PipelineSettingsRow | null;
  if (!row) return DEFAULT_PIPELINE_CONFIG;
  return normalizePipelineConfig(row.config, {
    revision: row.revision,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  });
}

export async function savePipelineConfig(input: unknown, userId: string) {
  const supabase = getSupabaseAdminClient();
  const current = await getPipelineConfig();
  const nextRevision = current.revision + 1;
  const config = normalizePipelineConfig(input, {
    revision: nextRevision,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  });
  const persistedConfig = { stages: config.stages };

  const history = await supabase.from("pipeline_setting_versions").insert({
    revision: current.revision,
    config: { stages: current.stages },
    changed_by: userId,
  });
  if (history.error) throw new Error(`Archive pipeline settings: ${history.error.message}`);

  const saved = await supabase.from("pipeline_settings").upsert({
    id: "active",
    config: persistedConfig,
    revision: nextRevision,
    updated_by: userId,
    updated_at: config.updatedAt,
  }, { onConflict: "id" });
  if (saved.error) throw new Error(`Save pipeline settings: ${saved.error.message}`);
  return config;
}
