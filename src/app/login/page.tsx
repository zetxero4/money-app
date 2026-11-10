"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

// กลับไปได้เฉพาะหน้าอนุญาต OAuth หรือหน้าในเว็บเอง (กัน open redirect)
function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/";
  return next.startsWith("/authorize?") || next === "/" ? next : "/";
}

export default function LoginPage() {
  const [status, setStatus] = useState<{ registrationOpen: boolean } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ registrationOpen: boolean; user: unknown }>("/api/auth/status").then((s) => {
      if (s.user) window.location.href = safeNext();
      else setStatus(s);
    });
  }, []);

  const register = status?.registrationOpen ?? false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(register ? "/api/auth/register" : "/api/auth/login", { method: "POST", body: { email, password } });
      window.location.href = safeNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Wallet className="size-5" />
          </div>
          <CardTitle>{register ? "สร้างบัญชีเจ้าของ" : "เข้าสู่ระบบ"}</CardTitle>
          <CardDescription>
            {register
              ? "บัญชีแรกที่สมัครจะเป็นเจ้าของ หลังจากนั้นระบบจะปิดรับสมัคร"
              : "ล็อกอินเพื่อจดและดูสรุปรายรับรายจ่าย"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === null ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">อีเมล</Label>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">รหัสผ่าน</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                  minLength={register ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {register && <p className="text-xs text-muted-foreground">อย่างน้อย 8 ตัวอักษร</p>}
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "กำลังดำเนินการ…" : register ? "สร้างบัญชี" : "เข้าสู่ระบบ"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
