import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ArrowRight, LogOut, Wallet, FolderOpen, Plus, ExternalLink, CheckCircle2, Circle, Clock, Eye, MessageSquare, Flag, Send, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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

  const loadMessages = useCallback(async (milestoneId: string) => {
    setMsgLoading(true);
    const { data, error } = await supabase
      .from("milestone_messages")
      .select("id,body,author_id,created_at")
      .eq("milestone_id", milestoneId)
      .order("created_at", { ascending: true });
    if (!error) setMsgList((data ?? []) as MilestoneMessage[]);
    setMsgLoading(false);
  }, []);

  async function openMessageTeam(m: Milestone) {
    setMsgMilestone(m);
    setMsgList([]);
    setMsgBody("");
    const { data: { user } } = await supabase.auth.getUser();
    setMsgUserId(user?.id ?? null);
    await loadMessages(m.id);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!msgMilestone || !msgBody.trim() || !activeProject) return;
    setMsgSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("milestone_messages").insert({
        milestone_id: msgMilestone.id,
        project_id: activeProject.id,
        author_id: user.id,
        body: msgBody.trim(),
      });
      if (error) throw error;
      setMsgBody("");
      await loadMessages(msgMilestone.id);
    } catch (err: any) {
      toast({ title: "Couldn't send", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setMsgSending(false);
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