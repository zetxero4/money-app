// MCP server (Streamable HTTP แบบ stateless) — เรียก service layer ชุดเดียวกับหน้าเว็บ

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import type { Db } from "./db";
import { bahtToSatang } from "./money";
import { type Period, rangeForPeriod, todayInBangkok } from "./thai-date";
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

const PERIODS = ["today", "this_week", "this_month", "last_month", "this_year", "last_7_days", "last_30_days"] as const;
const kindSchema = z.enum(["income", "expense"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ใช้รูปแบบ YYYY-MM-DD");
const amountSchema = z.number().positive().describe("จำนวนเงินเป็นบาท เช่น 60 หรือ 65.50");

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function toSatang(amount: number): number {
  const satang = bahtToSatang(amount);
  if (satang === null) throw new ServiceError("invalid_input", `จำนวนเงินไม่ถูกต้อง: ${amount} (ทศนิยมได้ไม่เกิน 2 ตำแหน่ง)`);
  return satang;
}

async function run(fn: () => Promise<unknown>) {
  try {
    return ok(await fn());
  } catch (err) {
    if (err instanceof ServiceError) return { isError: true, content: [{ type: "text" as const, text: err.message }] };
    throw err;
  }
}

export function buildMcpServer(db: Db, userId: string): McpServer {
  const today = todayInBangkok();
  const server = new McpServer(
    { name: "money", version: "1.0.0" },
    {
      instructions:
        `แอปจดรายรับรายจ่ายส่วนตัว (สกุลเงินบาท) วันนี้ตามเวลาไทยคือ ${today}. ` +
        `เมื่อผู้ใช้พิมพ์รายการ เช่น "ข้าวมันไก่ 60 กาแฟ 55" ให้แยกเป็นหลายรายการแล้วเรียก add_transactions ครั้งเดียว. ` +
        `"เมื่อวาน" ให้คำนวณวันที่จากวันนี้. ถ้าไม่ระบุหมวด ระบบจะเดาให้. ` +
        `ถ้าจะแก้หรือลบรายการ ให้เรียก list_transactions หา id ก่อน.`,
    },
  );

  server.registerTool(
    "add_transactions",
    {
      title: "จดรายการ",
      description: "บันทึกรายรับ/รายจ่ายหนึ่งหรือหลายรายการในครั้งเดียว รายการจะมีป้าย 'จาก Claude' บนหน้าเว็บ",
      inputSchema: {
        items: z
          .array(
            z.object({
              note: z.string().describe("ชื่อรายการ เช่น ข้าวมันไก่"),
              amount: amountSchema,
              kind: kindSchema.optional().describe("income = รายรับ, expense = รายจ่าย ถ้าไม่ระบุระบบเดาจากชื่อ"),
              category: z.string().optional().describe("ชื่อหมวดจาก list_categories ถ้าไม่ระบุระบบเดาให้"),
              date: dateSchema.optional().describe("วันที่ YYYY-MM-DD ตามเวลาไทย ถ้าไม่ระบุใช้วันนี้"),
            }),
          )
          .min(1)
          .max(50),
      },
    },
    ({ items }) =>
      run(() =>
        addTransactions(
          db,
          userId,
          items.map((i) => ({ note: i.note, amountSatang: toSatang(i.amount), kind: i.kind, category: i.category, occurredOn: i.date })),
          "claude",
        ),
      ),
  );

  server.registerTool(
    "list_transactions",
    {
      title: "ดูรายการ",
      description: "ค้นรายการตามช่วงเวลา หมวด ประเภท หรือคำค้น เรียงจากล่าสุด",
      inputSchema: {
        period: z.enum(PERIODS).optional().describe("ช่วงเวลาสำเร็จรูป ใช้แทน from/to"),
        from: dateSchema.optional(),
        to: dateSchema.optional(),
        category: z.string().optional(),
        kind: kindSchema.optional(),
        query: z.string().optional().describe("คำที่อยู่ในชื่อรายการ"),
        deleted: z.boolean().optional().describe("true = ดูรายการที่ลบแล้ว (ไว้กู้คืน)"),
        limit: z.number().int().min(1).max(200).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    (args) =>
      run(() => {
        const range = args.period ? rangeForPeriod(args.period as Period) : { from: args.from, to: args.to };
        return listTransactions(db, userId, { ...range, category: args.category, kind: args.kind, query: args.query, deleted: args.deleted, limit: args.limit });
      }),
  );

  server.registerTool(
    "update_transaction",
    {
      title: "แก้รายการ",
      description: "แก้ยอด ชื่อ หมวด ประเภท หรือวันที่ของรายการ (หา id จาก list_transactions)",
      inputSchema: {
        id: z.string(),
        note: z.string().optional(),
        amount: amountSchema.optional(),
        kind: kindSchema.optional(),
        category: z.string().optional(),
        date: dateSchema.optional(),
      },
    },
    (args) =>
      run(() =>
        updateTransaction(db, userId, args.id, {
          note: args.note,
          amountSatang: args.amount === undefined ? undefined : toSatang(args.amount),
          kind: args.kind,
          category: args.category,
          occurredOn: args.date,
        }),
      ),
  );

  server.registerTool(
    "delete_transaction",
    {
      title: "ลบรายการ",
      description: "ลบรายการ (กู้คืนได้ด้วย restore_transaction)",
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true },
    },
    ({ id }) => run(() => deleteTransaction(db, userId, id)),
  );

  server.registerTool(
    "restore_transaction",
    { title: "กู้คืนรายการ", description: "กู้คืนรายการที่ลบไปแล้ว", inputSchema: { id: z.string() } },
    ({ id }) => run(() => restoreTransaction(db, userId, id)),
  );

  server.registerTool(
    "get_summary",
    {
      title: "สรุปรายรับรายจ่าย",
      description: "ยอดรวมรายรับ รายจ่าย คงเหลือ แยกตามหมวด พร้อมเทียบกับช่วงก่อนหน้าที่ยาวเท่ากัน",
      inputSchema: {
        period: z.enum(PERIODS).optional().describe("ค่าเริ่มต้น this_month"),
        from: dateSchema.optional(),
        to: dateSchema.optional(),
      },
      annotations: { readOnlyHint: true },
    },
    (args) =>
      run(() => {
        const range =
          args.from && args.to ? { from: args.from, to: args.to } : rangeForPeriod((args.period ?? "this_month") as Period);
        return getSummary(db, userId, range);
      }),
  );

  server.registerTool(
    "list_categories",
    { title: "ดูหมวด", description: "รายชื่อหมวดรายรับและรายจ่าย", inputSchema: {}, annotations: { readOnlyHint: true } },
    () => run(async () => (await listCategories(db, userId)).map(({ name, kind }) => ({ name, kind }))),
  );

  return server;
}

/** จัดการคำขอ /mcp หนึ่งครั้ง (stateless: สร้าง server ใหม่ทุกคำขอ) */
export async function handleMcpRequest(request: Request, db: Db, userId: string): Promise<Response> {
  const server = buildMcpServer(db, userId);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}
