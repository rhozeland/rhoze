import { describe, it, expect } from "vitest";
import { classifyMedia, parseMediaLinks } from "./project-media";

describe("project media links", () => {
  it("embeds YouTube", () => expect(classifyMedia("https://youtu.be/9rxMdl_mQws")).toMatchObject({ kind: "embed", label: "YouTube" }));
  it("embeds Spotify tracks", () => expect(classifyMedia("https://open.spotify.com/track/abc123")).toMatchObject({ kind: "embed", embed: "https://open.spotify.com/embed/track/abc123" }));
  it("labels Luma and Eventbrite events as links", () => {
    expect(classifyMedia("https://lu.ma/rhozeland")).toMatchObject({ kind: "link", site: "Luma" });
    expect(classifyMedia("https://www.eventbrite.ca/e/123")).toMatchObject({ kind: "link", site: "Eventbrite" });
  });
  it("rejects non-web links", () => expect(classifyMedia("javascript:alert(1)")).toBeNull());
  it("drops duplicates", () => expect(parseMediaLinks(["https://lu.ma/a", "https://lu.ma/a"])).toHaveLength(1));
  it("embeds Instagram posts and named-account reels", () => {
    expect(classifyMedia("https://www.instagram.com/runnersclubco/reel/DKXax4qA4u3/")).toMatchObject({ kind: "embed", embed: "https://www.instagram.com/p/DKXax4qA4u3/embed/" });
    expect(classifyMedia("https://www.instagram.com/p/DJ90KlZIg3r/")).toMatchObject({ kind: "embed" });
  });
  it("embeds TikTok video permalinks", () => expect(classifyMedia("https://www.tiktok.com/@creator/video/123456789")).toMatchObject({ kind: "embed", embed: "https://www.tiktok.com/player/v1/123456789" }));
  it("plays direct audio and video attachments", () => {
    expect(classifyMedia("https://example.com/clip.mp4?token=test")).toMatchObject({ kind: "video" });
    expect(classifyMedia("https://example.com/song.mp3")).toMatchObject({ kind: "audio" });
  });
  it("does not embed unsupported sites or spoofed providers", () => {
    expect(classifyMedia("https://instagram.com.evil.example/p/abc/")).toMatchObject({ kind: "link" });
    expect(classifyMedia("https://example.com/project")).toMatchObject({ kind: "link" });
    expect(classifyMedia("https://youtube.com/@truenorthtransparency")).toMatchObject({ kind: "link" });
  });
});
