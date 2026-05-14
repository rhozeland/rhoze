import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { validateDocForm, type FieldErrors } from "../lib/validateDocForm";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Shield,
  Settings2,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "../lib/auth";
import EmbedPreview, { toEmbedUrl } from "../components/EmbedPreview";
import DocPreview from "../components/DocPreview";
import { Progress } from "@/components/ui/progress";
import { uploadWithProgress, type UploadState } from "../lib/uploadWithProgress";

type Audience = "all" | "department" | "user" | "admin";
type DocScope = "mine" | "department" | "team" | "admin";
type TagFilter = "all" | string;

type DocForm = {
  title: string;
  audience: Audience;
  department: string;
  target_user_id: string;
  file_url: string;
  is_required: boolean;
  file: File | null;
  tag_department: string;
};

const EMPTY_FORM: DocForm = {
  title: "",
  audience: "all",
  department: "",
  target_user_id: "",
  file_url: "",
  is_required: false,
  file: null,
  tag_department: "",
};

function fileIconFor(mime: string | null | undefined) {
  if (!mime) return FileIcon;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime === "application/pdf" || mime.startsWith("text/")) return FileText;
  return FileIcon;
}

function isDocPreviewable(d: any): boolean {
  // Any uploaded file can open the lightbox — DocPreview renders an inline
  // preview when possible and a clear "download to view" fallback otherwise.
  return !!d.file_path;
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
  const [scope, setScope] = useState<DocScope>("team");
  const [tagFilter, setTagFilter] = useState<TagFilter>("all");
  const [form, setForm] = useState<DocForm>(EMPTY_FORM);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const clearError = (k: keyof FieldErrors) =>
    setFieldErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));

  // Resolve the caller's department first — the docs query relies on it to
  // mirror the server-side RLS rules at the fetch layer.
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

  const isHr = myProfile?.department === "hr";
  const canSeeAdmin = isAdmin || isHr;

  // If the user loses admin/HR access while on the admin scope, reset to team.
  useEffect(() => {
    if (scope === "admin" && !canSeeAdmin) {
      setScope("team");
    }
  }, [scope, canSeeAdmin]);

  // Dynamically load all department values that exist across profiles and docs
  // so the filter chips and dropdowns always reflect the current system state.
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    enabled: !!user?.id,
    queryFn: async () => {
      const [pRes, dRes, tRes] = await Promise.all([
        supabase.from("profiles").select("department").not("department", "is", null),
        supabase.from("docs").select("department").not("department", "is", null),
        supabase.from("docs").select("tag_department").not("tag_department", "is", null),
      ]);
      if (pRes.error) throw pRes.error;
      if (dRes.error) throw dRes.error;
      if (tRes.error) throw tRes.error;

      const set = new Set<string>();
      (pRes.data ?? []).forEach((d: any) => d.department && set.add(d.department));
      (dRes.data ?? []).forEach((d: any) => d.department && set.add(d.department));
      (tRes.data ?? []).forEach((d: any) => d.tag_department && set.add(d.tag_department));
      return [...set].sort();
    },
  });

  // Docs query enforces the active scope at the fetch layer so the request
  // mirrors what the RLS policy will return — never just a UI filter on top
  // of `select *`.
  const { data: docs } = useQuery({
    queryKey: [
      "docs",
      scope,
      tagFilter,
      user?.id,
      myProfile?.department ?? null,
      isAdmin,
    ],
    enabled:
      !!user?.id &&
      (scope !== "department" || !!myProfile?.department) &&
      (scope !== "admin" || canSeeAdmin),
    queryFn: async () => {
      let query = supabase.from("docs").select("*");
      if (scope === "mine") {
        query = query.eq("audience", "user").eq("target_user_id", user!.id);
      } else if (scope === "department") {
        query = query
          .eq("audience", "department")
          .eq("department", myProfile!.department as any);
      } else if (scope === "team") {
        query = query.eq("audience", "all");
      } else if (scope === "admin") {
        query = query.eq("audience", "admin");
      }
      if (tagFilter !== "all") {
        query = query.eq("tag_department", tagFilter as any);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
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
    if (audience === "admin") {
      return myProfile?.department === "hr";
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
      // Run the shared validator. Any failures are surfaced as inline
      // field-level errors instead of a generic toast.
      const result = await validateDocForm(
        {
          title: form.title,
          audience: form.audience,
          department: form.department,
          target_user_id: form.target_user_id,
          file_url: form.file_url,
          file: form.file
            ? { name: form.file.name, type: form.file.type, size: form.file.size }
            : null,
        },
        {
          isAdmin,
          userId: user?.id,
          lookupProfile: async (id) => {
            const { data, error } = await supabase
              .from("profiles")
              .select("id, department")
              .eq("id", id)
              .maybeSingle();
            if (error) throw error;
            return data ?? null;
          },
        },
      );
      if (!result.ok) {
        setFieldErrors(result.errors);
        // Throw a sentinel so the mutation enters onError without showing a
        // generic message — the inline errors carry the detail.
        const e: any = new Error(result.errors._form ?? "Please fix the highlighted fields");
        e.__validation = true;
        throw e;
      }
      setFieldErrors({});

      let file_path: string | null = null;
      let file_name: string | null = null;
      let file_mime: string | null = null;
      let file_size_bytes: number | null = null;

      if (form.file) {
        setUploadState("uploading");
        setUploadProgress(0);
        const safe = form.file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `${user?.id ?? "anon"}/${Date.now()}_${safe}`;
        const { promise, abort } = uploadWithProgress({
          bucket: "docs",
          path,
          file: form.file,
          onProgress: (pct) => setUploadProgress(pct),
        });
        abortRef.current = abort;
        try {
          await promise;
        } catch (err: any) {
          setUploadState("error");
          abortRef.current = null;
          throw err;
        }
        abortRef.current = null;
        setUploadState("idle");
        setUploadProgress(0);
        file_path = path;
        file_name = form.file.name;
        file_mime = form.file.type || null;
        file_size_bytes = form.file.size;
      }

      // Required docs always go to the whole team so they appear in "My Team".
      const effectiveAudience: Audience = form.is_required ? "all" : form.audience;

      // Derive a visible "category" label for grouping/back-compat.
      const category =
        effectiveAudience === "all"
          ? "general"
          : effectiveAudience === "department"
            ? `dept: ${form.department}`
            : effectiveAudience === "admin"
              ? "admin"
              : "personal";

      const { error } = await supabase.from("docs").insert({
        title: form.title.trim(),
        category,
        audience: effectiveAudience,
        department: effectiveAudience === "department" ? (form.department as any) : null,
        target_user_id: effectiveAudience === "user" ? form.target_user_id : null,
        tag_department: (form.tag_department || null) as any,
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
      setFieldErrors({});
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
    onError: (e: any) => {
      if (e?.__validation) return; // inline errors already rendered
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    },
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

  // Update a doc's visibility / audience after it's been posted.
  const updateVisibility = useMutation({
    mutationFn: async ({
      docId,
      audience,
      department,
      target_user_id,
      tag_department,
    }: {
      docId: string;
      audience: Audience;
      department: string | null;
      target_user_id: string | null;
      tag_department: string | null;
    }) => {
      const category =
        audience === "all"
          ? "general"
          : audience === "department"
            ? `dept: ${department ?? ""}`
            : audience === "admin"
              ? "admin"
              : "personal";
      const { error } = await supabase
        .from("docs")
        .update({
          audience,
          department: audience === "department" ? (department as any) : null,
          target_user_id: audience === "user" ? target_user_id : null,
          tag_department: (tag_department || null) as any,
          category,
        } as any)
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Visibility updated" });
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
    onError: (e: any) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteDoc = useMutation({
    mutationFn: async (docId: string) => {
      const { data: doc, error: fetchErr } = await supabase
        .from("docs")
        .select("file_path")
        .eq("id", docId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      const { error } = await supabase.from("docs").delete().eq("id", docId);
      if (error) throw error;
      if (doc?.file_path) {
        await supabase.storage.from("docs").remove([doc.file_path]);
      }
    },
    onSuccess: () => {
      toast({ title: "Doc removed" });
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
    onError: (e: any) =>
      toast({ title: "Failed to remove", description: e.message, variant: "destructive" }),
  });

  const massDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: rows, error: fetchErr } = await supabase
        .from("docs")
        .select("id, file_path")
        .in("id", ids);
      if (fetchErr) throw fetchErr;
      const { error } = await supabase.from("docs").delete().in("id", ids);
      if (error) throw error;
      const paths = (rows ?? []).map((r: any) => r.file_path).filter(Boolean) as string[];
      if (paths.length) {
        await supabase.storage.from("docs").remove(paths);
      }
    },
    onSuccess: () => {
      toast({ title: "Docs removed" });
      setSelectedIds(new Set());
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
    onError: (e: any) =>
      toast({ title: "Failed to remove", description: e.message, variant: "destructive" }),
  });

  const filtered = (docs ?? [])
    // Defense in depth — the docs query already filters by scope/tag at the
    // fetch layer to mirror RLS, but we re-check the audience guard here so
    // unauthorized rows can never leak into thumbnails or signed URLs.
    .filter((d: any) => canView(d))
    .filter((d: any) =>
      !q ||
      d.title.toLowerCase().includes(q.toLowerCase()) ||
      (d.category ?? "").toLowerCase().includes(q.toLowerCase()),
    );

  // Keyboard navigation inside the preview lightbox.
  useEffect(() => {
    if (!previewDoc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const list = filtered.filter((d: any) => isDocPreviewable(d) && signedUrls[d.file_path]);
        const idx = list.findIndex((d: any) => d.id === previewDoc.id);
        if (idx > 0) setPreviewDoc(list[idx - 1]);
        else if (list.length > 1) setPreviewDoc(list[list.length - 1]);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const list = filtered.filter((d: any) => isDocPreviewable(d) && signedUrls[d.file_path]);
        const idx = list.findIndex((d: any) => d.id === previewDoc.id);
        if (idx >= 0 && idx < list.length - 1) setPreviewDoc(list[idx + 1]);
        else if (list.length > 1) setPreviewDoc(list[0]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setPreviewDoc(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewDoc, filtered, signedUrls]);

  const MAX_FILE_BYTES = 500 * 1024 * 1024;

  function VisibilityMenu({ doc }: { doc: any }) {
    const [aud, setAud] = useState<Audience>((doc.audience ?? "all") as Audience);
    const [dep, setDep] = useState<string>(doc.department ?? "");
    const [tgt, setTgt] = useState<string>(doc.target_user_id ?? "");
    const [tag, setTag] = useState<string>(doc.tag_department ?? "");
    const NONE = "__none__";
    const onSave = () => {
      updateVisibility.mutate({
        docId: doc.id,
        audience: aud,
        department: aud === "department" ? dep || null : null,
        target_user_id: aud === "user" ? tgt || null : null,
        tag_department: tag || null,
      });
    };
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Edit visibility"
            title="Edit visibility"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <Settings2 size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3 space-y-3">
          <div className="text-xs font-semibold">Edit visibility</div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Visible to
            </Label>
            <Select value={aud} onValueChange={(v) => setAud(v as Audience)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="department">Specific department</SelectItem>
                <SelectItem value="user">Specific employee</SelectItem>
                {isAdmin && <SelectItem value="admin">Admin / HR only</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {aud === "department" && (
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Department
              </Label>
              <Select value={dep || undefined} onValueChange={(v) => setDep(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select department…" />
                </SelectTrigger>
                <SelectContent>
                  {departments?.map((d: string) => (
                    <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {aud === "user" && (
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Employee
              </Label>
              <Select value={tgt || undefined} onValueChange={(v) => setTgt(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  {(employees ?? []).map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.display_name || e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Category (department tag)
            </Label>
            <Select
              value={tag || NONE}
              onValueChange={(v) => setTag(v === NONE ? "" : v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No category</SelectItem>
                {departments?.map((d: string) => (
                  <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Admin-only label used for filtering. Independent of who can view the doc.
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <Button size="sm" className="h-7 text-xs" onClick={onSave} disabled={updateVisibility.isPending}>
              {updateVisibility.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  function isAcceptedFile(f: File) {
    return (
      f.type === "application/pdf" ||
      f.type === "text/markdown" ||
      /\.md$/i.test(f.name) ||
      f.type.startsWith("image/") ||
      f.type.startsWith("video/")
    );
  }

  const onPickFile = (f: File | null) => {
    if (!f) {
      setForm((prev) => ({ ...prev, file: null }));
      clearError("file");
      return;
    }
    if (!isAcceptedFile(f)) {
      setFieldErrors((prev) => ({ ...prev, file: "Unsupported file type — use PDF, Markdown, image, or video" }));
      setForm((prev) => ({ ...prev, file: null }));
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setFieldErrors((prev) => ({ ...prev, file: "File must be under 500 MB" }));
      setForm((prev) => ({ ...prev, file: null }));
      return;
    }
    clearError("file");
    setForm((prev) => ({ ...prev, file: f }));
  };

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
                  <Input
                    value={form.title}
                    aria-invalid={!!fieldErrors.title}
                    onChange={(e) => { clearError("title"); setForm({ ...form, title: e.target.value }); }}
                  />
                  {fieldErrors.title && (
                    <p role="alert" className="text-xs text-destructive">{fieldErrors.title}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Visible to</Label>
                  <Select
                    value={form.audience}
                    onValueChange={(v: Audience) =>
                      {
                        clearError("audience");
                        clearError("department");
                        clearError("target_user_id");
                        setForm({ ...form, audience: v, department: "", target_user_id: "" });
                      }
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Everyone</SelectItem>
                      <SelectItem value="department">Specific department</SelectItem>
                      <SelectItem value="user">Specific employee</SelectItem>
                      <SelectItem value="admin">Admin only</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldErrors.audience && (
                    <p role="alert" className="text-xs text-destructive">{fieldErrors.audience}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><Users size={12} /> Department</Label>
                    <Select
                      value={form.department || undefined}
                      onValueChange={(v) =>
                        {
                          clearError("department");
                          clearError("target_user_id");
                          setForm({ ...form, audience: "department", department: v, target_user_id: "" });
                        }
                      }
                    >
                      <SelectTrigger disabled={form.audience === "user"}>
                        <SelectValue placeholder="Select department…" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments?.map((d: string) => (
                          <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.department && (
                      <p role="alert" className="text-xs text-destructive">{fieldErrors.department}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><UserIcon size={12} /> Employee</Label>
                    <Select
                      value={form.target_user_id || undefined}
                      onValueChange={(v) =>
                        {
                          clearError("target_user_id");
                          clearError("department");
                          setForm({ ...form, audience: "user", target_user_id: v, department: "" });
                        }
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
                    {fieldErrors.target_user_id && (
                      <p role="alert" className="text-xs text-destructive">{fieldErrors.target_user_id}</p>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground -mt-2">
                  Department and employee selectors are interchangeable — picking one clears the other.
                </p>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Users size={12} /> Category (department tag)
                  </Label>
                  <Select
                    value={form.tag_department || "__none"}
                    onValueChange={(v) =>
                      setForm({ ...form, tag_department: v === "__none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">No category</SelectItem>
                      {departments?.map((d: string) => (
                        <SelectItem key={d} value={d} className="capitalize">
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Admin-only label used for filtering. Independent of who can view the doc.
                  </p>
                </div>

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
                    onClick={() => uploadState !== "uploading" && fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      fieldErrors.file
                        ? "border-destructive bg-destructive/5"
                        : dragOver
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                    } ${uploadState === "uploading" ? "cursor-default" : ""}`}
                  >
                    {uploadState === "uploading" && form.file ? (
                      <div className="flex flex-col items-center gap-3 text-sm">
                        <div className="w-full max-w-xs text-left">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{form.file.name}</span>
                            <span className="text-xs font-medium">{uploadProgress}%</span>
                          </div>
                          <Progress value={uploadProgress} className="h-2" />
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              abortRef.current?.();
                              abortRef.current = null;
                              setUploadState("cancelled");
                              setUploadProgress(0);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : uploadState === "error" && form.file ? (
                      <div className="flex flex-col items-center gap-3 text-sm text-destructive">
                        <UploadCloud size={28} />
                        <div className="font-medium">Upload failed</div>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadState("idle");
                              create.mutate();
                            }}
                          >
                            Retry
                          </Button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onPickFile(null); setUploadState("idle"); }}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                          >
                            Remove file
                          </button>
                        </div>
                      </div>
                    ) : uploadState === "cancelled" && form.file ? (
                      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                        <UploadCloud size={28} />
                        <div className="font-medium">Upload cancelled</div>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadState("idle");
                              create.mutate();
                            }}
                          >
                            Retry
                          </Button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onPickFile(null); setUploadState("idle"); }}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                          >
                            Remove file
                          </button>
                        </div>
                      </div>
                    ) : form.file ? (
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
                    ) : fieldErrors.file ? (
                      <div className="flex flex-col items-center gap-2 text-sm text-destructive">
                        <UploadCloud size={28} />
                        <div className="font-medium">{fieldErrors.file}</div>
                        <div className="text-[11px] text-muted-foreground">PDF · Markdown · Images · Videos · Max 500 MB</div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                        <UploadCloud size={28} />
                        <div><span className="text-foreground font-medium">Click to upload</span> or drag & drop</div>
                        <div className="text-[11px]">PDF · Markdown · Images · Videos · Max 500 MB</div>
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
                  <Label>File or link URL</Label>
                  <Input
                    value={form.file_url}
                    aria-invalid={!!fieldErrors.file_url}
                    onChange={(e) => { clearError("file_url"); setForm({ ...form, file_url: e.target.value }); }}
                    placeholder="Paste a Google Doc, Sheet, Slides, Form, Drive folder, YouTube or Loom link"
                  />
                  {fieldErrors.file_url && (
                    <p role="alert" className="text-xs text-destructive">{fieldErrors.file_url}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Auto-embeds Google Docs · Sheets · Slides · Forms · Drive files & folders · YouTube · Loom.
                  </p>
                  {form.file_url && toEmbedUrl(form.file_url) && (
                    <div className="mt-2">
                      <EmbedPreview url={form.file_url} title="Live preview" height={220} />
                    </div>
                  )}
                  {form.file_url && !toEmbedUrl(form.file_url) && (
                    <p className="text-[11px] text-muted-foreground italic">
                      Link saved as-is — no inline preview available for this URL.
                    </p>
                  )}
                </div>

                {fieldErrors._form && (
                  <p role="alert" className="text-xs text-destructive">{fieldErrors._form}</p>
                )}

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.is_required}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      setForm((prev) => ({
                        ...prev,
                        is_required: checked,
                        // Required docs are visible to the whole team — force
                        // the audience to "all" so they land in the My Team tab.
                        ...(checked
                          ? { audience: "all" as Audience, department: "", target_user_id: "" }
                          : {}),
                      }));
                      if (checked) {
                        clearError("audience");
                        clearError("department");
                        clearError("target_user_id");
                      }
                    }}
                  />
                  Required for all team members
                </label>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending || uploadState === "uploading"}>
                  {uploadState === "uploading" ? "Uploading…" : create.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input className="pl-9" placeholder="Search docs…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1 shrink-0">
              {(
                [
                  { id: "mine" as const, label: "My Documents", Icon: UserIcon },
                  { id: "department" as const, label: "My Department", Icon: Users },
                  { id: "team" as const, label: "My Team", Icon: Users },
                  ...(canSeeAdmin
                    ? [{ id: "admin" as const, label: "Admin Documents", Icon: Shield }]
                    : []),
                ]
              ).map(({ id, label, Icon }) => {
                const active = scope === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setScope(id)}
                    className={
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
                      (active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground")
                    }
                    aria-pressed={active}
                  >
                    <Icon size={12} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Department category filter — mirrors the FILTER | MARKETING | HR …
              row. Admins assign the tag in the New doc dialog; everyone can
              filter by it. */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="uppercase tracking-wider text-muted-foreground font-medium">
              Filter
            </span>
            {(["all", ...(departments ?? [])] as const).map((t) => {
              const active = tagFilter === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTagFilter(t)}
                  className={
                    "uppercase tracking-wider px-2.5 py-1 rounded border transition-colors " +
                    (active
                      ? "border-primary text-foreground bg-primary/10"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40")
                  }
                  aria-pressed={active}
                >
                  {t === "all" ? "All" : t}
                </button>
              );
            })}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <div className="text-sm">
                <span className="font-medium">{selectedIds.size}</span>{" "}
                <span className="text-muted-foreground">selected</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setConfirmOpen(true)}
                  disabled={massDelete.isPending}
                >
                  <Trash2 size={12} />
                  Remove selected
                </Button>
              </div>
            </div>
          )}

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {selectedIds.size} document{selectedIds.size > 1 ? "s" : ""}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the selected documents and their attached files. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={massDelete.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => massDelete.mutate([...selectedIds])}
                  disabled={massDelete.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {massDelete.isPending ? "Removing…" : "Remove"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {filtered.length === 0 ? (
            isAdmin ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full border border-dashed border-border rounded-lg p-10 text-center hover:bg-muted/30 transition-colors flex flex-col items-center gap-3"
              >
                <UploadCloud size={32} className="text-muted-foreground" strokeWidth={1.5} />
                <div className="text-sm">
                  <span className="text-foreground font-medium">Click to upload</span>{" "}
                  <span className="text-muted-foreground">or drag &amp; drop</span>
                </div>
                <div className="text-xs text-muted-foreground">PDF · Markdown · Images · Videos</div>
              </button>
            ) : (
              <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">
                No docs yet.
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map((d: any) => {
                const done = completions?.has(d.id) ?? false;
                const Icon = fileIconFor(d.file_mime);
                const signed = d.file_path ? signedUrls[d.file_path] : null;
                const previewable = isDocPreviewable(d) && !!signed;
                const embedUrl = d.file_url ? toEmbedUrl(d.file_url) : null;
                const audienceLabel =
                  d.audience === "department"
                    ? `Department · ${d.department ?? "—"}`
                    : d.audience === "user"
                      ? "Personal"
                      : d.audience === "admin"
                        ? "Admin"
                        : "Everyone";
                const canManage = isAdmin || d.created_by === user?.id;
                const isSelected = selectedIds.has(d.id);

                return (
                  <div
                    key={d.id}
                    className={
                      "border rounded-lg bg-card overflow-hidden flex flex-col transition-colors " +
                      (isSelected ? "border-primary ring-1 ring-primary" : "border-border")
                    }
                  >
                    {/* Thumbnail */}
                    <div
                      className={
                        "group relative bg-muted/40 flex items-center justify-center overflow-hidden " +
                        (embedUrl || (signed && !d.file_mime?.startsWith("image/") && !d.file_mime?.startsWith("video/")) ? "h-64 " : "aspect-[16/9] ") +
                        (previewable || (!embedUrl && d.file_url) ? "cursor-pointer" : "")
                      }
                      onClick={() => {
                        if (previewable) setPreviewDoc(d);
                        else if (!embedUrl && d.file_url) window.open(d.file_url, "_blank", "noopener,noreferrer");
                      }}
                    >
                      {d.file_mime?.startsWith("image/") && signed ? (
                        <img src={signed} alt={d.title} className="w-full h-full object-cover" />
                      ) : d.file_mime?.startsWith("video/") && signed ? (
                        <video src={signed} className="w-full h-full object-cover" muted />
                      ) : embedUrl ? (
                        <iframe
                          src={embedUrl}
                          title={d.title}
                          className="w-full h-full bg-background pointer-events-none group-hover:pointer-events-auto"
                          loading="lazy"
                          allow="autoplay; encrypted-media; fullscreen"
                          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      ) : signed ? (
                        <div className="w-full h-full overflow-auto bg-background pointer-events-none group-hover:pointer-events-auto">
                          <DocPreview url={signed} mime={d.file_mime} fileName={d.file_name} compact />
                        </div>
                      ) : (
                        <Icon size={42} className="text-muted-foreground" strokeWidth={1.25} />
                      )}
                      {d.is_required && (
                        <span className="absolute top-2 left-8 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                          Required
                        </span>
                      )}
                      {canManage && (
                        <div className="absolute top-2 left-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(v) => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (v) next.add(d.id);
                                else next.delete(d.id);
                                return next;
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${d.title}`}
                            className="border-background/80 bg-background/80 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                          />
                        </div>
                      )}
                      <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-background/80 backdrop-blur text-foreground border border-border">
                        {audienceLabel}
                      </span>
                      {(previewable || embedUrl || signed) && (
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors pointer-events-none" />
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-3 flex-1 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm leading-tight">{d.title}</div>
                        <div className="flex items-center gap-2 shrink-0">
                          {canManage && (
                            <>
                              <VisibilityMenu doc={d} />
                              <button
                                type="button"
                                onClick={() => deleteDoc.mutate(d.id)}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                title="Remove"
                                disabled={deleteDoc.isPending}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => toggleComplete.mutate({ docId: d.id, done })}
                            className="text-muted-foreground hover:text-foreground"
                            title={done ? "Mark incomplete" : "Mark complete"}
                          >
                            {done ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} />}
                          </button>
                        </div>
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                        <span className="text-[11px] text-muted-foreground truncate">
                          {d.file_name || (d.file_url ? new URL(d.file_url).hostname : "")}
                          {d.file_size_bytes ? ` · ${formatBytes(d.file_size_bytes)}` : ""}
                        </span>
                        <div className="flex items-center gap-1">
                          {d.file_url && (
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
      </div>

      {/* Preview / Lightbox */}
      <Dialog open={!!previewDoc} onOpenChange={(v) => !v && setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-black/95 border-none">
          {previewDoc && (() => {
            const signed = previewDoc.file_path ? signedUrls[previewDoc.file_path] : null;
            const isImg = previewDoc.file_mime?.startsWith("image/");
            const isVid = previewDoc.file_mime?.startsWith("video/");
            const previewableList = filtered.filter((d: any) => isDocPreviewable(d) && signedUrls[d.file_path]);
            const currentIdx = previewableList.findIndex((d: any) => d.id === previewDoc.id);
            const total = previewableList.length;
            const goPrev = () => {
              if (currentIdx > 0) setPreviewDoc(previewableList[currentIdx - 1]);
              else if (total > 1) setPreviewDoc(previewableList[total - 1]);
            };
            const goNext = () => {
              if (currentIdx >= 0 && currentIdx < total - 1) setPreviewDoc(previewableList[currentIdx + 1]);
              else if (total > 1) setPreviewDoc(previewableList[0]);
            };
            return (
              <div className="flex flex-col h-full relative">
                {/* Prev / Next side buttons */}
                {total > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goPrev}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                      aria-label="Previous attachment"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                      aria-label="Next attachment"
                    >
                      <ChevronRight size={24} />
                    </button>
                  </>
                )}
                <div className="flex-1 flex items-center justify-center overflow-auto p-4">
                  {isImg && signed ? (
                    <img src={signed} alt={previewDoc.title} className="max-w-full max-h-[70vh] object-contain rounded" />
                  ) : isVid && signed ? (
                    <video src={signed} controls className="max-w-full max-h-[70vh] rounded" />
                  ) : signed ? (
                    <DocPreview
                      url={signed}
                      mime={previewDoc.file_mime}
                      fileName={previewDoc.file_name}
                    />
                  ) : (
                    <div className="text-muted-foreground text-sm">Preview not available</div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-white/10 bg-black/80 backdrop-blur">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-sm text-white/90 truncate">{previewDoc.title}</div>
                    {total > 1 && (
                      <span className="text-xs text-white/50 shrink-0">
                        {currentIdx + 1} / {total}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {signed && (
                      <a
                        href={signed}
                        download={previewDoc.file_name || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-white/10 text-white hover:bg-white/20 transition-colors"
                      >
                        <Download size={12} /> Download
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white/10"
                      onClick={() => setPreviewDoc(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}