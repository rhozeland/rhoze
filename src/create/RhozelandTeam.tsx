import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const TEAM = [
  { name: "Michael Lé", role: "Visual Specialist", alias: "Indoléstic", photo: "michael" },
  { name: "Marvin Ceron", role: "Creative Lead", alias: "MARV", photo: "marvin" },
  { name: "David Migueles", role: "Sound Specialist", alias: "Straightdizzy", photo: "david" },
  { name: "Daniel Charles", role: "Full Stack Developer", alias: "", photo: "daniel" },
] as const;

export default function RhozelandTeam({ projectTitle }: { projectTitle: string }) {
  return <section className="rz-studio-team" aria-labelledby="rhozeland-team-heading">
    <div className="rz-studio-team-heading"><h2 id="rhozeland-team-heading">Rhozeland team</h2><p>Contact a specialist · via collab@rhozeland.com</p></div>
    <div className="rz-studio-team-grid">
      {TEAM.map(person => <article className="rz-studio-person" key={person.name}>
        <img src={`/images/team-${person.photo}.webp`} alt={person.name} />
        <div className="rz-studio-person-info"><h3>{person.name}</h3><p>{person.role}</p>{person.alias && <small>{person.alias}</small>}</div>
        <Button asChild variant="outline" size="sm" className="rz-btn"><a aria-label={`Contact ${person.name}`} href={`mailto:collab@rhozeland.com?subject=${encodeURIComponent(`For ${person.name}${projectTitle.trim() ? ` — ${projectTitle.trim()}` : " — Project inquiry"}`)}`}><Mail size={14} />Contact</a></Button>
      </article>)}
    </div>
  </section>;
}