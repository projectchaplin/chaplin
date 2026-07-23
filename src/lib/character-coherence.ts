import type { VoiceGender } from "@/lib/types";

export function explicitVoiceGender(text: string): VoiceGender | null {
  const normalized = text.toLowerCase();
  const masculine = /\b(he|him|his|man|male|boy|gentleman|father|brother|husband|son|mr)\b/.test(normalized);
  const feminine = /\b(she|her|hers|woman|female|girl|lady|mother|sister|wife|daughter|mrs|ms)\b/.test(normalized);
  if (masculine && !feminine) return "masculine";
  if (feminine && !masculine) return "feminine";
  return null;
}

export function alignVoiceDescription(description: string, voiceGender: VoiceGender) {
  if (voiceGender === "masculine") {
    return description
      .replace(/\bfeminine\b/gi, "masculine")
      .replace(/\bfemale\b/gi, "male")
      .replace(/\bwoman(?:'s)?\b/gi, (value) => value.toLowerCase().endsWith("'s") ? "man's" : "man");
  }
  if (voiceGender === "feminine") {
    return description
      .replace(/\bmasculine\b/gi, "feminine")
      .replace(/\bmale\b/gi, "female")
      .replace(/\bman(?:'s)?\b/gi, (value) => value.toLowerCase().endsWith("'s") ? "woman's" : "woman");
  }
  return description
    .replace(/\b(feminine|masculine)\b/gi, "androgynous")
    .replace(/\b(female|male)\b/gi, "gender-neutral");
}
