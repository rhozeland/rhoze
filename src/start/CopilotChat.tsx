import { useEffect, useRef, useState, useCallback } from "react";
import { Paperclip, Send, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import CopilotVoiceButton from "./CopilotVoiceButton";
import {
  type CopilotMessage,
  type Conversation,
  streamCopilotChat,
  transcribeAudio,
  uploadAttachment,
  stripBriefBlock,
} from "./copilotClient";
import { toast } from "@/hooks/use-toast";

interface Props {
  conversation: Conversation;
  guestToken: string;
  initialMessages: CopilotMessage[];
  onBriefUpdate: () => void;
}

const OPENER: CopilotMessage = {
  id: "opener",
  role: "assistant",
  content:
    "Hey - I'm the Rhoze concierge. Tell me about your project: what you're making, who it's for, and anything you already have (references, deadlines, budget). Type it, hold the mic to talk it out, or drop files below.",
  created_at: new Date().toISOString(),
};

export default function CopilotChat({ conversation, guestToken, initialMessages, onBriefUpdate }: Props) {
  const [messages, setMessages] = useState<CopilotMessage[]>(
    initialMessages.length ? initialMessages : [OPENER]
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pending, setPending] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const send = useCallback(async (text: string, source?: "voice" | "text") => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: CopilotMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      transcript_source: source ?? "text",
      created_at: new Date().toISOString(),
    };
    const nextMessages = [...messages.filter((m) => m.id !== "opener"), userMsg];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);
    setPending("");

    let acc = "";
    try {
      await streamCopilotChat({
        conversationId: conversation.id,
        guestToken,
        history: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        onDelta: (chunk) => {
          acc += chunk;
          setPending(stripBriefBlock(acc));
        },
      });
      const visible = stripBriefBlock(acc);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: visible, created_at: new Date().toISOString() },
      ]);
      setPending("");
      onBriefUpdate();
    } catch (e) {
      toast({ title: "Copilot error", description: (e as Error).message, variant: "destructive" });
      setPending("");
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming, conversation.id, guestToken, onBriefUpdate]);

  const handleFile = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 25MB." });
      return;
    }
    try {
      const { signedUrl, kind } = await uploadAttachment(conversation.id, file);
      const note = `[attached ${kind}: ${file.name}] ${signedUrl}`;
      await send(note, "text");
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <section className="flex flex-col h-full min-h-[500px] rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur overflow-hidden">
      <header className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-[0.2em] uppercase text-neutral-500">Studio Concierge</div>
          <div className="text-sm text-neutral-900">Scope your project with Rhoze</div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-neutral-400">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Online
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-5">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {pending && (
          <MessageBubble message={{ id: "pending", role: "assistant", content: pending, created_at: "" }} />
        )}
        {streaming && !pending && (
          <div className="text-xs text-neutral-400 italic">Rhoze concierge is thinking...</div>
        )}
      </div>

      <div className="border-t border-neutral-100 px-3 md:px-4 py-3 bg-white/50">
        <div className="flex items-end gap-2">
          <label className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-100 cursor-pointer" title="Attach file">
            <Paperclip className="h-4 w-4" />
            <input
              type="file"
              accept="image/*,audio/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <CopilotVoiceButton
            disabled={streaming}
            transcribe={transcribeAudio}
            onTranscribed={(t) => send(t, "voice")}
          />
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Describe your project... (Enter to send)"
            className="flex-1 min-h-[44px] max-h-40 resize-none border-neutral-200 focus-visible:ring-neutral-900"
          />
          <Button
            onClick={() => send(input)}
            disabled={streaming || !input.trim()}
            className="h-10 w-10 shrink-0 p-0 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white disabled:opacity-40"
            aria-label="Send"
          >
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </section>
  );
}

function MessageBubble({ message }: { message: CopilotMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] whitespace-pre-wrap text-[15px] leading-relaxed ${
          isUser
            ? "bg-neutral-900 text-white rounded-2xl rounded-br-sm px-4 py-2.5"
            : "text-neutral-900"
        }`}
      >
        {message.transcript_source === "voice" && isUser && (
          <span className="mr-1 text-[10px] opacity-70 uppercase tracking-wider">voice - </span>
        )}
        {message.content}
      </div>
    </div>
  );
}