// Free-text URLs (link to a PACS, an image server…) are only ever stored or rendered as links
// when they are plain http(s) URLs — never javascript:, data: or anything a browser would run.

export const MAX_EXTERNAL_URL_LENGTH = 2048;

export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > MAX_EXTERNAL_URL_LENGTH) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
