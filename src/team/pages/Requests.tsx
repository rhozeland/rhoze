import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Check, X, Sparkles, ExternalLink } from "lucide-react";
import { formatDate } from "../lib/format";

/**
 * Team-side queue of credit requests submitted by clients.
 * Team accepts with an estimate -> moves to client_review.
 * Or rejects with a note.
 */
export default function Requests() {
  const qc = useQueryClient();
  const [acceptOpen, setAcceptOpen] = useState<string | null>(null);
  const [acceptForm, setAcceptForm] = useState({ estimated_credits: "", team_notes: "" });
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data: requests } = useQuery({
    queryKey: ["team_credit_requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_requests")
        .select("*, projects(title, client_name, credit_balance)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const accept = useMutation({
    mutationFn: async ({ id, est, notes }: { id: string; est: number; notes: string }) => {
      const { error } = await supabase.rpc("credit_request_team_accept", {
        _request_id: id,
        _estimated_credits: est,
        _team_notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Sent to client for approval" });
      setAcceptOpen(null);
      setAcceptForm({ estimated_credits: "", team_notes: "" });
      qc.invalidateQueries({ queryKey: ["team_credit_requests"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.rpc("credit_request_team_reject", { _request_id: id, _team_notes: notes || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Request rejected" });
      setRejectOpen(null);
      setRejectNote("");
      qc.invalidateQueries({ queryKey: ["team_credit_requests"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const complete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("credit_request_complete", { _request_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Marked complete" });
      qc.invalidateQueries({ queryKey: ["team_credit_requests"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const open = (requests ?? []).filter((r: any) => ["pending_team", "client_review", "accepted"].includes(r.status));
  const closed = (requests ?? []).filter((r: any) => !["pending_team", "client_review", "accepted"].includes(r.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Credit requests</h1>
        <p className="text-sm text-muted-foreground">Review one-off work clients want to spend their credits on.</p>
      </div>

      <Section title="Open" items={open}>
        {(r: any) => (
          <RowActions
            request={r}
            onAccept={() => {
              setAcceptForm({ estimated_credits: String(r.requested_credits || 1), team_notes: "" });
              setAcceptOpen(r.id);
            }}
            onReject={() => setRejectOpen(r.id)}
            onComplete={() => complete.mutate(r.id)}
          />
        )}
      </Section>

      <Section title="Closed" items={closed} emptyText="No closed requests." />

      <Dialog open={!!acceptOpen} onOpenChange={(o) => !o && setAcceptOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Accept with estimate</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Credit estimate</Label>
              <Input
                type="number"
                min={1}
                value={acceptForm.estimated_credits}
                onChange={(e) => setAcceptForm({ ...acceptForm, estimated_credits: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">Client must approve this estimate before any credits are deducted.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Notes for client</Label>
              <Textarea
                rows={3}
                value={acceptForm.team_notes}
                onChange={(e) => setAcceptForm({ ...acceptForm, team_notes: e.target.value })}
                placeholder="Scope, timeline, assumptions…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                acceptOpen &&
                accept.mutate({
                  id: acceptOpen,
                  est: parseInt(acceptForm.estimated_credits || "0", 10),
                  notes: acceptForm.team_notes,
                })
              }
              disabled={accept.isPending}
            >
              Send to client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectOpen} onOpenChange={(o) => !o && setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Textarea rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => rejectOpen && reject.mutate({ id: rejectOpen, notes: rejectNote })}
              disabled={reject.isPending}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({
  title,
  items,
  emptyText,
  children,
}: {
  title: string;
  items: any[];
  emptyText?: string;
  children?: (r: any) => React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">
          {emptyText ?? "Nothing here."}
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-card">
          {items.map((r) => (
            <li key={r.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {r.title}
                    <Pill status={r.status} />
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.project_id ? (
                      <Link to={`/projects/${r.project_id}`} className="underline inline-flex items-center gap-1">
                        {r.projects?.title || "project"} <ExternalLink size={10} />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase tracking-wider text-[9px]">
                        New project: {r.proposed_project_title || r.title}
                      </span>
                    )}
                    {r.projects?.client_name && <>{" · "}{r.projects.client_name}</>}
                    {" · "}requested {formatDate(r.created_at)}
                    {" · "}<span className="tabular-nums">{r.estimated_credits ?? r.requested_credits} cr</span>
                    {r.project_id && <>{" · balance "}<span className="tabular-nums">{r.projects?.credit_balance ?? 0} cr</span></>}
                  </div>
                </div>
              </div>
              {r.description && <div className="text-xs text-muted-foreground whitespace-pre-wrap">{r.description}</div>}
              {r.team_notes && (
                <div className="text-xs rounded-md bg-muted/40 px-2 py-1.5">Team note: {r.team_notes}</div>
              )}
              {children && children(r)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RowActions({
  request,
  onAccept,
  onReject,
  onComplete,
}: {
  request: any;
  onAccept: () => void;
  onReject: () => void;
  onComplete: () => void;
}) {
  if (request.status === "pending_team") {
    return (
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" onClick={onAccept}>
          <Check size={12} className="mr-1" /> Accept with estimate
        </Button>
        <Button size="sm" variant="outline" onClick={onReject}>
          <X size={12} className="mr-1" /> Reject
        </Button>
      </div>
    );
  }
  if (request.status === "client_review") {
    return <div className="text-[11px] text-muted-foreground italic">Waiting on client approval…</div>;
  }
  if (request.status === "accepted") {
    return (
      <Button size="sm" variant="outline" onClick={onComplete}>
        <Check size={12} className="mr-1" /> Mark complete
      </Button>
    );
  }
  return null;
}

function Pill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending_team: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    client_review: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    accepted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
    cancelled: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${map[status] ?? ""}`}>
      <Sparkles size={9} /> {status.replace("_", " ")}
    </span>
  );
}