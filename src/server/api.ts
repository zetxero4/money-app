// JSON API ของหน้าเว็บ (/api/*) — เรียก service layer ชุดเดียวกับ MCP

import { z } from "zod";
import type { Db } from "./db";
import { bahtToSatang } from "./money";
import { parseEntry } from "./parse";
import { type Period, rangeForPeriod } from "./thai-date";
import { clearSessionCookie, readSessionToken, sessionCookie } from "./cookies";
import {
  AuthError,
  createSession,
  deleteSession,
  getSessionUser,
  isRegistrationOpen,
  login,
  registerOwner,
} from "./services/auth";
import {
  ServiceError,
  addTransactions,
  deleteTransaction,
  getSummary,
  listCategories,
  listTransactions,
  restoreTransaction,
  updateTransaction,
} from "./services/transactions";

const PERIODS = ["today", "this_week", "this_month", "last_month", "this_year", "last_7_days", "last_30_days"];

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

function error(status: number, message: string): Response {
  return json({ error: message }, status);
}

const credentials = z.object({ email: z.string(), password: z.string() });
const kind = z.enum(["income", "expense"]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const createBody = z.union([
  z.object({ text: z.string().min(1).max(500) }),
  z.object({
    items: z
      .array(
        z.object({
          note: z.string().max(200),
          amount: z.union([z.number(), z.string()]),
          kind: kind.optional(),
          category: z.string().optional(),
          occurredOn: date.optional(),
        }),
      )
      .min(1)
      .max(50),
  }),
]);
const patchBody = z.object({
  note: z.string().max(200).optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  kind: kind.optional(),
  category: z.string().optional(),
  occurredOn: date.optional(),
});

function toSatang(amount: number | string): number {
  const s = bahtToSatang(amount);
  if (s === null) throw new ServiceError("invalid_input", "จำนวนเงินไม่ถูกต้อง");
  return s;
}

/** กัน CSRF: คำขอที่เปลี่ยนข้อมูลต้องเป็น JSON และ (ถ้ามี) Origin ต้องเป็นโดเมนเดียวกัน */
function isSafeMutation(request: Request, url: URL): boolean {
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return false;
  return (request.headers.get("Content-Type") ?? "").startsWith("application/json");
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export async function handleApi(request: Request, db: Db): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method;

  if (method !== "GET" && method !== "HEAD" && !isSafeMutation(request, url)) {
    return error(403, "คำขอไม่ถูกต้อง");
  }

  try {
    // ---- auth (ไม่ต้องล็อกอิน) ----
    if (path === "/api/auth/status" && method === "GET") {
      const user = await getSessionUser(db, readSessionToken(request));
      return json({ registrationOpen: await isRegistrationOpen(db), user: user ? { email: user.email } : null });
    }
    if ((path === "/api/auth/register" || path === "/api/auth/login") && method === "POST") {
      const body = credentials.safeParse(await readJson(request));
      if (!body.success) return error(400, "กรอกอีเมลและรหัสผ่าน");
      const { userId } =
        path === "/api/auth/register"
          ? await registerOwner(db, body.data.email, body.data.password)
          : await login(db, body.data.email, body.data.password);
      const session = await createSession(db, userId);
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(url, session.token, session.expiresAt) });
    }
    if (path === "/api/auth/logout" && method === "POST") {
      await deleteSession(db, readSessionToken(request));
      return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(url) });
    }

    // ---- ต้องล็อกอิน ----
    const user = await getSessionUser(db, readSessionToken(request));
    if (!user) return error(401, "กรุณาล็อกอิน");
    const { userId } = user;

    if (path === "/api/categories" && method === "GET") {
      return json(await listCategories(db, userId));
    }

    if (path === "/api/summary" && method === "GET") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const period = url.searchParams.get("period") ?? "this_month";
      if (!(from && to) && !PERIODS.includes(period)) return error(400, "period ไม่ถูกต้อง");
      const range = from && to ? { from, to } : rangeForPeriod(period as Period);
      return json(await getSummary(db, userId, range));
    }

    if (path === "/api/transactions" && method === "GET") {
      const p = url.searchParams;
      return json(
        await listTransactions(db, userId, {
          from: p.get("from") ?? undefined,
          to: p.get("to") ?? undefined,
          category: p.get("category") ?? undefined,
          query: p.get("query") ?? undefined,
          deleted: p.get("deleted") === "1",
          limit: p.get("limit") ? Number(p.get("limit")) : undefined,
        }),
      );
    }

    if (path === "/api/transactions" && method === "POST") {
      const body = createBody.safeParse(await readJson(request));
      if (!body.success) return error(400, "ข้อมูลไม่ถูกต้อง");
      if ("text" in body.data) {
        const parsed = parseEntry(body.data.text);
        if (parsed.length === 0) return error(400, 'ไม่พบจำนวนเงิน ลองพิมพ์แบบ "กาแฟ 55"');
        return json(await addTransactions(db, userId, parsed, "web"), 201);
      }
      const items = body.data.items.map((i) => ({ ...i, amountSatang: toSatang(i.amount) }));
      return json(await addTransactions(db, userId, items, "web"), 201);
    }

    const match = path.match(/^\/api\/transactions\/([^/]+)(\/restore)?$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      if (match[2] && method === "POST") return json(await restoreTransaction(db, userId, id));
      if (!match[2] && method === "DELETE") return json(await deleteTransaction(db, userId, id));
      if (!match[2] && method === "PATCH") {
        const body = patchBody.safeParse(await readJson(request));
        if (!body.success) return error(400, "ข้อมูลไม่ถูกต้อง");
        const { amount, ...rest } = body.data;
        return json(
          await updateTransaction(db, userId, id, { ...rest, amountSatang: amount === undefined ? undefined : toSatang(amount) }),
        );
      }
    }

    return error(404, "ไม่พบ");
  } catch (err) {
    if (err instanceof AuthError) return error(err.code === "invalid_input" ? 400 : err.code === "registration_closed" ? 403 : 401, err.message);
    if (err instanceof ServiceError) return error(err.code === "not_found" ? 404 : 400, err.message);
    throw err;
  }
}
