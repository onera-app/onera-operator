import type { FastifyInstance } from "fastify";
import { processEventGridEvents, handleInboundEmail } from "../services/inbound-email.service.js";

const WEBHOOK_SECRET = process.env.SMTP_WEBHOOK_SECRET || "";

/**
 * Email webhook routes.
 *
 * - POST /api/webhooks/email         — Azure Event Grid (delivery reports, engagement)
 * - POST /api/webhooks/email/inbound — SMTP receiver forwards parsed inbound emails here
 *
 * Both routes are PUBLIC (no Clerk auth). Security:
 * - Event Grid: validated via subscription handshake
 * - Inbound: validated via shared secret header (X-Webhook-Secret)
 */
export async function emailWebhookRoutes(app: FastifyInstance) {
  // Azure Event Grid webhook endpoint
  app.post("/api/webhooks/email", async (request, reply) => {
    const body = request.body;

    // Event Grid sends events as an array
    const events = Array.isArray(body) ? body : [body];

    if (!events || events.length === 0) {
      return reply.code(400).send({ error: "No events in payload" });
    }

    const result = await processEventGridEvents(events);

    // If this is a validation request, return the validation response
    if (result.validationResponse) {
      return reply.send({ validationResponse: result.validationResponse });
    }

    console.log(
      `[webhooks-email] Processed ${result.processed} events, ${result.errors} errors`
    );

    return reply.send({
      status: "ok",
      processed: result.processed,
      errors: result.errors,
    });
  });

  // Inbound email webhook — called by our SMTP receiver container
  app.post("/api/webhooks/email/inbound", async (request, reply) => {
    // Validate shared secret
    if (WEBHOOK_SECRET) {
      const provided = request.headers["x-webhook-secret"];
      if (provided !== WEBHOOK_SECRET) {
        return reply.code(401).send({ error: "Invalid webhook secret" });
      }
    }

    const body = request.body as {
      from?: string;
      fromName?: string;
      to?: string;
      subject?: string;
      bodyPlainText?: string;
      bodyHtml?: string;
      receivedAt?: string;
      messageId?: string;
      inReplyTo?: string;
      references?: string;
    };

    if (!body?.from || !body?.to) {
      return reply.code(400).send({ error: "Missing from or to" });
    }

    console.log(
      `[webhooks-email] Inbound email from ${body.from} to ${body.to} — "${body.subject}"`
    );

    try {
      await handleInboundEmail({
        messageId: body.messageId || "",
        from: body.from,
        to: body.to,
        subject: body.subject || "(no subject)",
        bodyPlainText: body.bodyPlainText,
        bodyHtml: body.bodyHtml,
        receivedAt: body.receivedAt || new Date().toISOString(),
        inReplyTo: body.inReplyTo,
        references: body.references,
      });

      return reply.send({ status: "ok" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[webhooks-email] Inbound processing error:`, msg);
      return reply.code(500).send({ error: "Processing failed" });
    }
  });
}
