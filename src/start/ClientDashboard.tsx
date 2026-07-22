import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ArrowRight, LogOut, Wallet, FolderOpen, Plus, ExternalLink, CheckCircle2, Circle, Clock, Eye, MessageSquare, Flag, Send, X, Paperclip, Link2, FileText, Image as ImageIcon, Music, Download, Copy, RefreshCw, Pencil, Trash2, Check, Captions } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import EmbedPreview, { toEmbedUrl } from "@/team/components/EmbedPreview";
import AudioMessagePlayer from "./AudioMessagePlayer";

type Project = {
  id: string;
  title: string;
  status: string;
  credit_balance: number | null;
  dollar_balance_cents: number | null;
  active_tier_slug: string | null;
};

type CreditRequest = {
  id: string;
  title: string;
  status: string;
  estimated_credits: number | null;
  final_credits: number | null;
  created_at: string;
};

type Milestone = { id: string; title: string; due_date: string | null; status: string };

type MilestoneMessage = {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  embed_url: string | null;
  edited_at: string | null;
  caption_path: string | null;
  caption_name: string | null;
  caption_mime: string | null;
};

function fmtMoney(cents: number | null) {
  return `$${((cents ?? 0) / 100).toFixed(2)}`;
}

export default function ClientDashboard() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [nextMilestone, setNextMilestone] = useState<Milestone | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [requests, setRequests] = useState<CreditRequest[]>([]);

  // request form
  const [reqTitle, setReqTitle] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [reqCredits, setReqCredits] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // message team dialog
  const [msgMilestone, setMsgMilestone] = useState<Milestone | null>(null);
  const [msgList, setMsgList] = useState<MilestoneMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgBody, setMsgBody] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgUserId, setMsgUserId] = useState<string | null>(null);
  const [msgFile, setMsgFile] = useState<File | null>(null);
  const [msgEmbed, setMsgEmbed] = useState("");
  const [showEmbed, setShowEmbed] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [captionBusyId, setCaptionBusyId] = useState<string | null>(null);

  const loadMessages = useCallback(async (milestoneId: string) => {
    setMsgLoading(true);
    const { data, error } = await supabase
      .from("milestone_messages")
      .select("id,body,author_id,created_at,attachment_path,attachment_name,attachment_mime,attachment_size,embed_url,edited_at,caption_path,caption_name,caption_mime")
      .eq("milestone_id", milestoneId)
      .order("created_at", { ascending: true });
    if (!error) {
      const rows = (data ?? []) as MilestoneMessage[];
      setMsgList(rows);
      const paths = [
        ...rows.map(r => r.attachment_path),
        ...rows.map(r => r.caption_path),
      ].filter(Boolean) as string[];
      if (paths.length) {
        const { data: signed } = await supabase.storage
          .from("milestone-attachments")
          .createSignedUrls(paths, 60 * 60);
        const map: Record<string, string> = {};
        (signed ?? []).forEach(s => { if (s.path && s.signedUrl) map[s.path] = s.signedUrl; });
        setSignedUrls(map);
      } else {
        setSignedUrls({});
      }
    }
    setMsgLoading(false);
  }, []);

  async function openMessageTeam(m: Milestone) {
    setMsgMilestone(m);
    setMsgList([]);
    setMsgBody("");
    setMsgFile(null);
    setMsgEmbed("");
    setShowEmbed(false);
    const { data: { user } } = await supabase.auth.getUser();
    setMsgUserId(user?.id ?? null);
    await loadMessages(m.id);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!msgMilestone || !activeProject) return;
    const hasBody = msgBody.trim().length > 0;
    const hasFile = !!msgFile;
    const hasEmbed = showEmbed && msgEmbed.trim().length > 0;
    if (!hasBody && !hasFile && !hasEmbed) return;
    setMsgSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      let attachment_path: string | null = null;
      let attachment_name: string | null = null;
      let attachment_mime: string | null = null;
      let attachment_size: number | null = null;

      if (msgFile) {
        if (msgFile.size > 25 * 1024 * 1024) {
          throw new Error("Attachment must be under 25 MB");
        }
        const safeName = msgFile.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
        const path = `${activeProject.id}/${msgMilestone.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("milestone-attachments")
          .upload(path, msgFile, {
            contentType: msgFile.type || "application/octet-stream",
            upsert: false,
          });
        if (upErr) throw upErr;
        attachment_path = path;
        attachment_name = msgFile.name;
        attachment_mime = msgFile.type || null;
        attachment_size = msgFile.size;
      }

      const embed_url = hasEmbed ? msgEmbed.trim() : null;

      const { error } = await supabase.from("milestone_messages").insert({
        milestone_id: msgMilestone.id,
        project_id: activeProject.id,
        author_id: user.id,
        body: hasBody ? msgBody.trim() : null,
        attachment_path,
        attachment_name,
        attachment_mime,
        attachment_size,
        embed_url,
      });
      if (error) throw error;
      setMsgBody("");
      setMsgFile(null);
      setMsgEmbed("");
      setShowEmbed(false);
      await loadMessages(msgMilestone.id);
    } catch (err: any) {
      toast({ title: "Couldn't send", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setMsgSending(false);
    }
  }

  async function downloadAttachment(msg: MilestoneMessage) {
    if (!msg.attachment_path) return;
    try {
      const { data, error } = await supabase.storage
        .from("milestone-attachments")
        .download(msg.attachment_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = msg.attachment_name ?? "attachment";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Couldn't download", description: err.message ?? String(err), variant: "destructive" });
    }
  }

  async function copyAttachmentLink(msg: MilestoneMessage) {
    if (!msg.attachment_path) return;
    try {
      const { data, error } = await supabase.storage
        .from("milestone-attachments")
        .createSignedUrl(msg.attachment_path, 60 * 60 * 24 * 7);
      if (error) throw error;
      await navigator.clipboard.writeText(data.signedUrl);
      toast({ title: "Link copied", description: "Signed link valid for 7 days." });
    } catch (err: any) {
      toast({ title: "Couldn't copy link", description: err.message ?? String(err), variant: "destructive" });
    }
  }

  async function replaceAttachment(msg: MilestoneMessage, file: File) {
    if (!msgMilestone || !activeProject) return;
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "Too large", description: "Attachments must be under 25 MB.", variant: "destructive" });
      return;
    }
    setReplacingId(msg.id);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
      const newPath = `${activeProject.id}/${msgMilestone.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("milestone-attachments")
        .upload(newPath, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (upErr) throw upErr;

      const { error: updErr } = await supabase.from("milestone_messages")
        .update({
          attachment_path: newPath,
          attachment_name: file.name,
          attachment_mime: file.type || null,
          attachment_size: file.size,
        })
        .eq("id", msg.id);
      if (updErr) {
        // best-effort cleanup of the orphaned upload
        await supabase.storage.from("milestone-attachments").remove([newPath]);
        throw updErr;
      }

      if (msg.attachment_path) {
        await supabase.storage.from("milestone-attachments").remove([msg.attachment_path]);
      }
      toast({ title: "Attachment replaced" });
      await loadMessages(msgMilestone.id);
    } catch (err: any) {
      toast({ title: "Couldn't replace", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setReplacingId(null);
    }
  }

  function startEdit(msg: MilestoneMessage) {
    setEditingId(msg.id);
    setEditingBody(msg.body ?? "");
  }
  function cancelEdit() {
    setEditingId(null);
    setEditingBody("");
  }
  async function saveEdit(msg: MilestoneMessage) {
    if (!msgMilestone) return;
    const next = editingBody.trim();
    if (next === (msg.body ?? "").trim()) { cancelEdit(); return; }
    setEditSaving(true);
    try {
      const { error } = await supabase.from("milestone_messages")
        .update({ body: next.length ? next : null, edited_at: new Date().toISOString() })
        .eq("id", msg.id);
      if (error) throw error;
      cancelEdit();
      await loadMessages(msgMilestone.id);
    } catch (err: any) {
      toast({ title: "Couldn't save edit", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  }
  async function deleteMessage(msg: MilestoneMessage) {
    if (!msgMilestone) return;
    if (!confirm("Delete this message? This can't be undone.")) return;
    setDeletingId(msg.id);
    try {
      if (msg.attachment_path) {
        await supabase.storage.from("milestone-attachments").remove([msg.attachment_path]);
      }
      const { error } = await supabase.from("milestone_messages").delete().eq("id", msg.id);
      if (error) throw error;
      await loadMessages(msgMilestone.id);
    } catch (err: any) {
      toast({ title: "Couldn't delete", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  async function uploadCaption(msg: MilestoneMessage, file: File) {
    if (!msgMilestone || !activeProject) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".vtt") && !name.endsWith(".srt") && file.type !== "text/vtt") {
      toast({ title: "Unsupported file", description: "Upload a .vtt or .srt caption file.", variant: "destructive" });
      return;
    }
    if (file.size > 512 * 1024) {
      toast({ title: "Too large", description: "Caption files must be under 512 KB.", variant: "destructive" });
      return;
    }
    setCaptionBusyId(msg.id);
    try {
      let text = await file.text();
      // Auto-convert SRT to a minimal VTT so the player can render it.
      if (name.endsWith(".srt")) {
        text = "WEBVTT\n\n" + text.replace(/\r/g, "").replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, "$1.$2");
      }
      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
      const path = `${activeProject.id}/${msgMilestone.id}/captions/${crypto.randomUUID()}-${safeName.replace(/\.srt$/i, ".vtt")}`;
      const blob = new Blob([text], { type: "text/vtt" });
      const { error: upErr } = await supabase.storage
        .from("milestone-attachments")
        .upload(path, blob, { contentType: "text/vtt", upsert: false });
      if (upErr) throw upErr;

      const { error: updErr } = await supabase.from("milestone_messages")
        .update({ caption_path: path, caption_name: file.name, caption_mime: "text/vtt" })
        .eq("id", msg.id);
      if (updErr) {
        await supabase.storage.from("milestone-attachments").remove([path]);
        throw updErr;
      }
      if (msg.caption_path) {
        await supabase.storage.from("milestone-attachments").remove([msg.caption_path]);
      }
      toast({ title: "Captions added" });
      await loadMessages(msgMilestone.id);
    } catch (err: any) {
      toast({ title: "Couldn't add captions", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setCaptionBusyId(null);
    }
  }

  async function removeCaption(msg: MilestoneMessage) {
    if (!msgMilestone) return;
    setCaptionBusyId(msg.id);
    try {
      if (msg.caption_path) {
        await supabase.storage.from("milestone-attachments").remove([msg.caption_path]);
      }
      const { error } = await supabase.from("milestone_messages")
        .update({ caption_path: null, caption_name: null, caption_mime: null })
        .eq("id", msg.id);
      if (error) throw error;
      await loadMessages(msgMilestone.id);
    } catch (err: any) {
      toast({ title: "Couldn't remove captions", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setCaptionBusyId(null);
    }
  }


  const loadData = useCallback(async (uid: string) => {
    // projects via membership
    const { data: memberRows } = await supabase
      .from("project_clients")
      .select("project_id")
      .eq("user_id", uid);
    const ids = (memberRows ?? []).map(r => r.project_id);
    if (ids.length === 0) {
      setProjects([]); setActiveProject(null); setRequests([]); setNextMilestone(null);
      return;
    }
    const { data: projRows } = await supabase
      .from("projects")
      .select("id,title,status,credit_balance,dollar_balance_cents,active_tier_slug")
      .in("id", ids)
      .order("updated_at", { ascending: false });
    const list = (projRows ?? []) as Project[];
    setProjects(list);
    const active = list.find(p => p.status === "active") ?? list[0] ?? null;
    setActiveProject(active);

    if (active) {
      const { data: ms } = await supabase
        .from("project_milestones")
        .select("id,title,due_date,status")
        .eq("project_id", active.id)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(8);
      const arr = (ms ?? []) as Milestone[];
      setMilestones(arr);
      setNextMilestone(arr.find(m => m.status !== "approved") ?? null);
    } else {
      setMilestones([]);
    }

    const { data: reqs } = await supabase
      .from("credit_requests")
      .select("id,title,status,estimated_credits,final_credits,created_at")
      .eq("requested_by", uid)
      .order("created_at", { ascending: false })
      .limit(8);
    setRequests((reqs ?? []) as CreditRequest[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const u = data.session?.user;
      setUserEmail(u?.email ?? null);
      if (u) loadData(u.id).finally(() => !cancelled && setLoading(false));
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setUserEmail(u?.email ?? null);
      if (u) loadData(u.id);
      else { setProjects([]); setActiveProject(null); setRequests([]); }
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [loadData]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setAuthBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/start.html` },
        });
        if (error) throw error;
        toast({ title: "Account created", description: "Check your email if confirmation is required." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      setPassword("");
    } catch (err: any) {
      toast({ title: "Couldn't sign you in", description: err.message ?? String(err), variant: "destructive" });
    } finally { setAuthBusy(false); }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function requestMilestoneReview(m: Milestone) {
    if (!activeProject) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("credit_requests").insert({
        title: `Review request: ${m.title}`,
        description: `Please review milestone "${m.title}"${m.due_date ? ` (due ${new Date(m.due_date).toLocaleDateString()})` : ""}.`,
        requested_credits: 0,
        project_id: activeProject.id,
        requested_by: user.id,
        status: "pending_team",
      });
      if (error) throw error;
      toast({ title: "Review requested", description: "Your team has been notified." });
      await loadData(user.id);
    } catch (err: any) {
      toast({ title: "Couldn't send request", description: err.message ?? String(err), variant: "destructive" });
    }
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!reqTitle.trim()) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("credit_requests").insert({
        title: reqTitle.trim(),
        description: reqDesc.trim() || null,
        requested_credits: reqCredits ? parseInt(reqCredits, 10) : 1,
        project_id: activeProject?.id ?? null,
        requested_by: user.id,
        status: "pending_team",
      });
      if (error) throw error;
      toast({ title: "Request submitted", description: "Our team will review it shortly." });
      setReqTitle(""); setReqDesc(""); setReqCredits("");
      await loadData(user.id);
    } catch (err: any) {
      toast({ title: "Couldn't submit", description: err.message ?? String(err), variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
        Loading your dashboard…
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-5 text-left">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Client portal</div>
          <h3 className="text-xl md:text-2xl font-semibold mt-1">Sign in to your dashboard</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Track credits, see your active project, and request new work.
          </p>
        </div>
        <form onSubmit={handleAuth} className="space-y-3 max-w-sm">
          <div className="space-y-1.5">
            <Label htmlFor="cd-email" className="text-xs uppercase tracking-wider">Email</Label>
            <Input id="cd-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-pass" className="text-xs uppercase tracking-wider">Password</Label>
            <Input id="cd-pass" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={authBusy} className="w-full">
            {authBusy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
          <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">
            {mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    );
  }

  const credits = activeProject?.credit_balance ?? 0;
  const dollars = activeProject?.dollar_balance_cents ?? 0;

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Your dashboard</div>
          <div className="text-sm font-medium mt-0.5 truncate max-w-[70vw] sm:max-w-none">{userEmail}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-xs shrink-0">
          <LogOut size={12} className="mr-1" /> Sign out
        </Button>
      </div>

      {!activeProject ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-4 sm:p-6 text-sm text-muted-foreground">
          You don't have an active project yet. Pick a subscription tier or scope a project above to get started — your project ledger appears here the moment you book.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <Wallet size={13} /> Balance
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <div className="text-2xl sm:text-3xl font-semibold">{credits}</div>
              <div className="text-xs text-muted-foreground">credit{credits === 1 ? "" : "s"}</div>
            </div>
            <div className="text-sm text-muted-foreground">{fmtMoney(dollars)} on account</div>
            {activeProject.active_tier_slug && (
              <div className="text-xs"><span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium uppercase tracking-wider">{activeProject.active_tier_slug}</span> tier</div>
            )}
            <a href="#tiers" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-4">
              <Plus size={11} /> Top up credits
            </a>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <FolderOpen size={13} /> Active project
            </div>
            <div className="text-base sm:text-lg font-semibold leading-tight break-words">{activeProject.title}</div>
            <div className="text-xs">
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium uppercase tracking-wider">{activeProject.status}</span>
            </div>
            {nextMilestone ? (
              <div className="text-sm text-muted-foreground">
                Next: <span className="text-foreground font-medium">{nextMilestone.title}</span>
                {nextMilestone.due_date && <> · due {new Date(nextMilestone.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</>}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No upcoming milestones.</div>
            )}
            <a href={`/team.html#/portal/${activeProject.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-4">
              Open project portal <ExternalLink size={11} />
            </a>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <Clock size={13} /> Milestones
            </div>
            {milestones.length === 0 ? (
              <div className="text-sm text-muted-foreground">No milestones yet.</div>
            ) : (
              <ol className="relative space-y-2 sm:space-y-1.5 before:absolute before:left-[6px] before:top-1 before:bottom-1 before:w-px before:bg-border sm:before:hidden">
                {milestones.slice(0, 6).map(m => {
                  const done = m.status === "approved";
                  return (
                    <li key={m.id} className="relative pl-5 sm:pl-0 sm:flex sm:items-start sm:gap-2 text-sm">
                      <span className="absolute left-0 top-1 sm:static sm:mt-0.5 sm:shrink-0">
                        {done
                          ? <CheckCircle2 size={14} className="text-emerald-500" />
                          : <Circle size={14} className="text-muted-foreground" />}
                      </span>
                      <div className="min-w-0 flex-1 rounded-lg sm:rounded-none border sm:border-0 border-border bg-background/40 sm:bg-transparent p-2 sm:p-0">
                        <div className={`text-sm leading-snug break-words ${done ? "text-muted-foreground line-through" : "text-foreground font-medium sm:font-normal"}`}>{m.title}</div>
                        {m.due_date && <div className="text-[11px] text-muted-foreground mt-0.5">due {new Date(m.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>}
                        <div className="mt-2 sm:mt-1.5 flex flex-wrap items-center gap-1">
                          <a
                            href={`/team.html#/portal/${activeProject.id}?milestone=${m.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
                            title="View milestone details"
                          >
                            <Eye size={10} /> Details
                          </a>
                          <button
                            type="button"
                            onClick={() => openMessageTeam(m)}
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
                            title="Message your team about this milestone"
                          >
                            <MessageSquare size={10} /> Message team
                          </button>
                          {!done && (
                            <button
                              type="button"
                              onClick={() => requestMilestoneReview(m)}
                              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
                              title="Ask the team to review this milestone"
                            >
                              <Flag size={10} /> Request review
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">All projects</div>
            <span className="text-[11px] text-muted-foreground">{projects.length} linked</span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {projects.map(p => (
              <li key={p.id}>
                <a
                  href={`/team.html#/portal/${p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block rounded-xl border p-3 hover:border-foreground/50 transition-colors ${p.id === activeProject?.id ? "border-primary/60 bg-primary/5" : "border-border bg-background/40"}`}
                >
                  <div className="text-sm font-medium truncate">{p.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="uppercase tracking-wider">{p.status}</span>
                    <span>·</span>
                    <span>{p.credit_balance ?? 0} cr</span>
                    <span>·</span>
                    <span>{fmtMoney(p.dollar_balance_cents)}</span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submitRequest} className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Request new work</div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <Input placeholder="Short title (e.g. Mix v2 of Holy Water)" value={reqTitle} onChange={e => setReqTitle(e.target.value)} required />
          <Input type="number" min={1} placeholder="Est. credits" value={reqCredits} onChange={e => setReqCredits(e.target.value)} className="sm:w-32" />
        </div>
        <Textarea placeholder="What do you need? Links, references, deadlines…" value={reqDesc} onChange={e => setReqDesc(e.target.value)} rows={3} />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-muted-foreground sm:flex-1">Our team reviews requests and replies with an estimate before any credits are spent.</p>
          <Button type="submit" disabled={submitting || !reqTitle.trim()} className="w-full sm:w-auto">
            {submitting ? "Submitting…" : <>Submit request <ArrowRight size={14} className="ml-1" /></>}
          </Button>
        </div>
      </form>

      {requests.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Recent requests</div>
          <ul className="divide-y divide-border">
            {requests.map(r => (
              <li key={r.id} className="py-2.5 flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {(r.final_credits ?? r.estimated_credits) != null && (
                    <span className="text-[11px] text-muted-foreground">{r.final_credits ?? r.estimated_credits} cr</span>
                  )}
                  <span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 font-medium ${statusClass(r.status)}`}>{r.status.replace(/_/g, " ")}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <a href="/team.html#/portal" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">
        Open full client portal <ExternalLink size={11} />
      </a>

      <Dialog open={!!msgMilestone} onOpenChange={(o) => { if (!o) setMsgMilestone(null); }}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="p-4 sm:p-5 border-b border-border space-y-1">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Milestone thread</div>
            <DialogTitle className="text-base sm:text-lg leading-tight pr-6">{msgMilestone?.title}</DialogTitle>
            <DialogDescription className="text-xs">
              Send updates to your team. They'll see your messages in the project portal.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-[220px] max-h-[50vh]">
            <div className="p-4 sm:p-5 space-y-3">
              {msgLoading ? (
                <div className="text-xs text-muted-foreground">Loading thread…</div>
              ) : msgList.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No messages yet. Start the conversation below.
                </div>
              ) : (
                msgList.map(msg => {
                  const mine = msg.author_id === msgUserId;
                  const signed = msg.attachment_path ? signedUrls[msg.attachment_path] : null;
                  const mime = msg.attachment_mime ?? "";
                  const isImage = mime.startsWith("image/");
                  const isAudio = mime.startsWith("audio/");
                  const isPdf = mime === "application/pdf";
                  const canEdit = mine || false;
                  const actionBtn = (extra: string) =>
                    `inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${extra} ${mine ? "border-primary-foreground/30 text-primary-foreground/80 hover:bg-primary-foreground/10" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"}`;
                  const AttachmentActions = signed ? (
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      <button type="button" onClick={() => downloadAttachment(msg)} className={actionBtn("")} title="Download file">
                        <Download size={10} /> Download
                      </button>
                      <button type="button" onClick={() => copyAttachmentLink(msg)} className={actionBtn("")} title="Copy shareable link (7 days)">
                        <Copy size={10} /> Copy link
                      </button>
                      {canEdit && (
                        <label className={actionBtn("cursor-pointer")} title="Replace this file">
                          <RefreshCw size={10} className={replacingId === msg.id ? "animate-spin" : ""} />
                          {replacingId === msg.id ? "Replacing…" : "Replace"}
                          <input
                            type="file"
                            accept="image/*,application/pdf,audio/*"
                            className="hidden"
                            disabled={replacingId === msg.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) replaceAttachment(msg, f);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                  ) : null;
                  return (
                    <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm space-y-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                        {editingId === msg.id ? (
                          <div className="space-y-1.5">
                            <Textarea
                              value={editingBody}
                              onChange={(e) => setEditingBody(e.target.value)}
                              rows={3}
                              className="text-sm bg-background text-foreground"
                              autoFocus
                            />
                            <div className="flex gap-1.5 justify-end">
                              <button type="button" onClick={cancelEdit} disabled={editSaving} className={actionBtn("")}>
                                <X size={10} /> Cancel
                              </button>
                              <button type="button" onClick={() => saveEdit(msg)} disabled={editSaving} className={actionBtn("")}>
                                <Check size={10} /> {editSaving ? "Saving…" : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          msg.body && <div className="whitespace-pre-wrap break-words">{msg.body}</div>
                        )}
                        {signed && isImage && (
                          <div className="space-y-1">
                            <a href={signed} target="_blank" rel="noreferrer" className="block">
                              <img src={signed} alt={msg.attachment_name ?? "attachment"} className="rounded-lg max-h-64 w-auto" />
                            </a>
                            {AttachmentActions}
                          </div>
                        )}
                        {signed && isAudio && (
                          <div className="space-y-1">
                            <AudioMessagePlayer
                              src={signed}
                              captionsUrl={msg.caption_path ? signedUrls[msg.caption_path] ?? null : null}
                              mine={mine}
                            />
                            {mine && (
                              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                <label className={actionBtn("cursor-pointer")} title="Attach captions (.vtt or .srt)">
                                  <Captions size={10} />
                                  {captionBusyId === msg.id ? "Working…" : msg.caption_path ? "Replace CC" : "Add captions"}
                                  <input
                                    type="file"
                                    accept=".vtt,.srt,text/vtt"
                                    className="hidden"
                                    disabled={captionBusyId === msg.id}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) uploadCaption(msg, f);
                                      e.currentTarget.value = "";
                                    }}
                                  />
                                </label>
                                {msg.caption_path && (
                                  <button
                                    type="button"
                                    onClick={() => removeCaption(msg)}
                                    disabled={captionBusyId === msg.id}
                                    className={actionBtn("")}
                                    title="Remove captions"
                                  >
                                    <X size={10} /> CC off
                                  </button>
                                )}
                              </div>
                            )}
                            {AttachmentActions}
                          </div>
                        )}
                        {signed && isPdf && (
                          <div className="space-y-1">
                            <a href={signed} target="_blank" rel="noreferrer"
                               className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${mine ? "border-primary-foreground/30 hover:bg-primary-foreground/10" : "border-border hover:bg-background/60"}`}>
                              <FileText size={14} />
                              <span className="truncate max-w-[180px]">{msg.attachment_name ?? "Document.pdf"}</span>
                              <ExternalLink size={11} />
                            </a>
                            {AttachmentActions}
                          </div>
                        )}
                        {signed && !isImage && !isAudio && !isPdf && (
                          <div className="space-y-1">
                            <a href={signed} target="_blank" rel="noreferrer"
                               className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${mine ? "border-primary-foreground/30 hover:bg-primary-foreground/10" : "border-border hover:bg-background/60"}`}>
                              <Paperclip size={13} />
                              <span className="truncate max-w-[180px]">{msg.attachment_name ?? "Attachment"}</span>
                              <ExternalLink size={11} />
                            </a>
                            {AttachmentActions}
                          </div>
                        )}
                        {msg.embed_url && (
                          toEmbedUrl(msg.embed_url)
                            ? <div className="rounded-lg overflow-hidden bg-background text-foreground"><EmbedPreview url={msg.embed_url} height={280} /></div>
                            : <a href={msg.embed_url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-xs underline underline-offset-2 ${mine ? "" : "text-primary"}`}><Link2 size={12} /> {msg.embed_url}</a>
                        )}
                        <div className={`flex items-center justify-between gap-2 text-[10px] mt-1 opacity-80 ${mine ? "text-primary-foreground" : "text-muted-foreground"}`}>
                          <span>
                            {new Date(msg.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            {msg.edited_at && (
                              <span
                                className="ml-1 italic"
                                title={`Edited ${new Date(msg.edited_at).toLocaleString()}`}
                              >
                                (edited)
                              </span>
                            )}
                          </span>
                          {mine && editingId !== msg.id && (
                            <span className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(msg)}
                                className={actionBtn("")}
                                title="Edit message"
                              >
                                <Pencil size={10} /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteMessage(msg)}
                                disabled={deletingId === msg.id}
                                className={actionBtn("")}
                                title="Delete message"
                              >
                                <Trash2 size={10} /> {deletingId === msg.id ? "Deleting…" : "Delete"}
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <form onSubmit={sendMessage} className="border-t border-border p-3 sm:p-4 space-y-2">
            {msgFile && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-xs">
                {msgFile.type.startsWith("image/") ? <ImageIcon size={13} />
                  : msgFile.type.startsWith("audio/") ? <Music size={13} />
                  : msgFile.type === "application/pdf" ? <FileText size={13} />
                  : <Paperclip size={13} />}
                <span className="truncate flex-1">{msgFile.name}</span>
                <span className="text-muted-foreground shrink-0">{(msgFile.size / 1024).toFixed(0)} KB</span>
                <button type="button" onClick={() => setMsgFile(null)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Remove attachment">
                  <X size={13} />
                </button>
              </div>
            )}
            {showEmbed && (
              <div className="flex items-center gap-2">
                <Link2 size={14} className="text-muted-foreground shrink-0" />
                <Input
                  type="url"
                  value={msgEmbed}
                  onChange={(e) => setMsgEmbed(e.target.value)}
                  placeholder="Paste a Google Drive, Docs, YouTube, or Loom link"
                  className="h-9 text-xs"
                />
                <button type="button" onClick={() => { setShowEmbed(false); setMsgEmbed(""); }} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Cancel link">
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <Textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder="Write a message to your team…"
                rows={2}
                className="resize-none min-h-[44px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    sendMessage(e as any);
                  }
                }}
              />
              <div className="flex flex-col gap-1 shrink-0">
                <label className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border cursor-pointer text-muted-foreground hover:text-foreground hover:border-foreground/40" title="Attach image, PDF, or audio">
                  <Paperclip size={14} />
                  <input
                    type="file"
                    accept="image/*,application/pdf,audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setMsgFile(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setShowEmbed(v => !v)}
                  className={`inline-flex items-center justify-center h-8 w-8 rounded-md border ${showEmbed ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"}`}
                  title="Embed a Google Drive or link"
                >
                  <Link2 size={14} />
                </button>
              </div>
              <Button
                type="submit"
                disabled={msgSending || (!msgBody.trim() && !msgFile && !(showEmbed && msgEmbed.trim()))}
                size="icon"
                className="shrink-0 h-11 w-11"
              >
                <Send size={16} />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Attach images, PDFs, or audio (25 MB max) — or paste a Google Drive link to embed.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function statusClass(s: string) {
  switch (s) {
    case "accepted": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "completed": return "bg-emerald-600/20 text-emerald-800 dark:text-emerald-200";
    case "rejected":
    case "cancelled": return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "client_review": return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "pending_team":
    default: return "bg-muted text-muted-foreground";
  }
}