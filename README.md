# จดเงิน (money-app)

เว็บแอปบันทึกรายรับรายจ่าย จดได้ทั้งผ่านหน้าเว็บและผ่าน Claude (MCP) ใช้ข้อมูลชุดเดียวกัน
สร้างตามคู่มือ keaykub.dev "คู่มือสร้างแอปจดเงิน + ต่อ Claude ผ่าน MCP"

- **หน้าเว็บ:** Next.js + shadcn/ui + lucide · พิมพ์ "กะเพราไข่ดาว 65 กาแฟ 55" แล้วกด Enter ระบบแยกรายการและเดาหมวดให้
- **Claude:** MCP ที่ `/mcp` ล็อกอินด้วย OAuth · รายการที่จดผ่าน Claude มีป้าย "จาก Claude"
- **ข้อมูล:** Cloudflare D1 · เงินเก็บเป็นสตางค์ · วันที่ตามเวลาไทย · ลบแล้วกู้คืนได้
- **ผู้ใช้คนเดียว:** บัญชีแรกที่สมัครเป็นเจ้าของ แล้วระบบปิดรับสมัคร

## โครงระบบ

```
เบราว์เซอร์ ─► หน้าเว็บ (Next.js ผ่าน OpenNext) ─► /api/*  ┐
Claude ─────► /mcp (ต้องมี OAuth token)                 ├─► src/server/services/* ─► D1
                                                          ┘
ทั้งหมดอยู่ใน Cloudflare Worker ตัวเดียว (worker.ts) · OAuth เก็บใน KV (OAUTH_KV)
```

| ไฟล์ | หน้าที่ |
|---|---|
| `worker.ts` | จุดเข้า: แยกเส้นทาง /mcp, /authorize, /oauth/*, /api/*, หน้าเว็บ |
| `src/server/services/` | service layer ที่หน้าเว็บและ MCP ใช้ร่วมกัน |
| `src/server/mcp.ts` | เครื่องมือ MCP |
| `src/server/authorize.ts` | หน้าอนุญาตให้ Claude เข้าถึง |
| `src/server/api.ts` | JSON API ของหน้าเว็บ |
| `migrations/` | schema ของ D1 |

เครื่องมือ MCP: `add_transactions`, `list_transactions`, `update_transaction`, `delete_transaction`,
`restore_transaction`, `get_summary`, `list_categories`

## รันบนเครื่อง

```sh
npm install
npm test                      # เทสต์ service layer
npm run db:migrate:local      # สร้างตารางใน D1 จำลองบนเครื่อง
npm run preview               # build แล้วรันที่ http://localhost:8787
```

## Deploy ขึ้น Cloudflare (ทำเอง)

1. ล็อกอิน: `npx wrangler login`
2. สร้างฐานข้อมูลและ KV แล้วนำ id ที่ได้ไปแทนค่า `00000…` ใน `wrangler.jsonc`
   ```sh
   npx wrangler d1 create money-app
   npx wrangler kv namespace create OAUTH_KV
   ```
3. สร้างตาราง: `npm run db:migrate:remote`
4. Deploy: `npm run deploy`
5. **เปิดเว็บแล้วสมัครบัญชีเจ้าของทันที** (ก่อนมีบัญชี ใครเปิดลิงก์ได้ก่อนจะได้เป็นเจ้าของ)

ถ้าอยากให้ push แล้ว deploy เอง: เชื่อม repo นี้ใน Cloudflare dashboard (Workers Builds)
ตั้ง build command เป็น `npx opennextjs-cloudflare build` และ deploy command เป็น `npx wrangler deploy`
ตอนติดตั้งแอป Cloudflare บน GitHub ให้เลือก "Only select repositories" แล้วเลือกแค่ repo นี้
(ชื่อเมนูอาจเปลี่ยนตามเวอร์ชันของ Cloudflare)

> เรื่องค่าใช้จ่าย: Workers และ D1 มีแผนฟรีแต่มีขีดจำกัดขนาดโค้ดและปริมาณการใช้ เช็กหน้าราคาของ Cloudflare ก่อนใช้จริง

## ต่อเข้า Claude

**แอป Claude (เว็บ/เดสก์ท็อป):** Customize → Connectors → + Add → Add custom connector
ตั้งชื่อ `money` วาง URL `https://<โดเมนของคุณ>/mcp` กด Connect แล้วล็อกอินและกด "อนุญาต"

**Claude Code:**
```sh
claude mcp add --transport http money https://<โดเมนของคุณ>/mcp
```
แล้วพิมพ์ `/mcp` เลือก money กด Authenticate

ต้อง deploy ขึ้นอินเทอร์เน็ตก่อน เพราะ Claude เชื่อมจากคลาวด์ ใช้ localhost ไม่ได้

## เช็กลิสต์ก่อนใช้จริง

- [ ] `.dev.vars` / `.env` อยู่ใน `.gitignore` และไม่ขึ้น GitHub
- [ ] repo เป็น Private
- [ ] `curl -i -X POST https://<โดเมน>/mcp` ต้องได้ 401
- [ ] สมัครบัญชีเจ้าของแล้ว ลองสมัครอีกบัญชี ต้องถูกปฏิเสธ
- [ ] จดผ่าน Claude แล้วเปิดเว็บ ต้องเห็นป้าย "จาก Claude"
