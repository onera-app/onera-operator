"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/emails", label: "Emails" },
  { href: "/admin/tasks", label: "Tasks" },
  { href: "/admin/agents", label: "Agents" },
  { href: "/admin/tweets", label: "Tweets" },
  { href: "/admin/billing", label: "Billing" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoaded && user) {
      const role = (user.publicMetadata as Record<string, unknown>)?.role;
      if (role !== "admin") {
        router.push("/dashboard");
      }
    }
    if (isLoaded && !user) {
      router.push("/login");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <span className="text-xs text-muted-foreground uppercase tracking-wider animate-pulse">Loading...</span>
      </div>
    );
  }

  const role = (user.publicMetadata as Record<string, unknown>)?.role;
  if (role !== "admin") return null;

  return (
    <div className="h-screen flex flex-col bg-background bg-blueprint overflow-hidden">
      {/* Admin header */}
      <header className="border-b-2 border-primary bg-terminal text-white shrink-0">
        <div className="flex h-12 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="font-mono text-sm font-bold text-primary">
              ONERA ADMIN
            </Link>
            <Separator orientation="vertical" className="h-6 bg-zinc-700" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
              System Management Console
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:border-primary hover:text-primary text-[10px] font-mono">
                Dashboard
              </Button>
            </Link>
            <UserButton />
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 border-r-2 border-border bg-white/80 backdrop-blur-sm shrink-0 overflow-y-auto">
          <nav className="p-3 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-3 py-2 text-xs font-mono uppercase tracking-wider transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary border-l-2 border-primary font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
