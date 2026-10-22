export const IDEA_QUESTIONS = ["title", "name", "making", "description", "audience", "location", "category", "cover"] as const;
export const FLEXIBLE_TIMELINES = ["1 week", "2 weeks", "1 month", "3 months", "Flexible"] as const;
export type TeamPerson = { creator_id: string | null; display_name: string; email: string | null };
export function validateIdeaQuestion(key: string, value: string) {
  const required: Record<string, string> = { title: "Give your project a name.", name: "Add your name.", making: "Tell us what you're making.", description: "Add a short description of your project." };
  return !value.trim() ? required[key] || "" : "";
}
export function scopeError(budgetCents: number, estimate: boolean, mode: string, timeline: string, deadline: string) {
  if (!estimate && budgetCents < 100) return "Enter a budget, or ask for an estimate.";
  if (mode === "date" && !deadline) return "Pick a target date.";
  if (mode !== "date" && !timeline) return "Pick a timeline.";
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
