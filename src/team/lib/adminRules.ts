export const TEAM_ROLES = ["admin", "employee", "marketing", "client"] as const;
export type TeamRole = typeof TEAM_ROLES[number];
export function hasTeamAccess(roles: readonly string[]) {
  return roles.some(role => role === "admin" || role === "employee" || role === "marketing");
}
export function validLeaderboardPoints(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 2147483647;
}