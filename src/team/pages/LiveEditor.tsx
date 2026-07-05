import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { ExternalLink, Plus, RefreshCcw, Save, Trash2 } from "lucide-react";

type SectionKey = "project_spotlight" | "social_feed" | "did_you_know" | "broadcast_schedule" | "clothing_rail" | "latest_wire" | "app_panel";
type Row = { id?: string; section_key: SectionKey; title: string; payload: Record<string, any>; is_published?: boolean; updated_at?: string };
type Field = { path: string; label: string; kind?: "text" | "number" | "textarea" };
type ArrayBlock = { path: string; label: string; template: any; fields: Field[]; stringItems?: boolean };
type Section = { key: SectionKey; tab: string; title: string; description: string; fields?: Field[]; arrays?: ArrayBlock[]; note?: string };

const SECTIONS: Section[] = [
  {
    key: "project_spotlight",
    tab: "Spotlight",
    title: "Project Spotlight",
    description: "Controls the big rotating artist/project feature.",
    fields: [{ path: "rotationSeconds", label: "Rotation seconds", kind: "number" }],
    arrays: [{ path: "items", label: "Spotlight items", template: { title: "New project", artist: "Artist", tag: "Release", image: "/images/logo-black.webp", video: "" }, fields: [
      { path: "title", label: "Title" }, { path: "artist", label: "Artist" }, { path: "tag", label: "Tag" }, { path: "image", label: "Image URL" }, { path: "video", label: "Video URL" },
    ] }],
  },
  {
    key: "social_feed",
    tab: "Social",
    title: "Social Feed",
    description: "X pulls live through the connector; Instagram/LinkedIn can be topped up here when APIs limit reads.",
    note: "Social-feed thumbnails are disabled on the live page. Keep these posts text-first.",
    fields: [{ path: "handles.x", label: "X handle" }, { path: "handles.linkedin", label: "LinkedIn label" }, { path: "handles.instagram", label: "Instagram handle" }],
    arrays: [{ path: "fallbackPosts", label: "Fallback / curated posts", template: { who: "@rhozeland", platform: "IG", time: "today", message: "New update from the Rhozeland team." }, fields: [
      { path: "platform", label: "Platform" }, { path: "who", label: "Who" }, { path: "time", label: "Time" }, { path: "message", label: "Message", kind: "textarea" },
    ] }],
  },
  {
    key: "did_you_know",
    tab: "Facts",
    title: "Did You Know",
    description: "Rotating info cards in the right rail.",
    arrays: [{ path: "items", label: "Facts", template: { category: "Update", text: "Add a useful live-screen fact here." }, fields: [
      { path: "category", label: "Category" }, { path: "text", label: "Text", kind: "textarea" },
    ] }],
  },
  {
    key: "broadcast_schedule",
    tab: "Schedule",
    title: "Broadcast Schedule",
    description: "Manual schedule entries shown below Did You Know.",
    fields: [{ path: "timezone", label: "Timezone" }],
    arrays: [{ path: "items", label: "Schedule items", template: { day: "SAT", title: "New broadcast", time: "20:00 UTC" }, fields: [
      { path: "day", label: "Day" }, { path: "title", label: "Title" }, { path: "time", label: "Time" },
    ] }],
  },
  {
    key: "clothing_rail",
    tab: "Clothing",
    title: "Clothing Rail",
    description: "Controls the bottom moving merch/lookbook strip.",
    fields: [{ path: "eyebrow", label: "Eyebrow" }, { path: "headline", label: "Headline" }, { path: "description", label: "Description" }, { path: "cta", label: "CTA" }],
    arrays: [{ path: "items", label: "Clothing / lookbook media", template: { name: "New look", price: "Preview", tag: "Lookbook", type: "image", src: "/images/logo-black.webp" }, fields: [
      { path: "name", label: "Name" }, { path: "price", label: "Price/label" }, { path: "tag", label: "Tag" }, { path: "type", label: "Type" }, { path: "src", label: "Image/video URL" },
    ] }],
  },
  {
    key: "latest_wire",
    tab: "Wire",
    title: "Latest Wire",
    description: "Ticker headlines. Market stats are added automatically.",
    arrays: [{ path: "items", label: "Headlines", template: "New live update headline", stringItems: true, fields: [{ path: "", label: "Headline" }] }],
  },
  {
    key: "app_panel",
    tab: "App",
    title: "App Panel",
    description: "QR code, app copy, and social links beside the chart/leaderboard.",
    fields: [{ path: "eyebrow", label: "Eyebrow" }, { path: "title", label: "Title" }, { path: "description", label: "Description", kind: "textarea" }, { path: "qrUrl", label: "QR image URL" }, { path: "qrCaption", label: "QR caption" }],
    arrays: [{ path: "socials", label: "Social links", template: { label: "NEW", url: "https://rhozeland.com" }, fields: [{ path: "label", label: "Label" }, { path: "url", label: "URL" }] }],
  },
];

