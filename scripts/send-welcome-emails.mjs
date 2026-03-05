/**
 * One-time script: Send welcome emails to all existing projects.
 *
 * For each project that has:
 *   - A company email (companyname@onera.app)
 *   - An owner with a real email (not @onera.local)
 *   - A website
 *
 * Sends a welcome email FROM the company email TO the owner.
 *
 * Usage:
 *   node scripts/send-welcome-emails.mjs
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
  console.warn("No .env file found — using existing environment variables");
}

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../node_modules/.pnpm/@prisma+client@6.19.2_prisma@6.19.2_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/index.js");

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Azure ECS email sending (same logic as email.service.ts)
// ---------------------------------------------------------------------------

async function sendEmail({ from, to, subject, html, plainText }) {
  const connectionString = process.env.AZURE_EMAIL_CONNECTION_STRING;
  if (!connectionString) {
    console.log(`  [skip] AZURE_EMAIL_CONNECTION_STRING not set — would send to ${to}`);
    return false;
  }

  const { EmailClient } = require("../node_modules/.pnpm/@azure+communication-email@1.1.0/node_modules/@azure/communication-email/dist/commonjs/emailClient.js");
  const client = new EmailClient(connectionString);

  try {
    const poller = await client.beginSend({
      senderAddress: from,
      content: { subject, html, plainText },
      recipients: { to: [{ address: to }] },
    });

    const result = await poller.pollUntilDone();

    if (result.status === "Succeeded") {
      console.log(`  [sent] "${subject}" to ${to} from ${from}`);
      return true;
    }

    console.error(`  [fail] Send to ${to} failed:`, result.error);
    return false;
  } catch (err) {
    console.error(`  [error] ${err.message || err}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Build welcome email (same template as email.service.ts)
// ---------------------------------------------------------------------------

function buildWelcomeEmail({ ownerName, projectName, companyEmail, website, product, description }) {
  const dashboardUrl = `${process.env.FRONTEND_URL || "https://app.onera.app"}/dashboard`;

  const subject = `Welcome to Onera Operator — ${projectName} is live!`;

  const plainText = `Hi ${ownerName},

This is your first email from your new company: ${projectName}!

You now have a company email: ${companyEmail}

${website ? `I've just finished researching ${projectName} (${website}). Here's what I found:` : `I've set up ${projectName} on OneraOS.`}

${product ? `Product: ${product}` : ""}
${description ? `About: ${description}` : ""}

I'm setting things up for you right now — planning tasks, identifying growth opportunities, and getting to work.

Check your dashboard to watch me work: ${dashboardUrl}

— Onera Operator
   COO for ${projectName}
   ${companyEmail}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Onera Operator</title>
</head>
<body style="margin: 0; padding: 0; background: #f7f7f7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f7f7f7;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 4px; border: 1px solid #e0e0e0;">
          <tr>
            <td style="padding: 32px 40px 24px; border-bottom: 2px solid #1a1a1a;">
              <p style="margin: 0; font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 14px; font-weight: 700; color: #1a1a1a; letter-spacing: 0.5px;">
                ONERA OPERATOR
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #1a1a1a; line-height: 1.7;">
              <p style="margin: 0 0 20px;">Hi ${ownerName},</p>
              <p style="margin: 0 0 20px;">
                This is your first email from your new company: <strong>${projectName}</strong>!
              </p>
              <p style="margin: 0 0 24px;">
                You now have a company email: <strong style="color: #2563eb;">${companyEmail}</strong>
              </p>
              ${website ? `<p style="margin: 0 0 20px;">
                I've just finished researching
                <a href="${website}" style="color: #2563eb; text-decoration: none;">${projectName}</a>.
                Here's what I found:
              </p>` : `<p style="margin: 0 0 20px;">I've set up <strong>${projectName}</strong> on OneraOS.</p>`}
              ${product || description ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px;">
                <tr>
                  <td style="padding: 16px 20px; background: #f8fafc; border-left: 3px solid #2563eb; font-size: 14px; color: #334155; line-height: 1.6;">
                    ${product ? `<strong>Product:</strong> ${product}<br>` : ""}
                    ${description ? `<strong>About:</strong> ${description}` : ""}
                  </td>
                </tr>
              </table>` : ""}
              <p style="margin: 0 0 24px;">
                I'm setting things up for you right now. Check your dashboard to watch me work!
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 32px;">
                <tr>
                  <td style="background: #1a1a1a; border-radius: 4px;">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; letter-spacing: 0.3px;">
                      View Dashboard &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                &mdash; Onera Operator<br>
                COO for ${projectName}<br>
                <a href="mailto:${companyEmail}" style="color: #2563eb; text-decoration: none;">${companyEmail}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, plainText };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Send Welcome Emails to Existing Projects ===\n");

  const projects = await prisma.project.findMany({
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${projects.length} project(s).\n`);

  let sent = 0;
  let skipped = 0;

  for (const p of projects) {
    const ownerEmail = p.user?.email;
    const ownerName = p.user?.name || "there";

    console.log(`Project: "${p.name}"`);
    console.log(`  companyEmail: ${p.companyEmail || "(none)"}`);
    console.log(`  owner: ${ownerName} <${ownerEmail || "(none)"}>`);
    console.log(`  website: ${p.website || "(none)"}`);

    // Skip if no company email
    if (!p.companyEmail) {
      console.log(`  [skip] No company email provisioned\n`);
      skipped++;
      continue;
    }

    // Skip if owner has no real email
    if (!ownerEmail || ownerEmail.endsWith("@onera.local") || ownerEmail.endsWith("@onera.chat")) {
      console.log(`  [skip] Owner has no real email address\n`);
      skipped++;
      continue;
    }

    const { subject, html, plainText } = buildWelcomeEmail({
      ownerName,
      projectName: p.name,
      companyEmail: p.companyEmail,
      website: p.website,
      product: p.product,
      description: p.description,
    });

    const ok = await sendEmail({
      from: p.companyEmail,
      to: ownerEmail,
      subject,
      html,
      plainText,
    });

    if (ok) sent++;
    else skipped++;

    console.log("");
  }

  console.log(`\nDone: ${sent} sent, ${skipped} skipped.`);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
