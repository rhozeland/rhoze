---
name: Preview blob URL rule
description: Always render uploaded files in lightbox/iframe via fetched blob: URLs to avoid Chrome's "This page has been blocked by Chrome" error
type: constraint
---
Any uploaded file rendered in a preview/lightbox (pdf, image, video, audio, or future iframe-based viewers) MUST be fetched as bytes and served via a `blob:` URL — never pass the remote storage URL directly to `<iframe src>`, `<img src>`, `<video src>`, `<audio src>`, or `<embed>`. **Why:** Chrome blocks remote uploads with the "This page has been blocked by Chrome" error when storage responses aren't perfectly inline. **How to apply:** use the shared `mediaBlobCache` pattern in `src/team/components/DocPreview.tsx` (fetch → blob → URL.createObjectURL with a forced fallback MIME type when storage returns `application/octet-stream`).
