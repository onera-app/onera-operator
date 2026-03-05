import type { FastifyInstance } from "fastify";
import { Checkout, Webhooks } from "@dodopayments/fastify";
import {
  activateCard,
  addCredits,
  getBillingSummary,
  getCreditHistory,
  CREDIT_PACKS,
  AUTO_CHARGE_PACK,
  CARD_BONUS_CREDITS,
} from "../services/billing.service.js";
import { prisma } from "@onera/database";

const DODO_ENV = (process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || "test_mode";

export async function billingRoutes(app: FastifyInstance) {
  // ─── Add Card: DodoPayments checkout to capture card ──────────
  // This is a $0 authorization / setup — user adds card, gets 50 free credits
  const cardCheckout = Checkout({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
    environment: DODO_ENV,
    returnUrl: process.env.DODO_PAYMENTS_RETURN_URL || `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard?card=added`,
    type: "dynamic",
  });

  app.post("/api/billing/checkout", cardCheckout.postHandler);

  // ─── Add Card (custom route for frontend) ─────────────────────
  app.post<{
    Body: { userId: string };
  }>("/api/billing/add-card", async (request, reply) => {
    const { userId } = request.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, dodoCustomerId: true },
    });
    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }

    // Already has card
    if (user.dodoCustomerId) {
      return reply.code(400).send({ error: "Card already added" });
    }

    const baseUrl = DODO_ENV === "live_mode"
      ? "https://live.dodopayments.com"
      : "https://test.dodopayments.com";

    // Create a $0 payment / card setup via DodoPayments
    const response = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
      },
      body: JSON.stringify({
        billing: { country: "US" },
        customer: {
          email: user.email || `${userId}@onera.chat`,
          name: user.name || "OneraOS User",
        },
        product_cart: [],
        payment_link: true,
        return_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard?card=added`,
        metadata: {
          userId,
          type: "card_setup",
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      app.log.error({ err }, "DodoPayments card setup failed");
      return reply.code(500).send({ error: "Card setup failed" });
    }

    const data = await response.json() as { payment_link: string };
    return reply.send({ checkoutUrl: data.payment_link });
  });

  // ─── Purchase credit pack ─────────────────────────────────────
  app.post<{
    Body: { userId: string; packSlug: string };
  }>("/api/billing/purchase", async (request, reply) => {
    const { userId, packSlug } = request.body;

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

    const baseUrl = DODO_ENV === "live_mode"
      ? "https://live.dodopayments.com"
      : "https://test.dodopayments.com";

    const response = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
      },
      body: JSON.stringify({
        billing: { country: "US" },
        customer: {
          customer_id: user.dodoCustomerId || undefined,
          email: user.email || `${userId}@onera.chat`,
          name: user.name || "OneraOS User",
        },
        product_cart: [{ product_id: packSlug, quantity: 1 }],
        payment_link: true,
        return_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard?purchase=success&pack=${packSlug}`,
        metadata: {
          userId,
          packSlug,
          type: "credit_pack",
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      app.log.error({ err }, "DodoPayments checkout failed");
      return reply.code(500).send({ error: "Payment creation failed" });
    }

    const data = await response.json() as { payment_link: string };
    return reply.send({ checkoutUrl: data.payment_link });
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

        onPaymentSucceeded: async (payload) => {
          app.log.info({ payload }, "DodoPayments: payment succeeded");
          const data = payload.data as Record<string, unknown>;
          const metadata = (data.metadata || {}) as Record<string, string>;
          const paymentId = data.payment_id as string;
          const customerId = data.customer_id as string;

          const userId = metadata.userId;
          if (!userId) return;

          if (metadata.type === "card_setup") {
            // Card added — give 50 free credits (first time only)
            if (customerId) {
              await activateCard(userId, customerId);
              app.log.info({ userId }, `Card added: ${CARD_BONUS_CREDITS} free credits granted`);
            }
          } else if (metadata.type === "credit_pack") {
            // Credit pack purchase
            const packSlug = metadata.packSlug;
            const pack = CREDIT_PACKS.find((p) => p.slug === packSlug);

            // Also link customer if not yet linked
            if (customerId) {
              await activateCard(userId, customerId).catch(() => {});
            }

            if (pack) {
              await addCredits(userId, pack.credits, {
                type: "PURCHASE",
                description: `Purchased ${pack.name} pack: ${pack.credits} credits`,
                dodoPaymentId: paymentId,
                packSlug: pack.slug,
              });
              app.log.info({ userId, pack: pack.slug }, "Credits added from purchase");
            }
          } else if (metadata.type === "auto_charge") {
            await addCredits(userId, AUTO_CHARGE_PACK.credits, {
              type: "AUTO_CHARGE",
              description: `Auto-charged: ${AUTO_CHARGE_PACK.credits} credits ($${AUTO_CHARGE_PACK.price / 100})`,
              dodoPaymentId: paymentId,
              packSlug: AUTO_CHARGE_PACK.slug,
            });
            app.log.info({ userId }, "Auto-charge credits added");
          }
        },

        onPaymentFailed: async (payload) => {
          app.log.warn({ payload }, "DodoPayments: payment failed");
        },

        onSubscriptionActive: async (payload) => {
          app.log.info({ payload }, "DodoPayments: subscription active");
        },

        onSubscriptionCancelled: async (payload) => {
          app.log.info({ payload }, "DodoPayments: subscription cancelled");
        },
      })
    );
  });

  // ─── Get billing summary ──────────────────────────────────────
  app.get<{ Params: { userId: string } }>(
    "/api/billing/:userId",
    async (request, reply) => {
      const summary = await getBillingSummary(request.params.userId);
      if (!summary) {
        return reply.code(404).send({ error: "User not found" });
      }
      return reply.send(summary);
    }
  );

  // ─── Get credit history ───────────────────────────────────────
  app.get<{ Params: { userId: string }; Querystring: { limit?: string } }>(
    "/api/billing/:userId/history",
    async (request, reply) => {
      const limit = parseInt(request.query.limit || "50", 10);
      const history = await getCreditHistory(request.params.userId, limit);
      return reply.send({ transactions: history });
    }
  );
}
