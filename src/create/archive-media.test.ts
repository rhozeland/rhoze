import { describe, expect, it } from 'vitest';
import { archiveYouTubeEmbed } from './archive-media';
describe('Archive YouTube sources', () => {
  it('embeds the original video without autoplay', () => {
    expect(archiveYouTubeEmbed('https://www.youtube.com/watch?v=WLpDRh8JsxY')).toBe('https://www.youtube-nocookie.com/embed/WLpDRh8JsxY');
  });
  it('supports short links and shorts', () => {
    expect(archiveYouTubeEmbed('https://youtu.be/WLpDRh8JsxY?t=10')).toBe('https://www.youtube-nocookie.com/embed/WLpDRh8JsxY');
    expect(archiveYouTubeEmbed('https://youtube.com/shorts/WLpDRh8JsxY')).toBe('https://www.youtube-nocookie.com/embed/WLpDRh8JsxY');
  });
  it('preserves a YouTube playlist', () => {
    expect(archiveYouTubeEmbed('https://www.youtube.com/playlist?list=PLabc123')).toBe('https://www.youtube-nocookie.com/embed/videoseries?list=PLabc123');
  });
  it('leaves non-video artwork as a fallback and rejects lookalike hosts', () => {
    expect(archiveYouTubeEmbed('https://example.com/work')).toBeNull();
    expect(archiveYouTubeEmbed('https://youtube.com.evil.test/watch?v=WLpDRh8JsxY')).toBeNull();
    expect(archiveYouTubeEmbed('javascript:alert(1)')).toBeNull();
  });
});