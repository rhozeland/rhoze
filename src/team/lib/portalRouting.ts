import { hasTeamAccess } from "./adminRules";

export type PortalIntent = "team" | "client";
export function portalDestination(roles: readonly string[], intent: PortalIntent | null) {
  const team = hasTeamAccess(roles);
  if (intent === "team") return team ? "/" : null;
  if (intent === "client") return "/client/home";
  if (team && roles.includes("client")) return null;
  return team ? "/" : "/client/home";
}