export function archiveYouTubeEmbed(source: string): string | null {
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase();
    const youtube = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host);
    const short = host === 'youtu.be' || host === 'www.youtu.be';
    if (!youtube && !short) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const id = short ? parts[0] : url.searchParams.get('v') || (['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : null);
    if (id && /^[\w-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
    const list = url.searchParams.get('list');
    return youtube && list && /^[\w-]+$/.test(list) ? `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}` : null;
  } catch { return null; }
}