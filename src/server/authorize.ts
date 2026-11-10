// หน้าอนุญาต (/authorize) ให้ Claude เข้าถึงบัญชี: ต้องล็อกอินหน้าเว็บก่อน แล้วกด "อนุญาต"

import { AuthorizationError, CimdFetchError, type ConsentDescription, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type { Db } from "./db";
import { readSessionToken } from "./cookies";
import { getSessionUser } from "./services/auth";

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title: string, body: string, headers = new Headers(), status = 200): Response {
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(
    `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title>
<style>
  :root{color-scheme:light dark;--bg:#fafaf9;--fg:#1c1917;--muted:#78716c;--card:#fff;--line:#e7e5e4;--accent:#1c1917;--accent-fg:#fff}
  @media (prefers-color-scheme:dark){:root{--bg:#0c0a09;--fg:#fafaf9;--muted:#a8a29e;--card:#1c1917;--line:#292524;--accent:#fafaf9;--accent-fg:#1c1917}}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font-family:system-ui,"Noto Sans Thai",sans-serif;padding:16px}
  main{max-width:420px;width:100%;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:24px}
  h1{font-size:1.25rem;margin:0 0 12px} p{line-height:1.6;color:var(--muted)} strong{color:var(--fg)}
  .warn{background:#fef3c7;color:#78350f;border-radius:8px;padding:8px 12px}
  .row{display:flex;gap:8px;margin-top:20px} button{flex:1;padding:10px;border-radius:10px;border:1px solid var(--line);font:inherit;cursor:pointer;background:transparent;color:var(--fg)}
  button.primary{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}
  ul{padding-left:20px;color:var(--muted)}
</style></head><body><main>${body}</main></body></html>`,
    { status, headers },
  );
}

function consentPage(details: ConsentDescription, handle: string, email: string, headers: Headers): Response {
  const name = escape(details.clientName);
  const origin = details.clientDomain
    ? `เผยแพร่โดย <strong>${escape(details.clientDomain)}</strong>`
    : "แอปนี้ลงทะเบียนตัวเอง ชื่อแอปยังไม่ได้รับการยืนยัน";
  const scopes = details.scope.map((s) => `<input type="hidden" name="scope" value="${escape(s)}">`).join("");
  return page(
    `อนุญาต ${details.clientName}`,
    `<h1>อนุญาตให้ ${name} เข้าถึงบัญชีจดเงินของคุณ?</h1>
<p>${origin}<br>สิทธิ์จะถูกส่งไปที่ <strong>${escape(details.redirectHost)}</strong><br>บัญชี: <strong>${escape(email)}</strong></p>
${details.redirectIsLoopback ? '<p class="warn">สิทธิ์จะถูกส่งไปยังแอปบนเครื่องของคุณ กดอนุญาตเฉพาะเมื่อคุณเพิ่งเริ่มเชื่อมต่อจากแอปนั้นเอง</p>' : ""}
<p>แอปนี้จะ จด แก้ ลบ และดูสรุปรายรับรายจ่ายของคุณได้</p>
<form method="post">
  <input type="hidden" name="handle" value="${escape(handle)}">${scopes}
  <div class="row"><button name="decision" value="deny">ไม่อนุญาต</button><button class="primary" name="decision" value="approve">อนุญาต</button></div>
</form>`,
    headers,
  );
}

function errorPage(message: string): Response {
  return page("เกิดข้อผิดพลาด", `<h1>เชื่อมต่อไม่สำเร็จ</h1><p>${escape(message)}</p><p>ลองเริ่มเชื่อมต่อจาก Claude ใหม่อีกครั้ง</p>`, new Headers(), 400);
}

export async function handleAuthorize(request: Request, db: Db, oauth: OAuthHelpers): Promise<Response> {
  const url = new URL(request.url);
  const user = await getSessionUser(db, readSessionToken(request));
  if (!user) {
    // ยังไม่ล็อกอิน: ไปหน้าล็อกอิน แล้วกลับมาที่ URL เดิม
    const next = url.pathname + url.search;
    return Response.redirect(`${url.origin}/login?next=${encodeURIComponent(next)}`, 302);
  }

  try {
    if (request.method === "GET") {
      const authRequest = await oauth.parseAuthRequest(request);
      const details = await oauth.describeConsent(authRequest);
      const consent = await oauth.beginConsent(authRequest);
      return consentPage(details, consent.handle, user.email, consent.headers);
    }

    if (request.method === "POST") {
      const form = await request.formData();
      const handle = String(form.get("handle") ?? "");
      if (form.get("decision") !== "approve") {
        const denied = await oauth.denyConsent(request, handle);
        return new Response(null, { status: 302, headers: denied.headers });
      }
      const approved = await oauth.approveConsent(request, handle, { scope: form.getAll("scope").map(String) });
      const { redirectTo } = await oauth.completeAuthorization({
        request: approved.request,
        userId: user.userId,
        metadata: { email: user.email },
        scope: approved.request.scope,
        props: { userId: user.userId },
      });
      approved.headers.set("Location", redirectTo);
      return new Response(null, { status: 302, headers: approved.headers });
    }

    return new Response("Method Not Allowed", { status: 405 });
  } catch (err) {
    if (err instanceof AuthorizationError && err.redirectTo) return Response.redirect(err.redirectTo, 302);
    if (err instanceof AuthorizationError) return errorPage(err.description);
    if (err instanceof CimdFetchError) return errorPage("ไม่สามารถยืนยันแอปนี้ได้");
    throw err;
  }
}
