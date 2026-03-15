"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TerminalBar } from "@/components/dashboard/terminal-bar";
import { publicApi, type PublicLiveData } from "@/lib/api-client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const isAdmin = user?.publicMetadata?.role === "admin";
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/login");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <span className="text-xs text-muted-foreground uppercase tracking-wider animate-pulse">
          Loading...
        </span>
      </div>
    );
  }

  if (!isSignedIn) return null;

  return (
    <div className="h-screen overflow-hidden bg-background bg-blueprint flex flex-col">
      {/* Terminal bar at the very top — like the live page */}
      <TerminalBar />

      {/* Navigation header */}
      <header className="border-b-2 border-dashed border-border bg-background/90 backdrop-blur-sm">
        <div className="flex h-12 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/home"
              className="font-serif text-2xl font-extrabold tracking-tight text-primary hover:opacity-80 transition-opacity"
            >
              Onera Operator
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/emails"
              className="text-[10px] uppercase tracking-wider font-bold font-mono text-muted-foreground hover:text-primary transition-colors"
            >
              Emails
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                className="text-[10px] uppercase tracking-wider font-bold font-mono text-muted-foreground hover:text-primary transition-colors"
              >
                Admin
              </Link>
            )}

            <Link
              href="/live"
              className="flex items-center gap-1.5 border border-[#fa782a]/30 bg-[#fa782a]/10 hover:bg-[#fa782a]/20 text-[#ea580c] px-2 py-1 text-[10px] uppercase tracking-wider font-bold transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#fa782a] animate-pulse" />
              Live
            </Link>

            <Link href="/new">
              <Button size="sm" variant="outline" className="gap-1.5">
                + New
              </Button>
            </Link>

            <UserButton />
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
    </div>
  );
}
