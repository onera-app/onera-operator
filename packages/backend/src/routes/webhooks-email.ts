import type { FastifyInstance } from "fastify";
import { processEventGridEvents } from "../services/inbound-email.service.js";

/**
 * Email webhook routes for Azure Event Grid.
 * Handles delivery reports, inbound emails (replies), and engagement tracking.
 *
 * This route is PUBLIC — Azure Event Grid needs to call it without auth.
 * Security is handled via Event Grid subscription validation handshake.
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
}
