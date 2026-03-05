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

  const subject = `Welcome to Onera Operator — ${params.projectName} is live!`;

  const plainText = `Hi ${ownerName},

This is your first email from your new company: ${params.projectName}!

You now have a company email: ${params.companyEmail}

I've just finished researching ${params.projectName} (${params.website}). Here's what I found:

${params.product ? `Product: ${params.product}` : ""}
${params.description ? `About: ${params.description}` : ""}

I'm setting things up for you right now — planning tasks, identifying growth opportunities, and getting to work.

Check your dashboard to watch me work: ${dashboardUrl}

— Onera Operator
   COO for ${params.projectName}
   ${params.companyEmail}`;

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

          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 24px; border-bottom: 2px solid #1a1a1a;">
              <p style="margin: 0; font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 14px; font-weight: 700; color: #1a1a1a; letter-spacing: 0.5px;">
                ONERA OPERATOR
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #1a1a1a; line-height: 1.7;">

              <p style="margin: 0 0 20px;">Hi ${ownerName},</p>

              <p style="margin: 0 0 20px;">
                This is your first email from your new company: <strong>${params.projectName}</strong>!
              </p>

              <p style="margin: 0 0 24px;">
                You now have a company email: <strong style="color: #2563eb;">${params.companyEmail}</strong>
              </p>

              <p style="margin: 0 0 20px;">
                I've just finished researching
                <a href="${params.website}" style="color: #2563eb; text-decoration: none;">${params.projectName}</a>.
                Here's what I found:
              </p>

              ${
                params.product || params.description
                  ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px;">
                      <tr>
                        <td style="padding: 16px 20px; background: #f8fafc; border-left: 3px solid #2563eb; font-size: 14px; color: #334155; line-height: 1.6;">
                          ${params.product ? `<strong>Product:</strong> ${params.product}<br>` : ""}
                          ${params.description ? `<strong>About:</strong> ${params.description}` : ""}
                        </td>
                      </tr>
                    </table>`
                  : ""
              }

              <p style="margin: 0 0 24px;">
                I'm setting things up for you right now. Check your dashboard to watch me work!
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 32px;">
                <tr>
                  <td style="background: #1a1a1a; border-radius: 4px;">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; letter-spacing: 0.3px;">
                      View Dashboard &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Sign-off -->
              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                &mdash; Onera Operator<br>
                COO for ${params.projectName}<br>
                <a href="mailto:${params.companyEmail}" style="color: #2563eb; text-decoration: none;">${params.companyEmail}</a>
              </p>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendTransactionalEmail({
    from: params.companyEmail,
    to: ownerEmail,
    subject,
    html,
    plainText,
  });
}
