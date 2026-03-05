"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { api, type BillingSummary, type CreditPack } from "@/lib/api-client";

interface BillingSectionProps {
  userId: string;
}

export function BillingSection({ userId }: BillingSectionProps) {
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBilling = useCallback(async () => {
    try {
      const data = await api.billing.summary(userId);
      setBilling(data);
    } catch {
      // User may not have billing data yet
    }
  }, [userId]);

  useEffect(() => {
    fetchBilling();
    const interval = setInterval(fetchBilling, 15000);
    return () => clearInterval(interval);
  }, [fetchBilling]);

  async function handleAddCard() {
    setAddingCard(true);
    setError(null);
    try {
      const { checkoutUrl } = await api.billing.addCard(userId);
      window.open(checkoutUrl, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start card setup");
    } finally {
      setAddingCard(false);
    }
  }

  async function handlePurchase(packSlug: string) {
    setPurchasing(packSlug);
    setError(null);
    try {
      const { checkoutUrl } = await api.billing.purchase(userId, packSlug);
      window.open(checkoutUrl, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setPurchasing(null);
    }
  }

  if (!billing) {
    return (
      <div className="border border-dashed border-border p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Credits
          </span>
          <span className="text-lg font-bold text-primary animate-pulse">—</span>
        </div>
      </div>
    );
  }

  // ─── No card yet: show gate ───────────────────────────────────
  if (!billing.hasCard) {
    return (
      <div className="space-y-3">
        <div className="border border-dashed border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Credits
            </span>
            <span className="text-lg font-bold text-muted-foreground">0</span>
          </div>
          <div className="border-t border-dashed border-border pt-3">
            <p className="text-[11px] font-semibold text-foreground mb-1">
              Add a card to get started
            </p>
            <p className="text-[9px] text-muted-foreground mb-3 leading-relaxed">
              Get 50 free credits instantly. No charge until you buy a pack.
            </p>
            <Button
              size="sm"
              className="w-full text-[10px] uppercase tracking-wider"
              onClick={handleAddCard}
              disabled={addingCard}
            >
              {addingCard ? "Opening..." : "Add Card — Get 50 Free Credits"}
            </Button>
            {error && (
              <p className="text-[9px] text-destructive mt-2">{error}</p>
            )}
          </div>
        </div>

        {/* Show what 50 credits gets you */}
        <div className="border border-dashed border-border p-3">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2">
            50 credits gets you
          </p>
          <div className="space-y-1 text-[9px] text-muted-foreground">
            <div className="flex justify-between">
              <span>~16 tweets posted</span>
              <span className="text-foreground">3 cr each</span>
            </div>
            <div className="flex justify-between">
              <span>~10 outreach emails</span>
              <span className="text-foreground">5 cr each</span>
            </div>
            <div className="flex justify-between">
              <span>~10 research tasks</span>
              <span className="text-foreground">5 cr each</span>
            </div>
            <div className="flex justify-between">
              <span>Reports & chat</span>
              <span className="text-green-500">free</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Has card: show balance + top up ──────────────────────────
  return (
    <div className="space-y-3">
      {/* Credit balance */}
      <div className="border border-dashed border-border p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Credits
          </span>
          <span
            className={`text-lg font-bold ${
              billing.credits <= 5
                ? "text-destructive"
                : billing.credits <= 20
                  ? "text-yellow-500"
                  : "text-primary"
            }`}
          >
            {billing.credits.toLocaleString()}
          </span>
        </div>

        {billing.credits <= 10 && billing.credits > 0 && (
          <p className="text-[9px] text-yellow-500 mt-2 pt-2 border-t border-dashed border-border">
            Low credits — top up to keep agents running
          </p>
        )}
        {billing.credits === 0 && (
          <p className="text-[9px] text-destructive mt-2 pt-2 border-t border-dashed border-border">
            No credits — tasks are paused
          </p>
        )}
      </div>

      {/* Credit packs */}
      <CollapsibleSection title="Top Up" defaultOpen={billing.credits <= 20}>
        <div className="space-y-1.5">
          {billing.packs.map((pack: CreditPack) => (
            <button
              key={pack.slug}
              onClick={() => handlePurchase(pack.slug)}
              disabled={purchasing !== null}
              className="w-full flex items-center justify-between border border-dashed border-border p-2 hover:border-primary hover:bg-primary/5 transition-all text-left disabled:opacity-50"
            >
              <div>
                <span className="text-[10px] font-semibold text-foreground">
                  {pack.credits.toLocaleString()} credits
                </span>
                <span className="text-[9px] text-muted-foreground ml-1.5">
                  {pack.name}
                </span>
              </div>
              <span className="text-[10px] font-bold text-primary">
                {purchasing === pack.slug ? "..." : `$${pack.price}`}
              </span>
            </button>
          ))}
          {error && (
            <p className="text-[9px] text-destructive">{error}</p>
          )}
        </div>
      </CollapsibleSection>

      {/* Recent transactions */}
      {billing.recentTransactions.length > 0 && (
        <CollapsibleSection title="History" defaultOpen={false}>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {billing.recentTransactions.slice(0, 10).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between text-[9px] py-1 border-b border-dashed border-border last:border-0"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`shrink-0 ${
                      tx.amount > 0 ? "text-green-500" : "text-red-400"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </span>
                  <span className="text-muted-foreground truncate">
                    {tx.description.length > 35
                      ? tx.description.slice(0, 35) + "..."
                      : tx.description}
                  </span>
                </div>
                <span className="text-muted-foreground/60 shrink-0 ml-1">
                  {new Date(tx.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Auto-charge indicator */}
      {billing.autoChargeEnabled && (
        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
          <span>Auto-charge</span>
          <span className="text-green-500">ON — $29/500cr when empty</span>
        </div>
      )}
    </div>
  );
}
