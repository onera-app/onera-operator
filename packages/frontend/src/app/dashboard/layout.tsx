"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn } = useUser();
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation header */}
      <header className="border-b border-dashed border-border bg-background">
        <div className="flex h-12 items-center justify-between px-6">
          <Link
            href="/dashboard"
            className="text-xl font-bold tracking-tight text-primary"
          >
            OneraOS
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/new">
              <Button size="sm" variant="outline" className="gap-1.5">
                + New
              </Button>
            </Link>

            <UserButton />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
