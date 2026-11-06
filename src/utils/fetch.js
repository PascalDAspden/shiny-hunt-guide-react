/** AbortController works on the supported iOS webviews, including iOS 15. */
export async function fetchWithTimeout(url, options = {}, milliseconds = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    // Keep the deadline active through response body download, not just headers.
    const body = await response.arrayBuffer();
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  } finally { clearTimeout(timer); }
}
