export const WELCOME_CREDITS = 100;
export const CHARACTER_CREATION_CREDITS = 25;
export const PUNCH_15S_CREDITS = 75;
export const VIDEO_SECOND_CREDITS = 5;

export function productionCreditCost(format: string, durationSeconds: number) {
  const valid =
    (format === "spark" && durationSeconds === 5)
    || (format === "punch" && durationSeconds === 15)
    || (format === "episode" && durationSeconds === 60)
    || (format === "spot" && (durationSeconds === 30 || durationSeconds === 60));
  if (!valid) throw new Error("The production format and duration do not match.");
  return durationSeconds * VIDEO_SECOND_CREDITS;
}
