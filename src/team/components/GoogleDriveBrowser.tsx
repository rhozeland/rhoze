import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Folder,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  File as FileIcon,
  ExternalLink,
  ChevronRight,
  Search,
  Eye,
} from "lucide-react";
import EmbedPreview, { toEmbedUrl } from "./EmbedPreview";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
  owners?: { displayName?: string; emailAddress?: string }[];
};

type Crumb = { id: string; name: string };

function fileIcon(mime: string) {
  if (mime === "application/vnd.google-apps.folder") return Folder;
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.includes("spreadsheet")) return FileSpreadsheet;
  if (mime.includes("presentation")) return Presentation;
  if (mime.includes("document") || mime === "application/pdf") return FileText;
  return FileIcon;
}

export default function GoogleDriveBrowser() {
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: "root", name: "My Drive" }]);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<DriveFile | null>(null);

  const current = crumbs[crumbs.length - 1];

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["gdrive", current.id, q],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-drive-list", {
        body: { folderId: current.id, q },
      });
      if (error) throw error;
      return data as { files: DriveFile[]; nextPageToken?: string };
    },
  });

  const files = data?.files ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
          {crumbs.map((c, i) => (
            <span key={c.id + i} className="flex items-center gap-1">
              <button
                className={`hover:text-foreground ${i === crumbs.length - 1 ? "text-foreground font-medium" : ""}`}
                onClick={() => setCrumbs(crumbs.slice(0, i + 1))}
              >
                {c.name}
              </button>
              {i < crumbs.length - 1 && <ChevronRight size={12} />}
            </span>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <Input
            className="pl-9 h-8 text-sm"
            placeholder="Filter in folder…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "…" : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 text-sm text-destructive rounded-lg p-3">
          {(error as any)?.message || "Could not load Drive. Make sure the Google Drive connector is linked."}
        </div>
      )}

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : files.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">Empty folder.</div>
        ) : (
          <ul className="divide-y divide-border">
            {files.map((f) => {
              const Icon = fileIcon(f.mimeType);
              const isFolder = f.mimeType === "application/vnd.google-apps.folder";
              const canPreview = !isFolder && !!f.webViewLink && !!toEmbedUrl(f.webViewLink);
              return (
                <li key={f.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30">
                  <Icon size={16} className="text-muted-foreground shrink-0" />
                  <button
                    className="flex-1 text-sm text-left truncate"
                    onClick={() => {
                      if (isFolder) {
                        setCrumbs([...crumbs, { id: f.id, name: f.name }]);
                        setQ("");
                      } else if (canPreview) {
                        setPreview(f);
                      } else if (f.webViewLink) {
                        window.open(f.webViewLink, "_blank");
                      }
                    }}
                    title={f.name}
                  >
                    {f.name}
                  </button>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline tabular-nums">
                    {f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ""}
                  </span>
                  {!isFolder && canPreview && (
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      title="Preview"
                      onClick={() => setPreview(f)}
                    >
                      <Eye size={14} />
                    </button>
                  )}
                  {f.webViewLink && (
                    <a
                      href={f.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      title="Open in Google Drive"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {preview && preview.webViewLink && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium truncate">{preview.name}</div>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setPreview(null)}
            >
              Close preview
            </button>
          </div>
          <EmbedPreview url={preview.webViewLink} title={preview.name} height={520} />
        </div>
      )}
    </div>
  );
}