import type { FastifyInstance } from "fastify";
import { Webhooks } from "@dodopayments/fastify";
import {
  activateSubscription,
  handleSubscriptionRenewal,
  updateSubscriptionStatus,
  addCredits,
  getBillingSummary,
  getCreditHistory,
  CREDIT_PACKS,
  SUBSCRIPTION_PRODUCT_ID,
  TRIAL_PERIOD_DAYS,
} from "../services/billing.service.js";
import { prisma } from "@onera/database";

const DODO_ENV = (process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || "test_mode";
const DODO_API_BASE = DODO_ENV === "live_mode"
  ? "https://live.dodopayments.com"
  : "https://test.dodopayments.com";

export async function billingRoutes(app: FastifyInstance) {
  // ─── Subscribe: Start free trial ($29/mo after 3 days) ────────
  // Creates a DodoPayments checkout session for the subscription product.
  // User gets 50 bonus credits immediately on subscription activation.
  // After 3-day trial, $29/mo auto-charges and grants 500 credits.
  app.post(
    "/api/billing/subscribe", async (request, reply) => {
    const userId = request.authUser!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, dodoCustomerId: true, dodoSubscriptionId: true },
    });
    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }

    // Already has an active subscription
    if (user.dodoSubscriptionId) {
      return reply.code(400).send({ error: "Already subscribed" });
    }

    // Use Checkout Sessions API (recommended over deprecated /subscriptions)
    const response = await fetch(`${DODO_API_BASE}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
      },
      body: JSON.stringify({
        product_cart: [{ product_id: SUBSCRIPTION_PRODUCT_ID, quantity: 1 }],
        customer: {
          ...(user.dodoCustomerId ? { customer_id: user.dodoCustomerId } : {}),
          email: user.email || `${userId}@onera.chat`,
          name: user.name || "Onera User",
        },
        subscription_data: {
          trial_period_days: TRIAL_PERIOD_DAYS,
        },
        metadata: {
          userId,
          type: "subscription",
        },
        return_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard?subscription=success`,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      app.log.error({ err }, "DodoPayments subscription checkout failed");
      return reply.code(500).send({ error: "Subscription checkout failed" });
    }

    const data = await response.json() as { checkout_url: string; session_id: string };
    return reply.send({ checkoutUrl: data.checkout_url });
  });

  // ─── Purchase credit pack (one-time top-up) ───────────────────
  app.post<{
    Body: { packSlug: string };
  }>("/api/billing/purchase", async (request, reply) => {
    const userId = request.authUser!.id;
    const { packSlug } = request.body;

    const pack = CREDIT_PACKS.find((p) => p.slug === packSlug);
    if (!pack) {
      return reply.code(400).send({ error: "Invalid pack" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, dodoCustomerId: true },
    });
    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }

    const response = await fetch(`${DODO_API_BASE}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
      },
      body: JSON.stringify({
        product_cart: [{ product_id: pack.dodoProductId, quantity: 1 }],
        customer: {
          ...(user.dodoCustomerId ? { customer_id: user.dodoCustomerId } : {}),
          email: user.email || `${userId}@onera.chat`,
          name: user.name || "Onera User",
        },
        metadata: {
          userId,
          packSlug,
          type: "credit_pack",
        },
        return_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard?purchase=success&pack=${packSlug}`,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      app.log.error({ err }, "DodoPayments checkout failed");
      return reply.code(500).send({ error: "Payment creation failed" });
    }

    const data = await response.json() as { checkout_url: string; session_id: string };
    return reply.send({ checkoutUrl: data.checkout_url });
  });

  // ─── Webhook: Handle DodoPayments events ──────────────────────
  await app.register(async function webhookPlugin(webhookApp) {
    webhookApp.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (_req, body, done) => {
        done(null, body);
      }
    );

    webhookApp.post(
      "/api/billing/webhooks",
      Webhooks({
        webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY!,

        // ── Subscription lifecycle ──────────────────────────────
        onSubscriptionActive: async (payload) => {
          app.log.info({ payload }, "DodoPayments: subscription active");
          const data = payload.data as Record<string, unknown>;
          const metadata = (data.metadata || {}) as Record<string, string>;
          const subscriptionId = data.subscription_id as string;
          const customerId = data.customer_id as string;
          const userId = metadata.userId;

          if (!userId) return;

          // Activate subscription: link customer, set trial, give 50 bonus credits
          await activateSubscription(userId, customerId, subscriptionId);
          app.log.info({ userId, subscriptionId }, "Subscription activated with trial credits");
        },

        onSubscriptionCancelled: async (payload) => {
          app.log.info({ payload }, "DodoPayments: subscription cancelled");
          const data = payload.data as Record<string, unknown>;
          const metadata = (data.metadata || {}) as Record<string, string>;
          const userId = metadata.userId;

          if (!userId) {
            // Try to find user by subscription_id
            const subscriptionId = data.subscription_id as string;
            if (subscriptionId) {
              const user = await prisma.user.findUnique({
                where: { dodoSubscriptionId: subscriptionId },
                select: { id: true },
              });
              if (user) {
                await updateSubscriptionStatus(user.id, "cancelled");
              }
            }
            return;
          }

          await updateSubscriptionStatus(userId, "cancelled");
        },

        // ── Payment events (for renewals + one-time packs) ─────
        onPaymentSucceeded: async (payload) => {
          app.log.info({ payload }, "DodoPayments: payment succeeded");
          const data = payload.data as Record<string, unknown>;
          const metadata = (data.metadata || {}) as Record<string, string>;
          const paymentId = data.payment_id as string;
          const customerId = (data.customer as Record<string, unknown>)?.customer_id as string | undefined;
          const subscriptionId = data.subscription_id as string | undefined;

          // ── Idempotency: skip if this payment was already processed ──
          if (paymentId) {
            const existing = await prisma.creditTransaction.findFirst({
              where: { dodoPaymentId: paymentId },
            });
            if (existing) {
              app.log.info({ paymentId }, "Skipping duplicate payment webhook");
              return;
            }
          }

          // Resolve userId from metadata or subscription ID
          let userId = metadata.userId;
          if (!userId && subscriptionId) {
            const user = await prisma.user.findUnique({
              where: { dodoSubscriptionId: subscriptionId },
              select: { id: true },
            });
            if (user) userId = user.id;
          }
          if (!userId) {
            app.log.warn({ paymentId }, "No userId found for payment");
            return;
          }

          // Link DodoPayments customer ID if not already set
          if (customerId) {
            await prisma.user.updateMany({
              where: { id: userId, dodoCustomerId: null },
              data: { dodoCustomerId: customerId },
            });
          }

          if (metadata.type === "credit_pack") {
            // One-time credit pack purchase (top-up)
            const packSlug = metadata.packSlug;
            const pack = CREDIT_PACKS.find((p) => p.slug === packSlug);

            if (pack) {
              await addCredits(userId, pack.credits, {
                type: "PURCHASE",
                description: `Purchased ${pack.name}: ${pack.credits} credits`,
                dodoPaymentId: paymentId,
                packSlug: pack.slug,
              });
              app.log.info({ userId, pack: pack.slug }, "Credit pack purchased");
            }
          } else if (subscriptionId) {
            // Subscription renewal payment (after trial ends, $29/mo)
            // Trial payments are $0 — only grant credits for real charges
            const paymentAmount = data.total_amount as number | undefined;

            if (paymentAmount && paymentAmount > 0) {
              await handleSubscriptionRenewal(userId, paymentId);
              app.log.info({ userId, paymentAmount }, "Subscription renewal credits added");
            } else {
              app.log.info({ userId, paymentAmount }, "Skipping $0 trial payment — credits given via subscription.active");
            }
          }
        },

        onPaymentFailed: async (payload) => {
          app.log.warn({ payload }, "DodoPayments: payment failed");
        },
      })
    );
  });

  // ─── Get billing summary (authenticated) ──────────────────────
  app.get(
    "/api/billing/me",
    async (request, reply) => {
      const userId = request.authUser!.id;
      try {
        const summary = await getBillingSummary(userId);
        if (!summary) {
          return reply.code(404).send({ error: "User not found" });
        }
        return reply.send(summary);
      } catch (err) {
        request.log.error({ err, userId }, "Failed to fetch billing summary");
        // Fallback: return at least the credit balance so the dashboard isn't broken
        try {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { credits: true },
          });
          return reply.send({
            credits: user?.credits ?? 0,
            hasSubscription: false,
            subscriptionStatus: null,
            isTrialing: false,
            trialEndsAt: null,
            hasCard: false,
            autoChargeEnabled: true,
            recentTransactions: [],
            packs: CREDIT_PACKS.map((p) => ({
              slug: p.slug,
              name: p.name,
              credits: p.credits,
              price: p.price / 100,
            })),
          });
        } catch {
          return reply.code(500).send({ error: "Failed to fetch billing data" });
        }
      }
    }
  );

  // ─── Get credit history (authenticated) ───────────────────────
  app.get<{ Querystring: { limit?: string } }>(
    "/api/billing/me/history",
    async (request, reply) => {
      const userId = request.authUser!.id;
      const limit = parseInt(request.query.limit || "50", 10);
      const history = await getCreditHistory(userId, limit);
      return reply.send({ transactions: history });
    }
  );

  // ─── Legacy routes: keep for backwards compat, enforce ownership ──
  app.get<{ Params: { userId: string } }>(
    "/api/billing/:userId",
    async (request, reply) => {
      const authUserId = request.authUser!.id;
      if (request.params.userId !== authUserId) {
        return reply.code(403).send({ error: "Access denied" });
      }
      const summary = await getBillingSummary(authUserId);
      if (!summary) {
        return reply.code(404).send({ error: "User not found" });
      }
      return reply.send(summary);
    }
  );

  app.get<{ Params: { userId: string }; Querystring: { limit?: string } }>(
    "/api/billing/:userId/history",
    async (request, reply) => {
      const authUserId = request.authUser!.id;
      if (request.params.userId !== authUserId) {
        return reply.code(403).send({ error: "Access denied" });
      }
      const limit = parseInt(request.query.limit || "50", 10);
      const history = await getCreditHistory(authUserId, limit);
      return reply.send({ transactions: history });
    }
  );
}
