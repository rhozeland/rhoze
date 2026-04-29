import { useState } from "react";
import Contacts from "./Contacts";
import Deals from "./Deals";
import { cn } from "@/lib/utils";

export default function CRM() {
  const [tab, setTab] = useState<"contacts" | "deals">("contacts");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">CRM</h1>
        <p className="text-sm text-muted-foreground">Contacts and deals — one workspace.</p>
      </div>
      <div className="flex gap-1 border-b border-border">
        {(["contacts", "deals"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm capitalize border-b-2 -mb-px transition",
              tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div>{tab === "contacts" ? <Contacts /> : <Deals />}</div>
    </div>
  );
}
