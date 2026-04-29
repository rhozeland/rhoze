import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  Search, Plus, X, Instagram, DollarSign, Users as UsersIcon,
  MessageCircle, ExternalLink, Tag, Trash2, ChevronDown, Check,
} from "lucide-react";

type Contact = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  type: "lead" | "client" | "partner" | "vendor";
  source: string;
  ig_handle: string | null;
  lifetime_spend_cents: number;
  transaction_count: number;
  first_visit: string | null;
  last_visit: string | null;
  notes: string | null;
  tags: string[];
  relationship_status: string | null;
};

type Thread = {
  id: string;
  handle: string;
  profile_link: string | null;
  status: string | null;
  total_messages: number;
  their_replies: number;
  key_topics: string | null;
  last_message_date: string | null;
  snippet: string | null;
  is_follower: boolean;
  follows_us: boolean;
  pending_request: boolean;
  has_dm_history: boolean;
  commenter: boolean;
  notes: string | null;
  contact_id: string | null;
};

type View =
  | "all-clients"
  | "square"
  | "ig-active"
  | "ig-inbound"
  | "ig-cold"
  | "ig-leads";

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "all-clients", label: "All people", hint: "Square + manual" },
  { id: "square", label: "Square clients", hint: "Paying customers" },
  { id: "ig-active", label: "IG · active", hint: "Live conversations" },
  { id: "ig-inbound", label: "IG · inbound", hint: "They reached out" },
  { id: "ig-cold", label: "IG · cold", hint: "Sent, no reply" },
  { id: "ig-leads", label: "IG · leads", hint: "Followers & pending" },
];

function fmtMoney(c: number) {
  return (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  } catch {
    return "—";
  }
}

