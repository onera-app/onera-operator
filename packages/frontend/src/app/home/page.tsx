import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background bp-texture">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-dashed border-border px-8 py-4 relative z-10">
        <span className="text-lg font-bold tracking-tight text-primary">
          OneraOS
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="https://github.com/anomalyco/onera-operator"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
          >
            GitHub
          </Link>
          <Link href="/login">
            <Button variant="outline" size="sm">
              Login &rsaquo;
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 relative z-10">
        <div className="mx-auto max-w-3xl">
          {/* Blueprint tag */}
          <div className="inline-block border-2 border-primary bg-primary text-primary-foreground px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-bold mb-8">
            Open Source AI Operator
          </div>

          <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-primary sm:text-6xl">
            AI That Runs Your
            <br />
            Company While
            <br />
            You Sleep.
          </h1>

          <p className="mt-8 text-sm leading-relaxed text-muted-foreground max-w-xl">
            Onera Operator thinks, builds, and markets your projects
            autonomously. It plans, codes, and promotes your ideas continuously
            &mdash; operating 24/7, adapting to data, and improving itself
            without human intervention.
          </p>

          {/* Feature grid */}
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-xl">
            <div className="border border-dashed border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Marketing
              </p>
              <p className="text-xs font-semibold text-primary">
                Auto tweets, cold outreach, lead gen
              </p>
            </div>
            <div className="border border-dashed border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Research
              </p>
              <p className="text-xs font-semibold text-primary">
                Competitor analysis, web search
              </p>
            </div>
            <div className="border border-dashed border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Reports
              </p>
              <p className="text-xs font-semibold text-primary">
                Daily ops reports, task planning
              </p>
            </div>
          </div>

          <div className="mt-10 flex items-center gap-4">
            <Button asChild size="lg">
              <Link href="/login">Get Started &rarr;</Link>
            </Button>
            <Link
              href="/live"
              className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
            >
              Watch it live &rsaquo;
            </Link>
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">
            No credit card &middot; 100 free credits
          </p>
        </div>
      </main>

      {/* Terminal preview */}
      <div className="mx-8 mb-8 relative z-10">
        <div className="terminal-bar p-4 border border-border/30">
          <div className="terminal-line opacity-60">
            Initializing Onera Operator v1.0...
          </div>
          <div className="terminal-line opacity-60">
            Loading agents: planner, twitter, outreach, research, report
          </div>
          <div className="terminal-line">
            Agent loop scheduled: every 4 hours
          </div>
          <div className="terminal-line">
            Daily report generation: 6:00 PM
          </div>
          <div className="terminal-line cursor-blink">
            System ready. Awaiting company setup
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-dashed border-border py-6 px-8 relative z-10">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
          <span>Onera Operator &middot; Open Source</span>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-primary transition-colors">
              About
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Privacy
            </a>
            <a
              href="mailto:contact@oneraos.com"
              className="hover:text-primary transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
