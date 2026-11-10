import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// ไม่ใช้ incremental cache (R2) เพราะหน้าเว็บดึงข้อมูลผ่าน /api ฝั่งเบราว์เซอร์ทั้งหมด
export default defineCloudflareConfig({});
