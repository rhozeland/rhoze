import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "../lib/auth";

export default function Messages() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [channelId, setChannelId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: channels } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("message_channels").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!channelId && channels && channels.length) setChannelId(channels[0].id);
  }, [channels, channelId]);

  const { data: messages } = useQuery({
    queryKey: ["messages", channelId],
    enabled: !!channelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!channelId) return;
    const ch = supabase
      .channel(`messages:${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` }, () => {
        qc.invalidateQueries({ queryKey: ["messages", channelId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [channelId, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !channelId || !user) return;
    const body = text.trim().slice(0, 2000);
    setText("");
    const { error } = await supabase.from("messages").insert({ channel_id: channelId, body, author_id: user.id });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Messages</h1>
        <p className="text-sm text-muted-foreground">Internal team chat.</p>
      </header>

      <div className="flex gap-2 flex-wrap">
        {(channels ?? []).map((c: any) => (
          <button
            key={c.id}
            onClick={() => setChannelId(c.id)}
            className={`px-3 py-1.5 text-xs rounded-md border ${channelId === c.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
          >
            #{c.name}
          </button>
        ))}
      </div>

      <div className="border border-border rounded-lg bg-card flex flex-col h-[60vh]">
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {(messages ?? []).length === 0 && <div className="text-sm text-muted-foreground">No messages yet.</div>}
          {(messages ?? []).map((m: any) => (
            <div key={m.id} className={`flex flex-col ${m.author_id === user?.id ? "items-end" : "items-start"}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${m.author_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {m.body}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(m.created_at).toLocaleTimeString()}</div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="border-t border-border p-3 flex gap-2"
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" maxLength={2000} />
          <Button type="submit" disabled={!text.trim()}>Send</Button>
        </form>
      </div>
    </div>
  );
}