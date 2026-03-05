"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  /** Section title displayed in the header */
  title: string;
  /** Whether the section starts expanded (default: true) */
  defaultOpen?: boolean;
  /** Optional badge/count rendered next to the title */
  badge?: ReactNode;
  /** Optional right-aligned element in the header (shown regardless of collapse state) */
  trailing?: ReactNode;
  /** Content to show/hide */
  children: ReactNode;
  /** Additional className for the outer wrapper */
  className?: string;
}

export function CollapsibleSection({
  title,
  defaultOpen = true,
  badge,
  trailing,
  children,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 group cursor-pointer select-none"
      >
        <span className="text-xs text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0">
          {open ? "▼" : "▶"}
        </span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">
          {title}
        </span>
        {badge && <span className="shrink-0">{badge}</span>}
        {trailing && <span className="ml-auto shrink-0">{trailing}</span>}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