const DEFAULTS: Record<SectionKey, Record<string, any>> = {
  project_spotlight: { rotationSeconds: 7, items: [] },
  social_feed: { handles: { x: "@rhozeland", linkedin: "Rhozeland", instagram: "@rhozeland" }, fallbackPosts: [] },
  did_you_know: { items: [] },
  broadcast_schedule: { timezone: "UTC", items: [] },
  clothing_rail: { eyebrow: "Toy Box · SS 26", headline: "Wear the Ecosystem", description: "", cta: "Drop coming soon", items: [] },
  latest_wire: { items: [] },
  app_panel: { eyebrow: "Creator OS · Rhozeland App", title: "Own Your Sound", description: "", qrUrl: "", qrCaption: "Scan to open", socials: [] },
};

function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
function getAt(obj: any, path: string) { return path ? path.split(".").reduce((acc, key) => acc?.[key], obj) : obj; }
function setAt(obj: any, path: string, value: any) {
  if (!path) return value;
  const parts = path.split(".");
  let node = obj;
  parts.slice(0, -1).forEach((part) => { node[part] = node[part] && typeof node[part] === "object" ? node[part] : {}; node = node[part]; });
  node[parts[parts.length - 1]] = value;
  return obj;
}
function normalize(key: SectionKey, payload: Json | null) {
  return { ...copy(DEFAULTS[key]), ...((payload && typeof payload === "object" && !Array.isArray(payload)) ? copy(payload) : {}) };
}

