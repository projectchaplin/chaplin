export const WELCOME_CREDITS = 100;
export const CHARACTER_CREATION_CREDITS = 25;
export const PUNCH_15S_CREDITS = 75;

export function productionCreditCost(format: string, durationSeconds: number) {
  return format === "punch" && durationSeconds === 15 ? PUNCH_15S_CREDITS : 0;
}
