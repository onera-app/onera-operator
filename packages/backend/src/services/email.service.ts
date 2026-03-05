import { prisma } from "@onera/database";
import { EmailClient } from "@azure/communication-email";
import { ClientSecretCredential } from "@azure/identity";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMAIL_DOMAIN = "onera.app";
const SUBSCRIPTION_ID = "a6605f29-cd61-42a8-9485-11875b8a0b29";
const RESOURCE_GROUP = "onera";
const EMAIL_SERVICE_NAME = "onera-operator";
const ARM_API_VERSION = "2023-04-01";

// ---------------------------------------------------------------------------
// Shared email infrastructure
// ---------------------------------------------------------------------------

function getEmailClient(): EmailClient | null {
  const connectionString = process.env.AZURE_EMAIL_CONNECTION_STRING;
  if (!connectionString) return null;
  return new EmailClient(connectionString);
}

/**
 * Low-level helper — sends one email via Azure ECS.
 * Returns true on success, false on failure. Never throws.
 */
async function sendTransactionalEmail(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  plainText: string;
  replyTo?: string;
}): Promise<boolean> {
  const client = getEmailClient();
  if (!client) {
    console.log(
      `[email] AZURE_EMAIL_CONNECTION_STRING not set — skipping email to ${params.to}`
    );
    return false;
  }

  try {
    const poller = await client.beginSend({
      senderAddress: params.from,
      content: {
        subject: params.subject,
        html: params.html,
        plainText: params.plainText,
      },
      recipients: {
        to: [{ address: params.to }],
      },
      ...(params.replyTo && {
        replyTo: [{ address: params.replyTo }],
      }),
    });

    const result = await poller.pollUntilDone();

    if (result.status === "Succeeded") {
      console.log(`[email] Sent "${params.subject}" to ${params.to} from ${params.from}`);
      return true;
    }

    console.error(`[email] Failed to send to ${params.to}:`, result.error);
    return false;
  } catch (err) {
    console.error(
      "[email] Send error:",
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Azure ARM helper — for managing sender usernames
// ---------------------------------------------------------------------------

async function getArmToken(): Promise<string | null> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    console.warn(
      "[email] AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET not set — cannot manage sender usernames"
    );
    return null;
  }

  try {
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const token = await credential.getToken("https://management.azure.com/.default");
    return token.token;
  } catch (err) {
    console.error(
      "[email] Failed to get ARM token:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Provision a company-specific sender email (e.g. companyname@onera.app)
// ---------------------------------------------------------------------------

/**
 * Converts a company name to a valid email username.
 * - Lowercased, alphanumeric + hyphens only, max 64 chars
 * - e.g. "Acme Corp" → "acmecorp", "My Start-Up!" → "my-start-up"
 */
function toEmailUsername(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 64) || "company";
}

/**
 * Creates a sender username on Azure Email Communication Service via the ARM API.
 * Returns the full email address (e.g. "acmecorp@onera.app") on success, null on failure.
 */
export async function provisionCompanyEmail(
  companyName: string
): Promise<string | null> {
  const token = await getArmToken();
  if (!token) {
    console.warn(
      `[email] Cannot provision sender for "${companyName}" — no ARM credentials`
    );
    return null;
  }

  const username = toEmailUsername(companyName);
  const email = `${username}@${EMAIL_DOMAIN}`;

  const url =
    `https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}` +
    `/resourceGroups/${RESOURCE_GROUP}` +
    `/providers/Microsoft.Communication/emailServices/${EMAIL_SERVICE_NAME}` +
    `/domains/${EMAIL_DOMAIN}` +
    `/senderUsernames/${username}?api-version=${ARM_API_VERSION}`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          username,
          displayName: companyName,
        },
      }),
    });

    if (response.ok) {
      console.log(`[email] Provisioned sender: ${email} (display: "${companyName}")`);
      return email;
    }

    // 409 = already exists, which is fine
    if (response.status === 409) {
      console.log(`[email] Sender ${email} already exists — reusing`);
      return email;
    }

    const body = await response.text();
    console.error(
      `[email] Failed to provision sender ${email}: ${response.status} ${body}`
    );
    return null;
  } catch (err) {
    console.error(
      "[email] Provision error:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Welcome email — sent after project research completes
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(params: {
  projectId: string;
  projectName: string;
  companyEmail: string;
  website: string;
  description?: string;
  product?: string;
}): Promise<void> {
  // Look up the owner's email and name
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: { user: { select: { email: true, name: true } } },
  });

  if (!project?.user?.email) {
    console.warn(
      `[email] No email for owner of "${params.projectName}" — skipping welcome email`
    );
    return;
  }

  const ownerName = project.user.name || "there";
  const ownerEmail = project.user.email;
  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard`;

  const subject = `${params.projectName} is live. Here's what I found.`;

  const plainText = `Hey ${ownerName},

Quick heads up: I just finished going through ${params.projectName} (${params.website}) and I'm ready to get started.

${params.product ? `Here's what I picked up about your product: ${params.product}` : ""}
${params.description ? `${params.description}` : ""}

Your company email is set up: ${params.companyEmail}. All outreach and updates will come from this address.

I'm already planning your first batch of tasks: growth moves, outreach targets, competitive research. You can watch it happen in real time on your dashboard.

${dashboardUrl}

Open your dashboard to watch progress, or subscribe to start your first operating cycle.

${dashboardUrl}

— Onera Operator (Shipping & Operating)

  +-------+
  | ^   ^ |  /🚀
  |   o   | /
  | \\___/ |
  +-------+`;

  const productLine = params.product ? `Here's what I picked up about your product: ${params.product}` : "";
  const descLine = params.description ? params.description : "";
  const researchBlock = [productLine, descLine].filter(Boolean).join("<br><br>");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.65;">
  <div style="max-width: 560px; padding: 20px;">
    Hey ${ownerName},<br><br>
    I just finished going through <a href="${params.website}" style="color: #0033CC;">${params.projectName}</a> and I'm ready to get to work.<br><br>
    ${researchBlock ? `${researchBlock}<br><br>` : ""}Your company email is set up: <strong>${params.companyEmail}</strong>. All outreach and updates will come from this address.<br><br>
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

  await sendTransactionalEmail({
    from: params.companyEmail,
    to: ownerEmail,
    subject,
    html,
    plainText,
    replyTo: ownerEmail,
  });
}
