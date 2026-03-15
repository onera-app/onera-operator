/**
 * Onera SMTP Receiver
 *
 * Lightweight SMTP server that accepts inbound email for onera.app
 * and forwards parsed messages to the backend webhook.
 *
 * Environment variables:
 *   SMTP_PORT          - Port to listen on (default: 25)
 *   WEBHOOK_URL        - Backend webhook endpoint
 *   WEBHOOK_SECRET     - Shared secret for authenticating webhook calls
 *   ALLOWED_DOMAINS    - Comma-separated list of domains to accept mail for (default: onera.app)
 *   MAX_MESSAGE_SIZE   - Max message size in bytes (default: 10MB)
 */

import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";

const PORT = parseInt(process.env.SMTP_PORT || "25", 10);
const WEBHOOK_URL =
  process.env.WEBHOOK_URL ||
  "https://operator-api.onera.chat/api/webhooks/email/inbound";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
const ALLOWED_DOMAINS = (process.env.ALLOWED_DOMAINS || "onera.app")
  .split(",")
  .map((d) => d.trim().toLowerCase());
const MAX_MESSAGE_SIZE = parseInt(
  process.env.MAX_MESSAGE_SIZE || String(10 * 1024 * 1024),
  10
);

// ---------------------------------------------------------------------------
// Webhook delivery
// ---------------------------------------------------------------------------

async function deliverToWebhook(parsed) {
  const payload = {
    from: parsed.from?.value?.[0]?.address || "",
    fromName: parsed.from?.value?.[0]?.name || "",
    to:
      parsed.to?.value?.map((a) => a.address).join(", ") || "",
    subject: parsed.subject || "(no subject)",
    bodyPlainText: parsed.text || "",
    bodyHtml: parsed.html || "",
    receivedAt: new Date().toISOString(),
    messageId: parsed.messageId || "",
    inReplyTo: parsed.inReplyTo || "",
    references: Array.isArray(parsed.references)
      ? parsed.references.join(" ")
      : parsed.references || "",
    headers: {
      date: parsed.date?.toISOString() || "",
    },
  };

  console.log(
    `[smtp] Delivering to webhook: from=${payload.from} to=${payload.to} subject="${payload.subject}"`
  );

  const headers = { "Content-Type": "application/json" };
  if (WEBHOOK_SECRET) {
    headers["X-Webhook-Secret"] = WEBHOOK_SECRET;
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[smtp] Webhook returned ${res.status}: ${body.slice(0, 200)}`
      );
      return false;
    }

    const result = await res.json().catch(() => ({}));
    console.log(`[smtp] Webhook OK:`, result);
    return true;
  } catch (err) {
    console.error(`[smtp] Webhook delivery failed:`, err.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// SMTP Server
// ---------------------------------------------------------------------------

const server = new SMTPServer({
  // No auth required — this is a public inbound receiver
  authOptional: true,
  disabledCommands: ["AUTH"],

  // Accept plaintext on port 25 (standard MX delivery)
  secure: false,
  disableReverseLookup: true,

  size: MAX_MESSAGE_SIZE,

  banner: "Onera SMTP Receiver",

  // Validate recipient — only accept mail for our domains
  onRcptTo(address, session, callback) {
    const domain = address.address.split("@")[1]?.toLowerCase();
    if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
      console.log(
        `[smtp] Rejected recipient ${address.address} — domain ${domain} not in allowed list`
      );
      return callback(new Error(`Mailbox not found: ${address.address}`));
    }
    console.log(`[smtp] Accepted recipient: ${address.address}`);
    callback();
  },

  // Process the incoming message
  onData(stream, session, callback) {
    const chunks = [];

    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", async () => {
      const raw = Buffer.concat(chunks);

      console.log(
        `[smtp] Received message (${raw.length} bytes) from ${session.envelope.mailFrom?.address || "unknown"} to ${session.envelope.rcptTo?.map((r) => r.address).join(", ")}`
      );

      try {
        const parsed = await simpleParser(raw);
        const ok = await deliverToWebhook(parsed);

        if (!ok) {
          // Return temp error so sending MTA retries
          return callback(
            new Error("451 Temporary failure — please retry later")
          );
        }

        callback(null, "Message accepted");
      } catch (err) {
        console.error(`[smtp] Parse error:`, err.message);
        callback(new Error("451 Temporary failure — parse error"));
      }
    });
  },

  onError(err) {
    console.error(`[smtp] Server error:`, err.message);
  },
});

// ---------------------------------------------------------------------------
// Health check HTTP server (for Azure Container App probes)
// ---------------------------------------------------------------------------

import { createServer } from "http";

const healthServer = createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "healthy", smtp: true }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`[smtp] SMTP server listening on port ${PORT}`);
  console.log(`[smtp] Accepting mail for: ${ALLOWED_DOMAINS.join(", ")}`);
  console.log(`[smtp] Forwarding to: ${WEBHOOK_URL}`);
});

const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || "8080", 10);
healthServer.listen(HEALTH_PORT, () => {
  console.log(`[smtp] Health check on port ${HEALTH_PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[smtp] SIGTERM received, shutting down...");
  server.close(() => {
    healthServer.close(() => {
      process.exit(0);
    });
  });
});
