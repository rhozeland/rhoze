import { supabase } from "@/integrations/supabase/client";

export type UploadState = "idle" | "uploading" | "error" | "cancelled";

export interface UploadResult {
  path: string;
}

export interface UploadOptions {
  bucket: string;
  path: string;
  file: File;
  onProgress?: (percent: number) => void;
}

/**
 * Upload a file to Supabase Storage using XMLHttpRequest so we get
 * real progress events and the ability to abort mid-flight.
 */
export function uploadWithProgress(opts: UploadOptions): {
  promise: Promise<UploadResult>;
  abort: () => void;
} {
  const { bucket, path, file, onProgress } = opts;
  const xhr = new XMLHttpRequest();
  let aborted = false;

  const promise = new Promise<UploadResult>(async (resolve, reject) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      reject(new Error("Not authenticated"));
      return;
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(path)}`;

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress?.(pct);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ path });
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          msg = body.message || body.error || msg;
        } catch {
          // ignore parse error
        }
        reject(new Error(msg));
      }
    });

    xhr.addEventListener("error", () => {
      if (aborted) {
        reject(new Error("Upload cancelled"));
      } else {
        reject(new Error("Network error during upload"));
      }
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled"));
    });

    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.send(file);
  });

  const abort = () => {
    aborted = true;
    xhr.abort();
  };

  return { promise, abort };
}
