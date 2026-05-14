import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import mammoth from "mammoth";

type Props = {
  url: string;
  mime?: string | null;
  fileName?: string | null;
};

function inferKind(mime: string | null | undefined, fileName: string | null | undefined) {
  const m = (mime || "").toLowerCase();
  const n = (fileName || "").toLowerCase();
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (m === "text/markdown" || n.endsWith(".md") || n.endsWith(".markdown")) return "md";
  if (
    m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    n.endsWith(".docx")
  ) return "docx";
  if (m.startsWith("text/")) return "text";
  return "unknown";
}

export default function DocPreview({ url, mime, fileName }: Props) {
  const kind = inferKind(mime, fileName);
  const [text, setText] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setText(null);
    setHtml(null);
    setError(null);

    if (kind === "md" || kind === "text") {
      setLoading(true);
      fetch(url)
        .then((r) => r.text())
        .then((t) => { if (!cancelled) setText(t); })
        .catch((e) => { if (!cancelled) setError(e.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    } else if (kind === "docx") {
      setLoading(true);
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((buf) => mammoth.convertToHtml({ arrayBuffer: buf }))
        .then((res) => { if (!cancelled) setHtml(res.value); })
        .catch((e) => { if (!cancelled) setError(e.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    return () => { cancelled = true; };
  }, [url, kind]);

  if (kind === "pdf") {
    return (
      <iframe
        src={url}
        title={fileName || "PDF preview"}
        className="w-full h-[75vh] rounded bg-white"
      />
    );
  }

  if (kind === "md" || kind === "text") {
    return (
      <div className="w-full max-h-[75vh] overflow-auto bg-background text-foreground rounded p-6">
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
      <div className="w-full max-h-[75vh] overflow-auto bg-background text-foreground rounded p-6">
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

  return <div className="text-muted-foreground text-sm">Preview not available for this file type</div>;
}