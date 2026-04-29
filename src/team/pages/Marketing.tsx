import { Megaphone } from "lucide-react";

export default function Marketing() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Marketing</h1>
        <p className="text-sm text-muted-foreground">Campaigns, outreach, content calendar.</p>
      </div>
      <div className="border border-dashed border-border rounded-lg p-12 text-center bg-card">
        <Megaphone size={28} className="mx-auto text-muted-foreground mb-3" />
        <div className="font-medium">Marketing module coming in Phase 2</div>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Campaign tracking, subscriber lists, and content scheduling will live here.
          Once a campaign converts, it'll flow into CRM as a contract/deal.
        </p>
      </div>
    </div>
  );
}
