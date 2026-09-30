/** Minimal cookie jar for Node fetch session tests. */
export class CookieJar {
  private cookies = new Map<string, string>();

  store(baseUrl: string, headers: Headers) {
    const host = new URL(baseUrl).host;
    const raw = headers.getSetCookie?.() ?? [];
    const list = raw.length ? raw : [];
    // Fallback for environments without getSetCookie
    const single = headers.get("set-cookie");
    const all = list.length ? list : single ? [single] : [];
    for (const line of all) {
      const pair = line.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      this.cookies.set(`${host}|${name}`, value);
    }
  }

  header(baseUrl: string): string {
    const host = new URL(baseUrl).host;
    const parts: string[] = [];
    for (const [key, value] of this.cookies) {
      if (key.startsWith(`${host}|`)) {
        const name = key.slice(host.length + 1);
        parts.push(`${name}=${value}`);
      }
    }
    return parts.join("; ");
  }
}
