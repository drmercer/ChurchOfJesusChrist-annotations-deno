export function buildCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('; ');
}

export function isRedirectStatus(status: number) {
  return [301, 302, 303, 307, 308].includes(status);
}
