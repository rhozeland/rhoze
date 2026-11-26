export const IDEA_QUESTIONS = ["title", "name", "making", "description", "audience", "location", "category", "cover"] as const;
// Screen 0 picks a goal (one tap); screen 1 holds every basic on one page.
export const IDEA_SCREENS = [["goal"], ["title", "name", "making", "description", "audience", "location", "category", "cover"]] as const;
export const IDEA_SCREEN_TITLES = ["What brings you here?", "The basics"];
export const FLEXIBLE_TIMELINES = ["1 week", "2 weeks", "1 month", "3 months", "Flexible"] as const;
export type TeamPerson = { creator_id: string | null; display_name: string; email: string | null };
export function validateIdeaQuestion(key: string, value: string) {
  const required: Record<string, string> = { title: "Give your project a name.", name: "Add your name.", description: "Tell people what this project is." };
  return !value.trim() ? required[key] || "" : "";
}
export function scopeError(budgetCents: number, estimate: boolean, mode: string, timeline: string, deadline: string) {
  // Budget and timeline are optional so a project can be shared for a portfolio with neither set.
  void budgetCents; void estimate; void timeline;
  if (mode === "date" && !deadline) return "Pick a target date.";
  return "";
}
export const PRIVATE_PROJECT_STATUS = "draft";
export function hasOpenRoles(answers: { roles?: unknown[]; makers?: unknown } | null) {
  return Array.isArray(answers?.roles) && answers.roles.length > 0 && (!Array.isArray(answers?.makers) || answers.makers.includes("open_roles"));
}export type CoinChoice = "rhozeland" | "own" | "skip";
export const COIN_CHOICES: [CoinChoice, string][] = [["rhozeland", "Have Rhozeland launch a coin for this project"], ["own", "I already have a Pump.fun coin"], ["skip", "Skip for now"]];
export const FEE_LABEL = "Rhozeland fee (includes coin launch)";
export function coinLaunchRequested(r: { coin_mint?: string | null; answers?: { coin_choice?: unknown } | null } | null) {
  return r?.answers?.coin_choice === "rhozeland" && !(r?.coin_mint || "").trim();
}

// Why someone is creating a project. Drives which steps show and what is preselected.
// Legacy goal IDs remain valid so previously saved drafts keep their original flow.
export type ProjectGoal = "share" | "assist" | "collaborate" | "book" | "coin_existing" | "coin_launch";
export const PROJECT_GOALS: { id: ProjectGoal; title: string; desc: string }[] = [
  { id: "share", title: "Showcase a project", desc: "Share your work and build your portfolio." },
  { id: "assist", title: "Get support for a project", desc: "Get help with production, funding or next steps." },
  { id: "collaborate", title: "Build with other people", desc: "Find collaborators and make something together." },
];
export type FlowStep = "idea" | "scope" | "team" | "call" | "review";
export function flowForGoal(goal: ProjectGoal | "" | null | undefined): FlowStep[] {
  // A call only matters when Rhozeland is involved; sharing or an existing coin skips it.
  return goal === "share" || goal === "collaborate" || goal === "coin_existing" ? ["idea", "scope", "team", "review"] : ["idea", "scope", "team", "call", "review"];
}
export function goalDefaults(goal: ProjectGoal): { coin?: CoinChoice; rhozeland?: boolean } {
  if (goal === "coin_existing") return { coin: "own" };
  if (goal === "coin_launch") return { coin: "rhozeland", rhozeland: true };
  if (goal === "assist" || goal === "book") return { rhozeland: true };
  return {};
}
