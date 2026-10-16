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
});
