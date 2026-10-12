import { useEffect, useState } from "react";
import { Plus, Search, X, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { TeamPerson } from "./project-flow";

export default function TeamPlanner({ people, onChange }: { people: TeamPerson[]; onChange: (people: TeamPerson[]) => void }) {
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ id: string; slug: string | null; display_name: string; photo_url: string | null }[]>([]);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      const term = search.trim().replace(/^@/, "").replace(/[^a-zA-Z0-9 _-]/g, "");
      if (term.length < 2) { setResults([]); return; }
      const { data, error } = await supabase.from("creator_directory").select("id,slug,display_name,photo_url").eq("is_public", true).or(`display_name.ilike.%${term}%,slug.ilike.%${term}%`).limit(6);
      if (alive) { setResults(data || []); setError(error ? "Couldn't search creators. Try again." : ""); }
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [search]);
  const add = (person: TeamPerson) => {
    if (people.some((p) => person.creator_id ? p.creator_id === person.creator_id : p.email === person.email)) return;
    onChange([...people, person]); setSearch(""); setEmail(""); setResults([]); setError("");
  };
  return <div className="rz-team-planner">
    <label htmlFor="team-search">Add creators</label>
    <div className="rz-team-search"><Search size={16} /><input id="team-search" className="rz-in" value={search} placeholder="Search name or @handle" onChange={(e) => setSearch(e.target.value)} /></div>
    {results.map((c) => <div className="rz-person" key={c.id}>
      <span className="rz-person-avatar">{c.photo_url ? <img src={c.photo_url} alt="" /> : <UserRound size={16} />}</span>
      <span><b>{c.display_name}</b><small>@{c.slug}</small></span>
      <Button variant="outline" size="icon" aria-label={`Add ${c.display_name}`} disabled={people.some((p) => p.creator_id === c.id)} onClick={() => add({ creator_id: c.id, display_name: c.display_name, email: null })}><Plus /></Button>
    </div>)}
    <label htmlFor="team-email">Your team's email</label>
    <div className="rz-team-email"><input id="team-email" className="rz-in" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /><Button variant="outline" size="icon" aria-label="Add team email" onClick={() => { const value = email.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setError("Enter a valid email."); return; } add({ creator_id: null, display_name: value.split("@")[0], email: value }); }}><Plus /></Button></div>
    {people.map((p, i) => <div className="rz-person" key={p.creator_id || p.email || i}><UserRound size={16} /><span><b>{p.display_name}</b><small>{p.email || "Creator"}</small></span><Button variant="ghost" size="icon" aria-label={`Remove ${p.display_name}`} onClick={() => onChange(people.filter((_, j) => j !== i))}><X /></Button></div>)}
    {error && <p className="rz-err" role="alert">{error}</p>}
    <p className="rz-note">Team shortlist · no invitations sent</p>
  </div>;
}