export default function CRM() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [view, setView] = useState<View>("square");
  const [search, setSearch] = useState("");
  const [openThread, setOpenThread] = useState<Thread | null>(null);
  const [adding, setAdding] = useState(false);
  // Live toggle filters (IG views only)
  const [flagFilters, setFlagFilters] = useState<{
    follower: boolean; mutual: boolean; pending: boolean; commenter: boolean; dm: boolean;
  }>({ follower: false, mutual: false, pending: false, commenter: false, dm: false });
  const [hasNotes, setHasNotes] = useState(false);

  const contactsQ = useQuery({
    queryKey: ["crm-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("lifetime_spend_cents", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });

  const threadsQ = useQuery({
    queryKey: ["crm-threads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ig_threads")
        .select("*")
        .order("last_message_date", { ascending: false, nullsFirst: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Thread[];
    },
  });

  const showThreads = view.startsWith("ig-");
  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = threadsQ.data ?? [];
    if (view === "ig-active") list = list.filter((t) => t.status === "Active Conversation");
    else if (view === "ig-inbound") list = list.filter((t) => t.status?.startsWith("Inbound"));
    else if (view === "ig-cold") list = list.filter((t) => t.status?.startsWith("Cold"));
    else if (view === "ig-leads") list = list.filter((t) => !t.status); // leads-only (no convo)
    if (flagFilters.follower) list = list.filter((t) => t.is_follower);
    if (flagFilters.mutual) list = list.filter((t) => t.follows_us);
    if (flagFilters.pending) list = list.filter((t) => t.pending_request);
    if (flagFilters.commenter) list = list.filter((t) => t.commenter);
    if (flagFilters.dm) list = list.filter((t) => t.has_dm_history);
    if (hasNotes) list = list.filter((t) => (t.notes ?? "").trim().length > 0);
    if (q) list = list.filter((t) => t.handle.includes(q) || (t.key_topics ?? "").toLowerCase().includes(q));
    return list;
  }, [threadsQ.data, view, search, flagFilters, hasNotes]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = contactsQ.data ?? [];
    if (view === "square") list = list.filter((c) => c.source === "square");
    if (q)
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.company ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q),
      );
    return list;
  }, [contactsQ.data, view, search]);

  // Stats strip
  const stats = useMemo(() => {
    const cs = contactsQ.data ?? [];
    const ts = threadsQ.data ?? [];
    const totalSpend = cs.reduce((s, c) => s + (c.lifetime_spend_cents || 0), 0);
    const active = ts.filter((t) => t.status === "Active Conversation").length;
    const inbound = ts.filter((t) => t.status?.startsWith("Inbound")).length;
    return { clients: cs.length, totalSpend, igLeads: ts.length, active, inbound };
  }, [contactsQ.data, threadsQ.data]);

  const updateContact = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Contact> }) => {
      const { error } = await supabase.from("contacts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-contacts"] }),
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const updateThread = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Thread> }) => {
      const { error } = await supabase.from("ig_threads").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-threads"] });
      if (openThread) {
        // refresh open thread
        supabase.from("ig_threads").select("*").eq("id", openThread.id).maybeSingle().then(({ data }) => {
          if (data) setOpenThread(data as Thread);
        });
      }
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const addContact = useMutation({
    mutationFn: async (name: string) => {
      if (!name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("contacts").insert({
        name: name.trim(),
        type: "lead",
        source: "manual",
        owner_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-contacts"] });
      setAdding(false);
      toast({ title: "Added" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-contacts"] }),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">CRM</h1>
          <p className="text-sm text-muted-foreground">
            Square clients & Instagram leads — one workspace, edited in place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, handle, topic…"
              className="pl-9 w-72"
            />
          </div>
          {!showThreads && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus size={14} /> New
            </Button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat icon={<UsersIcon size={14} />} label="Clients" value={String(stats.clients)} />
        <Stat icon={<DollarSign size={14} />} label="Lifetime spend" value={fmtMoney(stats.totalSpend)} />
        <Stat icon={<Instagram size={14} />} label="IG records" value={String(stats.igLeads)} />
        <Stat icon={<MessageCircle size={14} />} label="Active chats" value={String(stats.active)} accent />
        <Stat icon={<MessageCircle size={14} />} label="Inbound waiting" value={String(stats.inbound)} accent />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto -mx-1 px-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={cn(
              "px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition flex flex-col items-start",
              view === v.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="font-medium">{v.label}</span>
            <span className="text-[10px] text-muted-foreground">{v.hint}</span>
          </button>
        ))}
      </div>

      {/* Live filter chips (IG views only) */}
      {showThreads && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground mr-1">Filter:</span>
          <Chip on={flagFilters.follower} onClick={() => setFlagFilters((f) => ({ ...f, follower: !f.follower }))}>Follower</Chip>
          <Chip on={flagFilters.mutual} onClick={() => setFlagFilters((f) => ({ ...f, mutual: !f.mutual }))}>Mutual</Chip>
          <Chip on={flagFilters.pending} onClick={() => setFlagFilters((f) => ({ ...f, pending: !f.pending }))}>Pending</Chip>
          <Chip on={flagFilters.commenter} onClick={() => setFlagFilters((f) => ({ ...f, commenter: !f.commenter }))}>Commenter</Chip>
          <Chip on={flagFilters.dm} onClick={() => setFlagFilters((f) => ({ ...f, dm: !f.dm }))}>DM history</Chip>
          <Chip on={hasNotes} onClick={() => setHasNotes((v) => !v)}>Has notes</Chip>
          {(Object.values(flagFilters).some(Boolean) || hasNotes) && (
            <button
              onClick={() => { setFlagFilters({ follower: false, mutual: false, pending: false, commenter: false, dm: false }); setHasNotes(false); }}
              className="text-muted-foreground hover:text-foreground underline ml-1"
            >
              Clear
            </button>
          )}
          <span className="ml-auto text-muted-foreground tabular-nums">{filteredThreads.length} shown</span>
        </div>
      )}

      {/* Add inline */}
      {adding && !showThreads && (
        <InlineAdd onSave={(n) => addContact.mutate(n)} onCancel={() => setAdding(false)} />
      )}

      {/* Tables — horizontal scroll wrapper to prevent column clipping */}
      <div className="border border-border rounded-lg bg-card overflow-x-auto">
        {showThreads ? (
          <ThreadTable
            threads={filteredThreads}
            loading={threadsQ.isLoading}
            onOpen={setOpenThread}
            onUpdate={(id, patch) => updateThread.mutate({ id, patch })}
          />
        ) : (
          <ContactTable
            contacts={filteredContacts}
            loading={contactsQ.isLoading}
            onUpdate={(id, patch) => updateContact.mutate({ id, patch })}
            onDelete={(id) => deleteContact.mutate(id)}
          />
        )}
      </div>

      {/* Side drawer for IG context */}
      {openThread && (
        <ThreadDrawer
          thread={openThread}
          onClose={() => setOpenThread(null)}
          onUpdate={(patch) => updateThread.mutate({ id: openThread.id, patch })}
        />
      )}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs transition",
        on
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40",
      )}
    >
      {on && <Check size={11} />} {children}
    </button>
  );
}

function Stat({
  icon, label, value, accent,
}: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3 flex items-center gap-3",
        accent && "bg-primary/5 border-primary/30",
      )}
    >
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function InlineAdd({ onSave, onCancel }: { onSave: (n: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  return (
    <div className="flex items-center gap-2 p-2 rounded-md border border-dashed border-border bg-muted/30">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) onSave(name);
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Type a name and press Enter…"
      />
      <Button size="sm" onClick={() => name.trim() && onSave(name)}>Save</Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

/* ─────────────────────────── Contacts table ─────────────────────────── */

function ContactTable({
  contacts, loading, onUpdate, onDelete,
}: {
  contacts: Contact[];
  loading: boolean;
  onUpdate: (id: string, patch: Partial<Contact>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
        <tr>
          <th className="px-3 py-2">Name</th>
          <th className="px-3 py-2">Company</th>
          <th className="px-3 py-2">Email</th>
          <th className="px-3 py-2">Phone</th>
          <th className="px-3 py-2 text-right">Lifetime</th>
          <th className="px-3 py-2 text-right">Tx</th>
          <th className="px-3 py-2">Last visit</th>
          <th className="px-3 py-2 w-64">Notes</th>
          <th className="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {loading && (
          <tr><td colSpan={9} className="px-3 py-6 text-muted-foreground">Loading…</td></tr>
        )}
        {!loading && contacts.length === 0 && (
          <tr><td colSpan={9} className="px-3 py-6 text-muted-foreground">No matches.</td></tr>
        )}
        {contacts.map((c) => (
          <tr key={c.id} className="border-t border-border hover:bg-muted/30 group">
            <td className="px-3 py-2 font-medium">
              <EditableCell value={c.name} onSave={(v) => onUpdate(c.id, { name: v })} />
            </td>
            <td className="px-3 py-2 text-muted-foreground">
              <EditableCell value={c.company ?? ""} onSave={(v) => onUpdate(c.id, { company: v || null })} placeholder="—" />
            </td>
            <td className="px-3 py-2 text-muted-foreground">
              <EditableCell value={c.email ?? ""} onSave={(v) => onUpdate(c.id, { email: v || null })} placeholder="—" />
            </td>
            <td className="px-3 py-2 text-muted-foreground">
              <EditableCell value={c.phone ?? ""} onSave={(v) => onUpdate(c.id, { phone: v || null })} placeholder="—" />
            </td>
            <td className="px-3 py-2 text-right tabular-nums font-medium">
              {c.lifetime_spend_cents > 0 ? fmtMoney(c.lifetime_spend_cents) : "—"}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
              {c.transaction_count || "—"}
            </td>
            <td className="px-3 py-2 text-muted-foreground">{fmtDate(c.last_visit)}</td>
            <td className="px-3 py-2">
              <EditableCell value={c.notes ?? ""} onSave={(v) => onUpdate(c.id, { notes: v || null })} placeholder="Add note…" multiline />
            </td>
            <td className="px-3 py-2 text-right">
              <button
                onClick={() => {
                  if (confirm(`Delete ${c.name}?`)) onDelete(c.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                aria-label="Delete"
              >
                <Trash2 size={14} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─────────────────────────── IG threads table ─────────────────────────── */

function ThreadTable({
  threads, loading, onOpen, onUpdate,
}: {
  threads: Thread[];
  loading: boolean;
  onOpen: (t: Thread) => void;
  onUpdate: (id: string, patch: Partial<Thread>) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
        <tr>
          <th className="px-3 py-2">Handle</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2">Topics</th>
          <th className="px-3 py-2 text-right">Msgs</th>
          <th className="px-3 py-2 text-right">Replies</th>
          <th className="px-3 py-2">Last</th>
          <th className="px-3 py-2">Flags</th>
          <th className="px-3 py-2 w-56">Action / Notes</th>
          <th className="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {loading && (
          <tr><td colSpan={9} className="px-3 py-6 text-muted-foreground">Loading…</td></tr>
        )}
        {!loading && threads.length === 0 && (
          <tr><td colSpan={9} className="px-3 py-6 text-muted-foreground">No matches.</td></tr>
        )}
        {threads.map((t) => (
          <tr key={t.id} className="border-t border-border hover:bg-muted/30">
            <td className="px-3 py-2 font-medium">
              <button
                onClick={() => onOpen(t)}
                className="hover:underline text-left flex items-center gap-1"
              >
                @{t.handle}
              </button>
            </td>
            <td className="px-3 py-2">
              <StatusBadge status={t.status} />
            </td>
            <td className="px-3 py-2 text-muted-foreground max-w-xs truncate" title={t.key_topics ?? ""}>
              {t.key_topics ?? "—"}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{t.total_messages || "—"}</td>
            <td className="px-3 py-2 text-right tabular-nums">{t.their_replies || "—"}</td>
            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(t.last_message_date)}</td>
            <td className="px-3 py-2">
              <div className="flex gap-1">
                {t.is_follower && <Pill>Follower</Pill>}
                {t.follows_us && <Pill>Mutual</Pill>}
                {t.pending_request && <Pill>Pending</Pill>}
                {t.commenter && <Pill>Commenter</Pill>}
              </div>
            </td>
            <td className="px-3 py-2">
              <EditableCell
                value={t.notes ?? ""}
                onSave={(v) => onUpdate(t.id, { notes: v || null })}
                placeholder="Next action…"
                multiline
              />
            </td>
            <td className="px-3 py-2 text-right">
              {t.profile_link && (
                <a
                  href={t.profile_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Open Instagram"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground text-xs">Lead</span>;
  const tone =
    status === "Active Conversation"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status.startsWith("Inbound")
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium", tone)}>
      {status}
    </span>
  );
}

/* ─────────────────────────── Editable cell ─────────────────────────── */

function EditableCell({
  value, onSave, placeholder, multiline,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (editing) {
    return multiline ? (
      <Textarea
        autoFocus
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
        }}
        className="text-sm min-h-[44px]"
      />
    ) : (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="h-8 text-sm"
      />
    );
  }

  return (
    <div
      tabIndex={0}
      role="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setDraft(value);
          setEditing(true);
        }
      }}
      className={cn(
        "min-h-[24px] cursor-text rounded px-1 -mx-1 hover:bg-muted/60 transition truncate max-w-xs",
        !value && "text-muted-foreground italic",
      )}
      title={value || placeholder}
    >
      {value || placeholder || "—"}
    </div>
  );
}

/* ─────────────────────────── Side drawer ─────────────────────────── */

function ThreadDrawer({
  thread, onClose, onUpdate,
}: {
  thread: Thread;
  onClose: () => void;
  onUpdate: (patch: Partial<Thread>) => void;
}) {
  const STATUSES = ["Active Conversation", "Inbound Inquiry (We haven't replied)", "Cold Outreach (No Reply)"];
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-md bg-card border-l border-border h-full overflow-y-auto p-5 space-y-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Instagram thread</div>
            <a
              href={thread.profile_link ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="text-lg font-semibold hover:underline inline-flex items-center gap-1"
            >
              @{thread.handle} <ExternalLink size={13} />
            </a>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini label="Total" value={thread.total_messages} />
          <Mini label="Replies" value={thread.their_replies} />
          <Mini
            label="Reply rate"
            value={
              thread.total_messages
                ? `${Math.round((thread.their_replies / thread.total_messages) * 100)}%`
                : "—"
            }
          />
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => onUpdate({ status: s })}
                className={cn(
                  "text-xs px-2 py-1 rounded border",
                  thread.status === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s.split(" (")[0]}
              </button>
            ))}
            <button
              onClick={() => onUpdate({ status: null })}
              className={cn(
                "text-xs px-2 py-1 rounded border",
                !thread.status
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Lead only
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <FlagToggle label="Follower" on={thread.is_follower} onClick={() => onUpdate({ is_follower: !thread.is_follower })} />
          <FlagToggle label="Follows us" on={thread.follows_us} onClick={() => onUpdate({ follows_us: !thread.follows_us })} />
          <FlagToggle label="Pending" on={thread.pending_request} onClick={() => onUpdate({ pending_request: !thread.pending_request })} />
          <FlagToggle label="DM history" on={thread.has_dm_history} onClick={() => onUpdate({ has_dm_history: !thread.has_dm_history })} />
          <FlagToggle label="Commenter" on={thread.commenter} onClick={() => onUpdate({ commenter: !thread.commenter })} />
        </div>

        {thread.key_topics && (
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
              <Tag size={11} /> Topics
            </div>
            <div className="text-sm">{thread.key_topics}</div>
          </div>
        )}

        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Action / Notes</div>
          <Textarea
            defaultValue={thread.notes ?? ""}
            rows={3}
            placeholder="What's the next move?"
            onBlur={(e) => {
              const v = e.target.value;
              if (v !== (thread.notes ?? "")) onUpdate({ notes: v || null });
            }}
          />
        </div>

        {thread.snippet && (
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Recent conversation</div>
            <pre className="text-xs whitespace-pre-wrap leading-relaxed bg-muted/40 rounded p-3 max-h-80 overflow-auto">
              {thread.snippet}
            </pre>
          </div>
        )}
      </aside>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function FlagToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-xs px-2 py-1 rounded border transition",
        on ? "bg-primary/15 border-primary/40 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}