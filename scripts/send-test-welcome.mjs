/**
 * One-off: Resend welcome email for "Onera test" project to spapinwar@gmail.com
 */

import { readFileSync } from "fs";
import { createRequire } from "module";

// Load .env
try {
  const envFile = readFileSync(new URL("../.env", import.meta.url), "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn("No .env file found");
}

const require = createRequire(import.meta.url);
const { EmailClient } = require("../node_modules/.pnpm/@azure+communication-email@1.1.0/node_modules/@azure/communication-email/dist/commonjs/emailClient.js");

const projectName = "Onera test";
const companyEmail = "oneratest-2@onera.app";
const website = "https://onera.chat";
const ownerName = "Shreyas";
const ownerEmail = "spapinwar@gmail.com";
const dashboardUrl = "https://app.onera.app/dashboard";

const subject = `${projectName} is live. Here's what I found.`;

const plainText = `Hey ${ownerName},

I just finished going through ${projectName} (${website}) and I'm ready to get started.

Your company email is set up: ${companyEmail}. All outreach and updates will come from this address.

I'm already planning your first batch of tasks: growth moves, outreach targets, competitive research. You can watch it happen in real time on your dashboard.

${dashboardUrl}

Talk soon,
Onera Operator
COO for ${projectName}`;

const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.65;">
  <div style="max-width: 560px; padding: 20px;">
    Hey ${ownerName},<br><br>
    I just finished going through <a href="${website}" style="color: #0033CC;">${projectName}</a> and I'm ready to get to work.<br><br>
    Your company email is set up: <strong>${companyEmail}</strong>. All outreach and updates will come from this address.<br><br>
    I'm already planning your first batch of tasks: growth moves, outreach targets, competitive research. You can watch it happen live.<br><br>
    <a href="${dashboardUrl}" style="color: #0033CC;"><strong>Open your dashboard</strong></a> to watch progress, or subscribe to start your first operating cycle.<br><br>
    <span style="color: #999;">&mdash; Onera Operator (Shipping &amp; Operating)</span><br><br>
    <pre style="font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.3; color: #1a1a1a; margin: 0;">  +-------+
  | ^   ^ |  /&#x1F680;
  |   o   | /
  | \___/ |
  +-------+</pre><br>
    <a href="${dashboardUrl}" style="color: #0033CC; font-size: 13px;">View Dashboard &rarr;</a>
  </div>
</body>
</html>`;

async function main() {
  const connectionString = process.env.AZURE_EMAIL_CONNECTION_STRING;
  if (!connectionString) {
    console.error("AZURE_EMAIL_CONNECTION_STRING not set");
    process.exit(1);
  }

  console.log(`Sending welcome email for "${projectName}"...`);
  console.log(`  From: ${companyEmail}`);
  console.log(`  To: ${ownerEmail}`);
  console.log(`  Subject: ${subject}`);

  const client = new EmailClient(connectionString);

  const poller = await client.beginSend({
    senderAddress: companyEmail,
    content: { subject, html, plainText },
    recipients: { to: [{ address: ownerEmail }] },
    replyTo: [{ address: ownerEmail }],
  });

  const result = await poller.pollUntilDone();

  if (result.status === "Succeeded") {
    console.log(`\nSent! Message ID: ${result.id}`);
  } else {
    console.error("\nFailed:", result.error);
  }
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
