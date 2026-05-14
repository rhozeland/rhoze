import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";

interface IframePreviewProps {
  src: string;
  title: string;
  /** Original (non-embed) URL to offer as a fallback link when the embed fails. */
  fallbackUrl?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Seconds to wait for the iframe to fire `onLoad` before declaring it failed. */
  timeoutMs?: number;
}

/**
 * Iframe wrapper with explicit loading + error UI. Cross-origin iframes
 * almost never fire `onError`, so we treat a missing `onLoad` within
 * `timeoutMs` as a failure and surface a clear "open in new tab" fallback.
 */
export default function IframePreview({
  src,
  title,
  fallbackUrl,
  className,
  style,
  timeoutMs = 15000,
}: IframePreviewProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setStatus("loading");
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setStatus((s) => (s === "loading" ? "error" : s));
    }, timeoutMs);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [src, timeoutMs]);

  const retry = () => {
    setStatus("loading");
  };

  return (
    <div className={"relative " + (className ?? "")} style={style}>
      {status !== "error" && (
        <iframe
          key={src + (status === "loading" ? "-r" : "")}
          src={src}
          title={title}
          className="w-full h-full bg-background border-0"
          loading="lazy"
          allow="autoplay; encrypted-media; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
        />
      )}

      {status === "loading" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading preview…</span>
        </div>
      )}

      {status === "error" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-6 text-center"
          role="alert"
        >
          <AlertCircle size={24} className="text-destructive" />
          <div className="text-sm font-medium text-foreground">
            This preview couldn’t be loaded
          </div>
          <p className="text-xs text-muted-foreground max-w-sm">
            The source may block embedding, require sign-in, or be temporarily
            unavailable.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border bg-background hover:bg-muted"
            >
              Try again
            </button>
            {fallbackUrl && (
              <a
                href={fallbackUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border bg-background hover:bg-muted"
              >
                <ExternalLink size={12} /> Open in new tab
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
