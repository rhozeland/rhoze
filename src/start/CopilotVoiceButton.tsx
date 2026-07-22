import { useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  onTranscribed: (text: string) => void;
  transcribe: (blob: Blob) => Promise<string>;
  disabled?: boolean;
}

export default function CopilotVoiceButton({ onTranscribed, transcribe, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (blob.size < 512) {
          toast({ title: "Too short", description: "Hold to record a longer note." });
          return;
        }
        setTranscribing(true);
        try {
          const text = await transcribe(blob);
          if (text.trim()) onTranscribed(text.trim());
          else toast({ title: "No speech detected", description: "Try again." });
        } catch (e) {
          toast({ title: "Transcription failed", description: (e as Error).message, variant: "destructive" });
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch (e) {
      toast({ title: "Microphone blocked", description: (e as Error).message, variant: "destructive" });
    }
  };

  const stop = () => {
    if (recRef.current && recRef.current.state !== "inactive") {
      recRef.current.stop();
    }
    setRecording(false);
  };

  return (
    <button
      type="button"
      disabled={disabled || transcribing}
      onPointerDown={(e) => { e.preventDefault(); if (!recording && !transcribing) start(); }}
      onPointerUp={(e) => { e.preventDefault(); if (recording) stop(); }}
      onPointerLeave={() => { if (recording) stop(); }}
      onPointerCancel={() => { if (recording) stop(); }}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
        recording
          ? "bg-red-500 text-white border-red-500 animate-pulse"
          : "bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-100"
      } ${disabled || transcribing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      title={recording ? "Release to send" : "Hold to record a voice note"}
      aria-label="Record voice note"
    >
      {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}