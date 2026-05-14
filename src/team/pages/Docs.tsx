import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  CheckCircle2,
  Circle,
  UploadCloud,
  Download,
  FileText,
  FileVideo,
  FileImage,
  File as FileIcon,
  X,
  Users,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import EmbedPreview, { toEmbedUrl } from "../components/EmbedPreview";
import GoogleDriveBrowser from "../components/GoogleDriveBrowser";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const DEPARTMENTS = ["marketing", "hr", "development", "sales", "operations"] as const;
type Audience = "all" | "department" | "user";

type DocForm = {
  title: string;
  audience: Audience;
  department: string;
  target_user_id: string;
  file_url: string;
  is_required: boolean;
  file: File | null;
};

const EMPTY_FORM: DocForm = {
  title: "",
  audience: "all",
  department: "",
  target_user_id: "",
  file_url: "",
  is_required: false,
  file: null,
};

function fileIconFor(mime: string | null | undefined) {
  if (!mime) return FileIcon;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime === "application/pdf" || mime.startsWith("text/")) return FileText;
  return FileIcon;
}

function formatBytes(b: number | null | undefined) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function Docs() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<DocForm>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: docs } = useQuery({
    queryKey: ["docs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("docs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Client-side audience guard: even though RLS already filters server-side,
  // we re-check on the client so we never render thumbnails or request signed
  // URLs for files the current user isn't authorized to see.
  const { data: myProfile } = useQuery({
    queryKey: ["docs_my_profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, department")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const canView = (d: any): boolean => {
    if (!user?.id) return false;
    if (isAdmin) return true;
    const audience = (d.audience ?? "all") as Audience;
    if (audience === "all") return true;
    if (audience === "user") return d.target_user_id === user.id;
    if (audience === "department") {
      return !!myProfile?.department && d.department === myProfile.department;
    }
    return false;
  };

  const { data: completions } = useQuery({
    queryKey: ["doc_completions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("doc_completions").select("doc_id").eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((c) => c.doc_id));
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["docs_employee_directory"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, department")
        .order("display_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Resolve private "docs" bucket file paths to signed URLs for download.
  // Only request URLs for docs the client-side guard says the user can view —
  // unauthorized files are never fetched, previewed, or thumbnailed.
  useEffect(() => {
    const paths = (docs ?? [])
      .filter((d: any) => canView(d))
      .map((d: any) => d.file_path as string | null)
      .filter((p): p is string => !!p && !signedUrls[p]);
    if (paths.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage
        .from("docs")
        .createSignedUrls(paths, 60 * 60);
      if (cancelled || error || !data) return;
      const next: Record<string, string> = {};
      data.forEach((r: any) => {
        if (r.signedUrl && r.path) next[r.path] = r.signedUrl;
      });
      if (Object.keys(next).length) setSignedUrls((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, signedUrls, myProfile?.department, isAdmin, user?.id]);

  const create = useMutation({
    mutationFn: async () => {
      // --- Authorization & input validation ---------------------------------
      // Only admins are allowed to create docs (enforced again by RLS), and the
      // selected audience/department/target must be a real, verifiable value
      // before we upload the file or insert metadata.
      if (!user?.id) throw new Error("You must be signed in");
      if (!isAdmin) throw new Error("Only admins can publish docs");

      const schema = z.object({
        title: z.string().trim().min(1, "Title required").max(200),
        audience: z.enum(["all", "department", "user"]),
        department: z.enum(DEPARTMENTS).optional(),
        target_user_id: z.string().uuid().optional(),
        file_url: z
          .string()
          .trim()
          .max(2048)
          .url("File URL must be a valid URL")
          .optional()
          .or(z.literal("")),
      }).superRefine((v, ctx) => {
        if (v.audience === "department" && !v.department) {
          ctx.addIssue({ code: "custom", path: ["department"], message: "Pick a department" });
        }
        if (v.audience === "user" && !v.target_user_id) {
          ctx.addIssue({ code: "custom", path: ["target_user_id"], message: "Pick an employee" });
        }
      });

      const parsed = schema.safeParse({
        title: form.title,
        audience: form.audience,
        department: form.department || undefined,
        target_user_id: form.target_user_id || undefined,
        file_url: form.file_url,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
      }

      // Verify the targeted employee actually exists (and matches the chosen
      // department, if both were specified) before saving.
      if (form.audience === "user") {
        const { data: target, error: targetErr } = await supabase
          .from("profiles")
          .select("id, department")
          .eq("id", form.target_user_id)
          .maybeSingle();
        if (targetErr) throw targetErr;
        if (!target) throw new Error("Selected employee not found");
      }

      // File-type / size guard: matches the dialog's accepted types.
      if (form.file) {
        const okType =
          form.file.type === "application/pdf" ||
          form.file.type === "text/markdown" ||
          /\.md$/i.test(form.file.name) ||
          form.file.type.startsWith("image/") ||
          form.file.type.startsWith("video/");
        if (!okType) throw new Error("Unsupported file type");
        if (form.file.size > 100 * 1024 * 1024) {
          throw new Error("File must be under 100MB");
        }
      }
      // ---------------------------------------------------------------------

      let file_path: string | null = null;
      let file_name: string | null = null;
      let file_mime: string | null = null;
      let file_size_bytes: number | null = null;

      if (form.file) {
        setUploading(true);
        const safe = form.file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `${user?.id ?? "anon"}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from("docs")
          .upload(path, form.file, {
            contentType: form.file.type || undefined,
            upsert: false,
          });
        setUploading(false);
        if (upErr) throw upErr;
        file_path = path;
        file_name = form.file.name;
        file_mime = form.file.type || null;
        file_size_bytes = form.file.size;
      }

      // Derive a visible "category" label for grouping/back-compat.
      const category =
        form.audience === "all"
          ? "general"
          : form.audience === "department"
            ? `dept: ${form.department}`
            : "personal";

      const { error } = await supabase.from("docs").insert({
        title: form.title.trim(),
        category,
        audience: form.audience,
        department: form.audience === "department" ? (form.department as any) : null,
        target_user_id: form.audience === "user" ? form.target_user_id : null,
        file_url: form.file_url.trim() || null,
        file_path,
        file_name,
        file_mime,
        file_size_bytes,
        is_required: form.is_required,
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Doc added" });
      setOpen(false);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ docId, done }: { docId: string; done: boolean }) => {
      if (done) {
        const { error } = await supabase.from("doc_completions").delete().eq("doc_id", docId).eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("doc_completions").insert({ doc_id: docId, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doc_completions", user?.id] }),
  });

  const filtered = (docs ?? [])
    // Belt-and-suspenders: hide anything the audience guard rejects so
    // thumbnails/derived URLs respect the same dept/user rules as the file.
    .filter((d: any) => canView(d))
    .filter((d: any) =>
      !q ||
      d.title.toLowerCase().includes(q.toLowerCase()) ||
      (d.category ?? "").toLowerCase().includes(q.toLowerCase()),
    );

  const onPickFile = (f: File | null) => setForm((prev) => ({ ...prev, file: f }));

  const ACCEPT = "application/pdf,.md,text/markdown,image/*,video/*";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Docs & Training</h1>
          <p className="text-sm text-muted-foreground">Internal handbook, SOPs, training materials.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus size={14} /> New doc</Button></DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New doc</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>

                <div className="space-y-1.5">
                  <Label>Visible to</Label>
                  <Select
                    value={form.audience}
                    onValueChange={(v: Audience) =>
                      setForm({ ...form, audience: v, department: "", target_user_id: "" })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Everyone</SelectItem>
                      <SelectItem value="department">Specific department</SelectItem>
                      <SelectItem value="user">Specific employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><Users size={12} /> Department</Label>
                    <Select
                      value={form.department || undefined}
                      onValueChange={(v) =>
                        setForm({ ...form, audience: "department", department: v, target_user_id: "" })
                      }
                    >
                      <SelectTrigger disabled={form.audience === "user"}>
                        <SelectValue placeholder="Select department…" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((d) => (
                          <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><UserIcon size={12} /> Employee</Label>
                    <Select
                      value={form.target_user_id || undefined}
                      onValueChange={(v) =>
                        setForm({ ...form, audience: "user", target_user_id: v, department: "" })
                      }
                    >
                      <SelectTrigger disabled={form.audience === "department"}>
                        <SelectValue placeholder="Select employee…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(employees ?? []).map((e: any) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.display_name || e.email || e.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground -mt-2">
                  Department and employee selectors are interchangeable — picking one clears the other.
                </p>

                <div className="space-y-1.5">
                  <Label>Attachment (PDF, Markdown, image, or video)</Label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) onPickFile(f);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    {form.file ? (
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileIcon size={16} className="shrink-0 text-muted-foreground" />
                          <span className="truncate">{form.file.name}</span>
                          <span className="text-xs text-muted-foreground">{formatBytes(form.file.size)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onPickFile(null); }}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Remove file"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                        <UploadCloud size={28} />
                        <div><span className="text-foreground font-medium">Click to upload</span> or drag & drop</div>
                        <div className="text-[11px]">PDF · Markdown · Images · Videos</div>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept={ACCEPT}
                      onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>File URL (optional)</Label>
                  <Input
                    value={form.file_url}
                    onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                    placeholder="Paste a Google Doc / Sheet / Slides / Drive link"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Google Docs, Sheets, Slides, Drive files & folders, YouTube and Loom links auto-embed.
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.is_required} onCheckedChange={(v) => setForm({ ...form, is_required: !!v })} />
                  Required for all team members
                </label>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending || uploading}>
                  {uploading ? "Uploading…" : create.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="docs">
        <TabsList>
          <TabsTrigger value="docs">Internal docs</TabsTrigger>
          <TabsTrigger value="drive">Shared Drive</TabsTrigger>
        </TabsList>

        <TabsContent value="docs" className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input className="pl-9" placeholder="Search docs…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">
              No docs yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map((d: any) => {
                const done = completions?.has(d.id) ?? false;
                const Icon = fileIconFor(d.file_mime);
                const signed = d.file_path ? signedUrls[d.file_path] : null;
                const isImage = d.file_mime?.startsWith("image/");
                const isVideo = d.file_mime?.startsWith("video/");
                const audienceLabel =
                  d.audience === "department"
                    ? `Department · ${d.department ?? "—"}`
                    : d.audience === "user"
                      ? "Personal"
                      : "Everyone";

                return (
                  <div
                    key={d.id}
                    className="border border-border rounded-lg bg-card overflow-hidden flex flex-col"
                  >
                    {/* Thumbnail */}
                    <div className="relative bg-muted/40 aspect-[16/9] flex items-center justify-center overflow-hidden">
                      {isImage && signed ? (
                        <img src={signed} alt={d.title} className="w-full h-full object-cover" />
                      ) : isVideo && signed ? (
                        <video src={signed} className="w-full h-full object-cover" muted />
                      ) : (
                        <Icon size={42} className="text-muted-foreground" strokeWidth={1.25} />
                      )}
                      {d.is_required && (
                        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                          Required
                        </span>
                      )}
                      <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-background/80 backdrop-blur text-foreground border border-border">
                        {audienceLabel}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="p-3 flex-1 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm leading-tight">{d.title}</div>
                        <button
                          onClick={() => toggleComplete.mutate({ docId: d.id, done })}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          title={done ? "Mark incomplete" : "Mark complete"}
                        >
                          {done ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} />}
                        </button>
                      </div>

                      {d.file_url && toEmbedUrl(d.file_url) && (
                        <EmbedPreview url={d.file_url} title={d.title} height={180} />
                      )}

                      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                        <span className="text-[11px] text-muted-foreground truncate">
                          {d.file_name || (d.file_url ? new URL(d.file_url).hostname : "")}
                          {d.file_size_bytes ? ` · ${formatBytes(d.file_size_bytes)}` : ""}
                        </span>
                        <div className="flex items-center gap-1">
                          {d.file_url && !toEmbedUrl(d.file_url) && (
                            <a
                              href={d.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              Open
                            </a>
                          )}
                          {signed && (
                            <a
                              href={signed}
                              download={d.file_name || undefined}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                            >
                              <Download size={12} /> Download
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="drive" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">
            Browse the shared Google Drive linked to the workspace. Click a file to preview it inline; click the
            external icon to open it in Google Drive. Anyone with team access can read this view.
          </p>
          <GoogleDriveBrowser />
        </TabsContent>
      </Tabs>
    </div>
  );
}