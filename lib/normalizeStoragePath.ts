/**
 * Normalize a storage path into canonical object key: projectId/filename.ext
 * Handles full URLs, music-files/ prefix, querystrings, and URL encoding.
 */
export function normalizeStoragePath(raw: string, bucket = 'music-files'): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let path = raw.trim();
  path = path.replace(/^\/+/, '');
  if (!path || path === 'undefined') return null;

  // Full URL: extract object key after /object/.../bucket/ or /bucket/
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const url = new URL(path);
      const pathname = url.pathname;
      const match = pathname.match(new RegExp(`/${bucket}/([^?#]*)`, 'i'));
      if (match?.[1]) {
        path = match[1];
      } else {
        return null;
      }
      if (path.startsWith('http')) return null;
    } catch {
      return null;
    }
  } else if (path.includes('/storage/v1/') || path.includes('/object/')) {
    const match = path.match(new RegExp(`/${bucket}/([^?#]+)`, 'i'));
    if (match?.[1]) {
      path = match[1];
    }
    if (path.includes('/storage/v1/') || path.includes('/object/')) return null;
  }

  // Strip querystring if present (e.g. ?token=...)
  const q = path.indexOf('?');
  if (q >= 0) path = path.slice(0, q);

  // Decode URL encoding safely (%2F -> /, %252F -> %2F -> /, etc.)
  try {
    path = decodeURIComponent(path);
  } catch {
    // leave as-is if decode fails
  }

  // Remove leading bucket/ prefix
  path = path.replace(new RegExp(`^${bucket}/?`, 'i'), '').trim();
  path = path.replace(/^\/+/, '');

  // Collapse duplicate slashes and strip trailing slash
  path = path.replace(/\/+/g, '/').replace(/\/$/, '');

  if (!path || !path.includes('/')) return null;
  return path;
}
