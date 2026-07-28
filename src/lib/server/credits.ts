import "server-only";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

type CreditMutation = {
  balance: number;
  applied: boolean;
};

function mutationRow(value: unknown): CreditMutation {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") {
    throw new Error("The credit wallet returned an invalid response.");
  }
  const record = row as Record<string, unknown>;
  return {
    balance: Number(record.balance ?? 0),
    applied: Boolean(record.applied),
  };
}

export async function ensureWelcomeCredits(userId: string) {
  const result = await getSupabaseAdminClient().rpc("ensure_creator_welcome_credits", {
    requested_user_id: userId,
  });
  if (result.error) throw new Error(`Prepare creator credits: ${result.error.message}`);
  return mutationRow(result.data).balance;
}

export async function spendCreatorCredits(input: {
  userId: string;
  amount: number;
  idempotencyKey: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  const result = await getSupabaseAdminClient().rpc("spend_creator_credits", {
    requested_user_id: input.userId,
    requested_amount: input.amount,
    requested_key: input.idempotencyKey,
    requested_description: input.description,
    requested_metadata: input.metadata ?? {},
  });
  if (result.error) {
    const message = result.error.message.includes("Not enough Chaplin credits")
      ? result.error.message
      : `Reserve creator credits: ${result.error.message}`;
    throw new Error(message);
  }
  return mutationRow(result.data);
}

export async function refundCreatorCredits(input: {
  userId: string;
  idempotencyKey: string;
  description: string;
}) {
  const result = await getSupabaseAdminClient().rpc("refund_creator_credits", {
    requested_user_id: input.userId,
    requested_key: input.idempotencyKey,
    requested_description: input.description,
  });
  if (result.error) throw new Error(`Refund creator credits: ${result.error.message}`);
  return mutationRow(result.data);
}
