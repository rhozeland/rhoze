import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import mammoth from "mammoth";
import { FileText, Download } from "lucide-react";

type Props = {
  url: string;
  mime?: string | null;
  fileName?: string | null;
  /** When true, render in a compact form suited for thumbnail tiles. */
  compact?: boolean;
};

// Module-level cache keyed by URL so reopening the same attachment never re-fetches.
const textCache = new Map<string, string>();
const htmlCache = new Map<string, string>();

function inferKind(mime: string | null | undefined, fileName: string | null | undefined) {
  const m = (mime || "").toLowerCase();
  const n = (fileName || "").toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i.test(n)) return "image";
  if (m.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/i.test(n)) return "video";
  if (m.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(n)) return "audio";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (m === "text/markdown" || n.endsWith(".md") || n.endsWith(".markdown")) return "md";
  if (
    m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    n.endsWith(".docx")
  ) return "docx";
  if (m === "application/json" || n.endsWith(".json")) return "code";
  if (
    /\.(js|jsx|ts|tsx|css|scss|html|xml|yml|yaml|toml|sh|bash|py|rb|go|rs|java|c|cpp|h|sql|env|ini|conf|log|csv|tsv)$/i.test(n) ||
    m === "application/xml" ||
    m === "application/javascript" ||
    m === "application/x-yaml"
  ) return "code";
  if (m.startsWith("text/")) return "text";
  return "unknown";
}

export default function DocPreview({ url, mime, fileName, compact = false }: Props) {
  const kind = inferKind(mime, fileName);
  const sizeBox = compact ? "w-full h-full" : "w-full max-h-[75vh]";
  const mediaSize = compact ? "w-full h-full object-contain" : "max-w-full max-h-[75vh] object-contain rounded";
  const padding = compact ? "p-3" : "p-6";
  const cachedText = kind === "md" || kind === "text" || kind === "code" ? textCache.get(url) : null;
  const cachedHtml = kind === "docx" ? htmlCache.get(url) : null;
  const [text, setText] = useState<string | null>(cachedText ?? null);
  const [html, setHtml] = useState<string | null>(cachedHtml ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(cachedText === undefined && cachedHtml === undefined && (kind === "md" || kind === "text" || kind === "code" || kind === "docx"));

  useEffect(() => {
    let cancelled = false;
    setError(null);

    if (kind === "md" || kind === "text" || kind === "code") {
      if (textCache.has(url)) {
        setText(textCache.get(url)!);
        setLoading(false);
        return;
      }
      setLoading(true);
      fetch(url)
        .then((r) => r.text())
        .then((t) => {
          if (!cancelled) {
            textCache.set(url, t);
            setText(t);
          }
        })
        .catch((e) => { if (!cancelled) setError(e.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    } else if (kind === "docx") {
      if (htmlCache.has(url)) {
        setHtml(htmlCache.get(url)!);
        setLoading(false);
        return;
      }
      setLoading(true);
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((buf) => mammoth.convertToHtml({ arrayBuffer: buf }))
        .then((res) => {
          if (!cancelled) {
            htmlCache.set(url, res.value);
            setHtml(res.value);
          }
        })
        .catch((e) => { if (!cancelled) setError(e.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    return () => { cancelled = true; };
  }, [url, kind]);

  if (kind === "image") {
    return (
      <img
        src={url}
        alt={fileName || "Image preview"}
        className={mediaSize}
      />
    );
  }

  if (kind === "video") {
    return (
      <video src={url} controls className={compact ? "w-full h-full" : "max-w-full max-h-[75vh] rounded"} />
    );
  }

  if (kind === "audio") {
    return (
      <div className={`w-full ${compact ? "h-full justify-center" : "max-w-xl"} bg-background text-foreground rounded ${padding} flex flex-col items-center gap-4`}>
        <div className="text-sm font-medium truncate w-full text-center">{fileName || "Audio"}</div>
        <audio src={url} controls className="w-full" />
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <iframe
        src={url}
        title={fileName || "PDF preview"}
        className={compact ? "w-full h-full bg-white" : "w-full h-[75vh] rounded bg-white"}
      />
    );
  }

  if (kind === "md" || kind === "text" || kind === "code") {
    return (
      <div className={`${sizeBox} overflow-auto bg-background text-foreground rounded ${padding}`}>
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {error && <div className="text-sm text-destructive">Failed to load: {error}</div>}
        {text != null && (
          kind === "md" ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-sm font-mono">{text}</pre>
          )
        )}
      </div>
    );
  }

  if (kind === "docx") {
    return (
      <div className={`${sizeBox} overflow-auto bg-background text-foreground rounded ${padding}`}>
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {error && <div className="text-sm text-destructive">Failed to load: {error}</div>}
        {html != null && (
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-background text-foreground rounded-lg p-8 flex flex-col items-center gap-4 text-center border border-border">
      <FileText size={48} className="text-muted-foreground" strokeWidth={1.25} />
      <div className="space-y-1">
        <div className="text-sm font-medium truncate max-w-full">{fileName || "Attachment"}</div>
        <div className="text-xs text-muted-foreground">
          Inline preview isn't available for this file type{mime ? ` (${mime})` : ""}.
        </div>
      </div>
      <a
        href={url}
        download={fileName || undefined}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors"
      >
        <Download size={12} /> Download to view
      </a>
    </div>
  );
}