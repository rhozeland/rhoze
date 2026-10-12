import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "../lib/auth";
import '../components/admin-mobile.css';
type Entry = { slug: string; title: string; artist: string; image: string };
type Story = { story: string; cultural_context: string; rhozeland_contribution: string };
const emptyStory: Story = { story: "", cultural_context: "", rhozeland_contribution: "" };
export default function ProjectStories() {
  const { isAdmin } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [records, setRecords] = useState<Record<string, Story>>({});
  const [slug, setSlug] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Story>(emptyStory);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    Promise.all([
      fetch("/portfolio-projects.json").then(r => { if (!r.ok) throw new Error("Project list unavailable"); return r.json() as Promise<Entry[]>; }),
      supabase.from("portfolio_details").select("slug,story,cultural_context,rhozeland_contribution"),
    ]).then(([items, result]) => {
      if (!active) return;
      if (result.error) throw result.error;
      const next: Record<string, Story> = {};
      for (const row of result.data || []) next[row.slug] = { story: row.story || "", cultural_context: row.cultural_context || "", rhozeland_contribution: row.rhozeland_contribution || "" };
      setEntries(items); setRecords(next);
      const first = items[0]?.slug || "";
      setSlug(first); setDraft(next[first] || emptyStory);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin]);
  const selected = entries.find(e => e.slug === slug);
  const visible = entries.filter(e => `${e.title} ${e.artist}`.toLowerCase().includes(search.toLowerCase()));
  const dirty = JSON.stringify(draft) !== JSON.stringify(records[slug] || emptyStory);
  function choose(value: string) {
    if (dirty && !window.confirm("Discard unsaved story changes?")) return;
    setSlug(value); setDraft(records[value] || emptyStory); setError("");
  }
  async function save() {
    if (!isAdmin || !selected) return;
    setBusy(true); setError("");
    const { error: failure } = await supabase.from("portfolio_details").upsert({ slug, ...draft });
    if (failure) setError(failure.message);
    else { setRecords(previous => ({ ...previous, [slug]: { ...draft } })); toast({ title: "Project story saved" }); }
    setBusy(false);
  }
  if (!isAdmin) return <p role="alert">Admin access required.</p>;
  return <section className="team-story-editor space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Project stories</h2>
      {selected && <Button variant="outline" size="sm" asChild><a href={`/project/${slug}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> View project</a></Button>}
    </header>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading ? <p className="text-sm text-muted-foreground">Loading projects…</p> : <>
      <div className="grid gap-3 sm:grid-cols-2"><Input aria-label="Search projects" placeholder="Search project or artist…" value={search} onChange={e => setSearch(e.target.value)} />
        <Select value={slug} onValueChange={choose} disabled={busy}><SelectTrigger aria-label="Select project"><SelectValue placeholder="Choose project" /></SelectTrigger><SelectContent>{visible.map(e => <SelectItem value={e.slug} key={e.slug}>{e.title} · {e.artist}</SelectItem>)}</SelectContent></Select>
      </div>
      {visible.length === 0 && <p className="text-sm text-muted-foreground">No matching projects.</p>}
      {selected && <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)]"><aside className="team-story-identity space-y-2"><img src={selected.image} alt={selected.title} className="aspect-square w-full max-w-[180px] rounded-md object-cover" /><h3 className="font-medium">{selected.title}</h3><p className="text-sm text-muted-foreground">{selected.artist}</p></aside>
        <div className="min-w-0 space-y-4">{([["story", "Project lore"], ["cultural_context", "Cultural significance"], ["rhozeland_contribution", "Rhozeland’s contribution"]] as const).map(([key, label]) => <div className="space-y-2" key={key}><Label htmlFor={`editor-${key}`}>{label}</Label><Textarea id={`editor-${key}`} rows={5} value={draft[key]} onChange={e => setDraft(previous => ({ ...previous, [key]: e.target.value }))} /></div>)}
          <div className="team-story-save"><span role="status">{busy ? "Saving…" : dirty ? "Unsaved changes" : "Up to date"}</span><Button onClick={save} disabled={busy || !dirty}><Save size={16} />{busy ? "Saving…" : "Save story"}</Button></div></div>
      </div>}
    </>}
  </section>;
}