const LONG_PAUSE = /[\[(]\s*(?:long\s+pause|pause\s+long)\s*[\])]/gi;
const SHORT_PAUSE = /[\[(]\s*(?:short\s+pause|pause\s+short|beat)\s*[\])]/gi;
const PAUSE = /[\[(]\s*pause\s*[\])]/gi;
const OTHER_DIRECTION = /(?:\([^)]{1,80}\)|\[[^\]]{1,80}\])/g;
const SPEAKER_LABEL = /^[\p{L}\p{N} .'-]{1,50}:\s*/u;

function tidy(value: string) {
  return value
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
}

export function dialogueForEditor(value: string) {
  return tidy(
    value
      .replace(LONG_PAUSE, " — ")
      .replace(SHORT_PAUSE, " … ")
      .replace(PAUSE, " … ")
      .replace(OTHER_DIRECTION, " ")
  );
}

export function dialogueForSpeech(value: string) {
  return tidy(
    value
      .replace(/<[^>]*>/g, " ")
      .replace(SPEAKER_LABEL, "")
      .replace(LONG_PAUSE, ' <break time="1.2s" /> ')
      .replace(SHORT_PAUSE, ' <break time="0.5s" /> ')
      .replace(PAUSE, ' <break time="0.8s" /> ')
      .replace(OTHER_DIRECTION, " ")
  );
}
