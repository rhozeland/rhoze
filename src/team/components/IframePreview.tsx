import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

function ContentSkeleton({ title }: { title?: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl bg-card border border-border p-8 space-y-6 shadow-sm">
        {/* Header skeleton matching token dashboard card header */}
        <div className="flex items-start gap-4">
          <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-5 w-3/5 rounded-md" />
            <Skeleton className="h-3 w-1/3 rounded-md" />
          </div>
        </div>

        {/* Body lines */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-11/12 rounded-md" />
          <Skeleton className="h-4 w-4/5 rounded-md" />
        </div>

        {/* Footer / metadata area */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>

        {title && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            Loading <span className="font-medium text-foreground">{title}</span>…
          </p>
        )}
      </div>
    </div>
  );
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
          className="absolute inset-0 bg-background/80 backdrop-blur-sm pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <ContentSkeleton title={title} />
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