export default function LiveEditor() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<SectionKey, Row>>(() => SECTIONS.reduce((acc, s) => {
    acc[s.key] = { section_key: s.key, title: s.title, payload: copy(DEFAULTS[s.key]), is_published: true };
    return acc;
  }, {} as Record<SectionKey, Row>));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const latest = useMemo(() => Object.values(rows).map((r) => r.updated_at).filter(Boolean).sort().pop(), [rows]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("live_dashboard_content").select("id, section_key, title, payload, is_published, updated_at").order("section_key");
    if (error) toast({ title: "Could not load live content", description: error.message, variant: "destructive" });
    else setRows((current) => {
      const next = { ...current };
      (data ?? []).forEach((row) => {
        const key = row.section_key as SectionKey;
        if (key in DEFAULTS) next[key] = { ...row, section_key: key, payload: normalize(key, row.payload) } as Row;
      });
      return next;
    });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function patch(key: SectionKey, fn: (payload: Record<string, any>) => void) {
    setRows((current) => {
      const row = current[key];
      const payload = normalize(key, row.payload as Json);
      fn(payload);
      return { ...current, [key]: { ...row, payload } };
    });
  }

  async function save(key?: SectionKey) {
    setBusy(true);
    try {
      const keys = key ? [key] : SECTIONS.map((s) => s.key);
      const payload = keys.map((k) => ({ section_key: k, title: rows[k].title, payload: rows[k].payload as Json, is_published: true, updated_by: user?.id ?? null }));
      const { error } = await supabase.from("live_dashboard_content").upsert(payload, { onConflict: "section_key" });
      if (error) throw error;
      toast({ title: key ? `${rows[key].title} saved` : "Live page content saved" });
      await load();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  function renderField(section: Section, field: Field, item?: any, itemIndex?: number, arrayPath?: string) {
    const value = item ? getAt(item, field.path) : getAt(rows[section.key].payload, field.path);
    const onChange = (nextValue: string) => patch(section.key, (draft) => {
      if (item && arrayPath) {
        const items = getAt(draft, arrayPath) ?? [];
        const nextItem = copy(items[itemIndex ?? 0]);
        items[itemIndex ?? 0] = setAt(nextItem, field.path, field.kind === "number" ? Number(nextValue) : nextValue);
        setAt(draft, arrayPath, items);
      } else setAt(draft, field.path, field.kind === "number" ? Number(nextValue) : nextValue);
    });
    return (
      <div className="space-y-1.5" key={field.path || field.label}>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{field.label}</Label>
        {field.kind === "textarea" ? <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} /> : <Input type={field.kind === "number" ? "number" : "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />}
      </div>
    );
  }

  function renderSection(section: Section) {
    const row = rows[section.key];
    return (
      <TabsContent key={section.key} value={section.key}>
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </div>
            <Button onClick={() => save(section.key)} disabled={busy} className="gap-2 self-start sm:self-auto"><Save size={15} /> Save section</Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {section.note ? <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">{section.note}</div> : null}
            {section.fields?.length ? <div className="grid gap-3 md:grid-cols-2">{section.fields.map((field) => renderField(section, field))}</div> : null}
            {section.arrays?.map((block) => {
              const items = getAt(row.payload, block.path) ?? [];
              return (
                <div key={block.path} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">{block.label}</h3>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => patch(section.key, (draft) => setAt(draft, block.path, [...items, copy(block.template)]))}><Plus size={14} /> Add</Button>
                  </div>
                  {items.map((item: any, index: number) => (
                    <div key={index} className="grid gap-3 rounded-md border border-border p-3 lg:grid-cols-[1fr_auto]">
                      <div className="grid gap-3 md:grid-cols-2">
                        {block.stringItems ? renderField(section, { path: "", label: "Headline" }, item, index, block.path) : block.fields.map((field) => renderField(section, field, item, index, block.path))}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => patch(section.key, (draft) => setAt(draft, block.path, items.filter((_: any, i: number) => i !== index)))} aria-label="Remove item"><Trash2 size={16} /></Button>
                    </div>
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </TabsContent>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Live Broadcast Editor</h1>
          <p className="mt-1 text-sm text-muted-foreground">Edit manual live-screen content. The chart and community leaderboard stay automated.</p>
          <p className="mt-1 text-xs text-muted-foreground">Last saved: {latest ? new Date(latest).toLocaleString() : "not saved yet"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading || busy} className="gap-2"><RefreshCcw size={15} /> Reload</Button>
          <Button asChild variant="outline" className="gap-2"><a href="/live.html" target="_blank" rel="noreferrer"><ExternalLink size={15} /> Preview</a></Button>
          <Button onClick={() => save()} disabled={busy} className="gap-2"><Save size={15} /> Save all</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plug-and-play media</CardTitle>
          <CardDescription>Paste existing site paths, CDN links, or Drive-exported public media URLs. Public storage uploads are blocked for this workspace, so this editor stores URLs safely in the backend.</CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="project_spotlight" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {SECTIONS.map((section) => <TabsTrigger key={section.key} value={section.key}>{section.tab}</TabsTrigger>)}
        </TabsList>
        {SECTIONS.map(renderSection)}
      </Tabs>
    </div>
  );
}