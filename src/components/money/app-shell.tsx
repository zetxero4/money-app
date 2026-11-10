"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChartPie, LogOut, PenLine, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "จด", icon: PenLine },
  { href: "/summary", label: "สรุป", icon: ChartPie },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    api<{ user: { email: string } | null }>("/api/auth/status").then((s) => {
      if (!s.user) window.location.href = "/login";
      else setEmail(s.user.email);
    });
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (!email) {
    return <main className="flex flex-1 items-center justify-center text-sm text-muted-foreground">กำลังโหลด…</main>;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-24 sm:pb-8">
      <header className="flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Wallet className="size-4" />
          </span>
          จดเงิน
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm",
                pathname === n.href ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
          <Button variant="ghost" size="sm" onClick={logout} title={email}>
            <LogOut /> ออก
          </Button>
        </nav>
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={logout} aria-label="ออกจากระบบ">
          <LogOut />
        </Button>
      </header>
      <main className="flex-1">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 flex border-t bg-background/95 backdrop-blur sm:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs",
              pathname === n.href ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            <n.icon className="size-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
