// Form-first concierge intake for guests: no AI cost until email captured.
// After submit, marks the conversation as email-captured and seeds a first
// user message so the concierge chat has full context.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { unlockConciergeForGuest, type Conversation } from "./copilotClient";
import { Sparkles, Loader2 } from "lucide-react";

const TYPES = ["Music video", "Campaign", "Short film", "Photo", "Edit", "Design", "Dev", "Other"];
const TIMELINES = ["ASAP", "2–4 weeks", "1–3 months", "Flexible"];
const BUDGETS = ["<$3k", "$3k–$10k", "$10k–$25k", "$25k+"];

export default function ConciergeForm({
  conversation, email: initialEmail, onUnlocked,
}: {
  conversation: Conversation;
  email?: string;
  onUnlocked: () => void;
}) {
  const [type, setType] = useState(TYPES[0]);
  const [timeline, setTimeline] = useState(TIMELINES[1]);
  const [budget, setBudget] = useState(BUDGETS[1]);
  const [desc, setDesc] = useState("");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!desc.trim() || !email.trim()) {
      toast({ title: "Add a one-line description and your email" });
      return;
    }
    setBusy(true);
    try {
      // Save contact email onto the conversation via an intake_request row.
      await supabase.from("intake_requests").insert({
        contact_name: email.split("@")[0],
        contact_email: email.trim(),
        message: desc.trim(),
        status: "concierge",
      });
      const seed = [
        `Project type: ${type}`,
        `Timeline: ${timeline}`,
        `Budget: ${budget}`,
        ``,
        desc.trim(),
      ].join("\n");
      await unlockConciergeForGuest({ conversationId: conversation.id, seedMessage: seed });
      onUnlocked();
    } catch (e) {
      toast({ title: "Couldn't start", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase text-muted-foreground mb-4">
        <Sparkles className="w-3.5 h-3.5" /> Free scoping · 5 concierge turns unlocked after email
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ChipRow label="What is it" value={type} options={TYPES} onChange={setType} />
        <ChipRow label="Timeline" value={timeline} options={TIMELINES} onChange={setTimeline} />
        <ChipRow label="Budget" value={budget} options={BUDGETS} onChange={setBudget} />
      </div>

      <div className="mt-4">
        <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">One-line description</Label>
        <Textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          placeholder="e.g. 90s Miami-heat music video for a bilingual EP, need editor + colorist"
          className="mt-1"
        />
      </div>

      <div className="mt-3 grid md:grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" className="mt-1" />
        </div>
        <Button onClick={submit} disabled={busy} className="h-10">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          Unlock concierge
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        No account required. Refining beyond 5 turns → sign in for unlimited.
      </p>
    </div>
  );
}

function ChipRow({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
              value === o
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:border-primary/50"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}