import { supabase } from "@/integrations/supabase/client";
import type { TeamPerson } from "./project-flow";

export async function saveTeam(releaseId: string, people: TeamPerson[]) {
  const { error: removalError } = await supabase.from("release_team_members").delete().eq("release_id", releaseId);
  if (removalError) throw removalError;
  if (!people.length) return;
  const { error } = await supabase.from("release_team_members").insert(people.map((p) => ({ ...p, release_id: releaseId })));
  if (error) throw error;
}