"use client";

import { useEffect, useState, useCallback } from "react";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { api, type BillingSummary, type CreditPack } from "@/lib/api-client";

interface BillingSectionProps {
  userId: string;
}

export function BillingSection({ userId }: BillingSectionProps) {
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
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

        {/* Low credits warning */}
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
      {billing.hasCard && (
        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
          <span>Auto-charge</span>
          <span className={billing.autoChargeEnabled ? "text-green-500" : "text-muted-foreground"}>
            {billing.autoChargeEnabled ? "ON — $29/500cr when empty" : "OFF"}
          </span>
        </div>
      )}
    </div>
  );
}
