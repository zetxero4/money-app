// จุดเข้าเดียวของ Cloudflare Worker
//   /mcp                      → MCP server (ต้องมี OAuth token ไม่มีตอบ 401)
//   /authorize                → หน้าอนุญาตให้ Claude เข้าถึง
//   /oauth/*, /.well-known/*  → OAuthProvider จัดการเอง
//   /api/*                    → JSON API ของหน้าเว็บ
//   อื่นๆ                     → หน้าเว็บ Next.js (OpenNext)
import { OAuthProvider, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
// ไฟล์นี้สร้างตอน `opennextjs-cloudflare build` (ไม่มีชนิดข้อมูล)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import nextWorker from "./.open-next/worker.js";
import { handleApi } from "./src/server/api";
import { handleAuthorize } from "./src/server/authorize";
import { handleMcpRequest } from "./src/server/mcp";

type AppEnv = Env & { PUBLIC_URL?: string; OAUTH_PROVIDER: OAuthHelpers };

const defaultHandler = {
  async fetch(request: Request, env: AppEnv, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/authorize") return handleAuthorize(request, env.DB, env.OAUTH_PROVIDER);
    if (pathname.startsWith("/api/")) return handleApi(request, env.DB);
    return nextWorker.fetch(request, env, ctx);
  },
};

const mcpHandler = {
  async fetch(request: Request, env: AppEnv, ctx: ExecutionContext): Promise<Response> {
    const props = (ctx as ExecutionContext & { props?: { userId?: string } }).props;
    if (!props?.userId) return new Response("Unauthorized", { status: 401 });
    return handleMcpRequest(request, env.DB, props.userId);
  },
};

// resource ของ OAuth ต้องเป็น URL จริงของเว็บ: ใช้ PUBLIC_URL ถ้าตั้งไว้ ไม่งั้นใช้ origin ของคำขอ
const providers = new Map<string, OAuthProvider<AppEnv>>();
function providerFor(origin: string): OAuthProvider<AppEnv> {
  let provider = providers.get(origin);
  if (!provider) {
    provider = new OAuthProvider<AppEnv>({
      apiRoute: "/mcp",
      apiHandler: mcpHandler,
      defaultHandler,
      authorizeEndpoint: "/authorize",
      tokenEndpoint: "/oauth/token",
      clientRegistrationEndpoint: "/oauth/register",
      clientIdMetadataDocumentEnabled: true,
      scopesSupported: ["money"],
      requiredScopes: ["money"],
      resourceMetadata: { resource: `${origin}/mcp`, authorization_servers: [origin] },
    });
    providers.set(origin, provider);
  }
  return provider;
}

const worker = {
  fetch(request: Request, env: AppEnv, ctx: ExecutionContext): Promise<Response> {
    const origin = (env.PUBLIC_URL ?? new URL(request.url).origin).replace(/\/+$/, "").toLowerCase();
    return providerFor(origin).fetch(request, env, ctx);
  },
};

export default worker;
