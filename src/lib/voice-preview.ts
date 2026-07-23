const MIN_AUDITION_WORDS = 3;
const MAX_AUDITION_WORDS = 8;

export function compactVoicePreview(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const clauses = normalized
    .split(/[.!?;:\u2014\u2013,]+/)
    .map((clause) => clause.trim())
    .filter(Boolean);
  const completeClause = clauses.find((clause) => {
    const count = clause.split(/\s+/).length;
    return count >= MIN_AUDITION_WORDS && count <= MAX_AUDITION_WORDS;
  });
  const words = (completeClause ?? normalized).split(/\s+/).slice(0, MAX_AUDITION_WORDS);
  return `${words.join(" ").replace(/[^\p{L}\p{N}'"]+$/u, "")}.`;
}
