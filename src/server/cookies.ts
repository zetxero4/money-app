// คุกกี้ session ของหน้าเว็บ

export function sessionCookieName(url: URL): string {
  // __Host- บังคับ Secure ใช้ได้เฉพาะ https (บนเครื่องตอน dev เป็น http)
  return url.protocol === "https:" ? "__Host-money_session" : "money_session";
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("Cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

export function readSessionToken(request: Request): string | undefined {
  return readCookie(request, sessionCookieName(new URL(request.url)));
}

export function sessionCookie(url: URL, token: string, expires: Date): string {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${sessionCookieName(url)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${secure}`;
}

export function clearSessionCookie(url: URL): string {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${sessionCookieName(url)}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
