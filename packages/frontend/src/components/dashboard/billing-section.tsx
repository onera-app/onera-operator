"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { api, type BillingSummary, type CreditPack } from "@/lib/api-client";

export function BillingSection() {
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBilling = useCallback(async () => {
    try {
      const data = await api.billing.summary();
      setBilling(data);
    } catch {
      // User may not have billing data yet
    }
  }, []);

  useEffect(() => {
    fetchBilling();
    const interval = setInterval(fetchBilling, 15000);
    return () => clearInterval(interval);
  }, [fetchBilling]);

  async function handleSubscribe() {
    setSubscribing(true);
    setError(null);
    try {
      const { checkoutUrl } = await api.billing.subscribe();
      window.open(checkoutUrl, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start subscription");
    } finally {
      setSubscribing(false);
    }
  }

  async function handlePurchase(packSlug: string) {
    setPurchasing(packSlug);
    setError(null);
    try {
      const { checkoutUrl } = await api.billing.purchase(packSlug);
      window.open(checkoutUrl, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setPurchasing(null);
    }
  }

  if (!billing) {
    return (
      <div className="border border-dashed border-border p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Credits
          </span>
          <span className="text-lg font-bold text-primary animate-pulse">--</span>
        </div>
      </div>
    );
  }

  // ─── No subscription yet: show free trial gate ────────────────
  if (!billing.hasSubscription) {
    return (
      <div className="space-y-3">
        <div className="border border-dashed border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Credits
            </span>
            <span className="text-lg font-bold text-muted-foreground">0</span>
          </div>
          <div className="border-t border-dashed border-border pt-3">
            <p className="text-sm font-semibold text-foreground mb-1">
              Start your free trial
            </p>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Get 50 credits free for 3 days. After that, $29/mo for 500
              credits. Cancel anytime.
            </p>
            <Button
              size="sm"
              className="w-full text-xs uppercase tracking-wider"
              onClick={handleSubscribe}
              disabled={subscribing}
            >
              {subscribing ? "Opening checkout..." : "Start Free Trial — 50 Credits"}
            </Button>
            {error && (
              <p className="text-xs text-destructive mt-2">{error}</p>
            )}
          </div>
        </div>

        {/* Show what you get */}
        <div className="border border-dashed border-border p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            What&apos;s included
          </p>
          <div className="space-y-1.5 text-[13px] text-muted-foreground">
            <div className="flex justify-between">
              <span>3-day free trial</span>
              <span className="text-green-500">50 credits</span>
            </div>
            <div className="flex justify-between">
              <span>Then $29/month</span>
              <span className="text-foreground">500 credits</span>
            </div>
            <div className="flex justify-between">
              <span>Reports & chat</span>
              <span className="text-green-500">always free</span>
            </div>
            <div className="flex justify-between">
              <span>Cancel anytime</span>
              <span className="text-foreground">no lock-in</span>
            </div>
          </div>
        </div>

        {/* Credit costs */}
        <div className="border border-dashed border-border p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Credit costs
          </p>
          <div className="space-y-1.5 text-[13px] text-muted-foreground">
            <div className="flex justify-between">
              <span>Tweet</span>
              <span className="text-foreground">3 credits</span>
            </div>
            <div className="flex justify-between">
              <span>Outreach email</span>
              <span className="text-foreground">5 credits</span>
            </div>
            <div className="flex justify-between">
              <span>Research / Engineering</span>
              <span className="text-foreground">5 credits</span>
            </div>
            <div className="flex justify-between">
              <span>Planning</span>
              <span className="text-foreground">1 credit</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Has subscription: show balance + status + top up ─────────
  return (
    <div className="space-y-3">
      {/* Credit balance */}
      <div className="border border-dashed border-border p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Credits
          </span>
          <span
            className={`text-xl font-bold ${
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

        {/* Subscription status */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-border">
          <span className="text-xs text-muted-foreground">Subscription</span>
          {billing.isTrialing && billing.trialEndsAt ? (
            <span className="text-xs text-blue-400">
              Trial ends {new Date(billing.trialEndsAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          ) : billing.subscriptionStatus === "active" ? (
            <span className="text-xs text-green-500">Active | $29/mo</span>
          ) : billing.subscriptionStatus === "cancelled" ? (
            <span className="text-xs text-red-400">Cancelled</span>
          ) : billing.subscriptionStatus === "on_hold" ? (
            <span className="text-xs text-yellow-500">On Hold</span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {billing.subscriptionStatus ?? "Unknown"}
            </span>
          )}
        </div>

        {billing.credits <= 10 && billing.credits > 0 && (
          <p className="text-xs text-yellow-500 mt-2 pt-2 border-t border-dashed border-border">
            Low credits. Top up to keep agents running.
          </p>
        )}
        {billing.credits === 0 && (
          <p className="text-xs text-destructive mt-2 pt-2 border-t border-dashed border-border">
            No credits. Tasks are paused.
          </p>
        )}
      </div>

      {/* Credit packs (top-up) */}
      <CollapsibleSection title="Top Up" defaultOpen={billing.credits <= 20}>
        <div className="space-y-2">
          {billing.packs.map((pack: CreditPack) => (
            <button
              key={pack.slug}
              onClick={() => handlePurchase(pack.slug)}
              disabled={purchasing !== null}
              className="w-full flex items-center justify-between border border-dashed border-border p-3 hover:border-primary hover:bg-primary/5 transition-all text-left disabled:opacity-50"
            >
              <div>
                <span className="text-[13px] font-semibold text-foreground">
                  {pack.credits.toLocaleString()} credits
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {pack.name}
                </span>
              </div>
              <span className="text-[13px] font-bold text-primary">
                {purchasing === pack.slug ? "..." : `$${pack.price}`}
              </span>
            </button>
          ))}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
      </CollapsibleSection>

      {/* Recent transactions */}
      {billing.recentTransactions.length > 0 && (
        <CollapsibleSection title="History" defaultOpen={false}>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {billing.recentTransactions.slice(0, 10).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between text-xs py-1.5 border-b border-dashed border-border last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`shrink-0 font-medium ${
                      tx.amount > 0 ? "text-green-500" : "text-red-400"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </span>
                  <span className="text-muted-foreground truncate">
                    {tx.description.length > 40
                      ? tx.description.slice(0, 40) + "..."
                      : tx.description}
                  </span>
                </div>
                <span className="text-muted-foreground/60 shrink-0 ml-2">
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
    </div>
  );
}
