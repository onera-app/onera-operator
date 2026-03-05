"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import Link from "next/link";

export default function NewCompanyPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <span className="text-xs text-muted-foreground uppercase tracking-wider animate-pulse">
          Loading...
        </span>
      </div>
    );
  }

  if (!isSignedIn) {
    router.push("/login");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api.projects.create({
        name,
        website: website || undefined,
        autoResearch: !!website,
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background px-4 bp-texture">
      <div className="relative z-10 mx-auto my-auto w-full max-w-lg overflow-y-auto py-8 scrollbar-thin">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center text-xs text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider mb-6"
        >
          &larr; Back to Dashboard
        </Link>

        {/* Tag */}
        <div className="inline-block border-2 border-primary bg-primary text-primary-foreground px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-bold mb-4">
          New Company
        </div>

        {/* Form card */}
        <div className="border-[1.5px] border-dashed border-border p-8 relative bp-corners">
          <div className="mb-6">
            <h1 className="font-serif text-3xl font-extrabold tracking-tight text-primary">
              Create a Company
            </h1>
            <p className="text-xs text-muted-foreground mt-2">
              Enter your company name and website. AI will automatically
              research your product, competitors, and target audience.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-[10px] uppercase tracking-wider text-muted-foreground"
              >
                Company Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Acme Inc."
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="website"
                className="text-[10px] uppercase tracking-wider text-muted-foreground"
              >
                Website URL
              </Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Optional &middot; Enables auto-research
              </p>
            </div>

            {error && (
              <div className="border border-destructive/50 bg-destructive/5 px-3 py-2">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading || !name.trim()}
            >
              {loading ? (
                <span className="animate-pulse">Researching...</span>
              ) : (
                "Create & Start Research"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
