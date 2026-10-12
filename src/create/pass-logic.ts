// Earned progress is deliberately separate from spendable balance and token holdings.
export type CreatorProgress = { xp: number; contributions: number; projects: number; likes: number; applications: number; payments: number };
export const XP_LEVELS = [0, 20, 50, 100, 200, 350, 500, 750, 1000, 1500] as const;
export function passLevel(xp: number) {
  const total = Math.max(0, Number(xp) || 0);
  const index = XP_LEVELS.reduce((best, threshold, i) => total >= threshold ? i : best, 0);
  const level = index + 1;
  const next = XP_LEVELS[index + 1] ?? null;
  const title = level === 1 ? "Newcomer" : level <= 3 ? "Contributor" : level <= 6 ? "Creator" : level <= 8 ? "Builder" : "Pro";
  const progress = next === null ? 100 : Math.min(100, (total - XP_LEVELS[index]) / (next - XP_LEVELS[index]) * 100);
  return { level, title, next, progress, remaining: next === null ? 0 : next - total };
}
export function earnedBadges(p: CreatorProgress) {
  return [p.projects > 0 && "Project maker", p.likes > 0 && "Supporter", p.applications > 0 && "Collaborator", p.payments > 0 && "Project backer"].filter((b): b is string => typeof b === "string");
}