/**
 * Backfill script: Creates Contact and EmailConversation records from existing EmailLog rows.
 *
 * Run from project root: node scripts/backfill-email-conversations.mjs
 *
 * Optimized to use batch operations and transactions for speed against remote Neon DB.
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

function normalizeSubject(subject) {
  return subject
    .replace(/^(re|fwd|fw):\s*/gi, "")
    .trim()
    .toLowerCase();
}

const BATCH_SIZE = 20; // concurrent operations per batch

async function processBatch(items, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i > 0 && i % 100 === 0) {
      process.stdout.write(`  ... processed ${i}/${items.length}\n`);
    }
  }
  return results;
}

async function main() {
  console.log("[backfill] Starting email conversation backfill...");

  // Get all outbound emails that don't have a contactId yet
  const emails = await prisma.emailLog.findMany({
    where: { contactId: null, direction: "OUTBOUND" },
    orderBy: { sentAt: "asc" },
  });

  console.log(`[backfill] Found ${emails.length} emails to process`);

  if (emails.length === 0) {
    console.log("[backfill] No emails to backfill. Done.");
    return;
  }

  // Group by projectId + toEmail
  const groups = new Map();
  for (const email of emails) {
    const key = `${email.projectId}::${email.toEmail}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(email);
  }

  console.log(`[backfill] Found ${groups.size} unique contacts`);

  let contactsCreated = 0;
  let conversationsCreated = 0;
  let emailsUpdated = 0;

  // Step 1: Create all contacts in batches
  console.log("[backfill] Step 1/3: Creating contacts...");
  const groupEntries = Array.from(groups.entries());
  const contactMap = new Map(); // key -> contact

  await processBatch(groupEntries, async ([key]) => {
    const [projectId, toEmail] = key.split("::");
    try {
      const contact = await prisma.contact.upsert({
        where: { projectId_email: { projectId, email: toEmail } },
        update: {},
        create: {
          projectId,
          email: toEmail,
          source: "OUTREACH",
        },
      });
      contactMap.set(key, contact);
      contactsCreated++;
    } catch (err) {
      console.warn(`[backfill] Failed to create contact for ${toEmail}:`, err.message);
    }
  });
  console.log(`[backfill]   Created/found ${contactsCreated} contacts`);

  // Step 2: Create all conversations in batches
  console.log("[backfill] Step 2/3: Creating conversations...");
  const convWork = []; // { key, contact, convEmails }

  for (const [key, groupEmails] of groups) {
    const contact = contactMap.get(key);
    if (!contact) continue;

    const [projectId] = key.split("::");
    const subjectGroups = new Map();
    for (const email of groupEmails) {
      const normSubject = normalizeSubject(email.subject);
      if (!subjectGroups.has(normSubject)) {
        subjectGroups.set(normSubject, []);
      }
      subjectGroups.get(normSubject).push(email);
    }

    for (const [, convEmails] of subjectGroups) {
      convWork.push({ projectId, contact, convEmails });
    }
  }

  console.log(`[backfill]   ${convWork.length} conversations to create`);

  // convWork item -> { conversation, emailIds }
  const updateWork = [];

  await processBatch(convWork, async ({ projectId, contact, convEmails }) => {
    try {
      const conversation = await prisma.emailConversation.create({
        data: {
          projectId,
          contactId: contact.id,
          subject: convEmails[0].subject.replace(/^(re|fwd|fw):\s*/gi, "").trim(),
          status: "ACTIVE",
          messageCount: convEmails.length,
          lastActivityAt: convEmails[convEmails.length - 1].sentAt,
        },
      });
      conversationsCreated++;
      for (const email of convEmails) {
        updateWork.push({
          emailId: email.id,
          contactId: contact.id,
          conversationId: conversation.id,
        });
      }
    } catch (err) {
      console.warn(`[backfill] Failed to create conversation:`, err.message);
    }
  });
  console.log(`[backfill]   Created ${conversationsCreated} conversations`);

  // Step 3: Update all EmailLog records in batches
  console.log(`[backfill] Step 3/3: Updating ${updateWork.length} email records...`);

  await processBatch(updateWork, async ({ emailId, contactId, conversationId }) => {
    try {
      await prisma.emailLog.update({
        where: { id: emailId },
        data: { contactId, conversationId },
      });
      emailsUpdated++;
    } catch (err) {
      console.warn(`[backfill] Failed to update email ${emailId}:`, err.message);
    }
  });

  console.log(`[backfill] Complete!`);
  console.log(`  Contacts created: ${contactsCreated}`);
  console.log(`  Conversations created: ${conversationsCreated}`);
  console.log(`  Emails updated: ${emailsUpdated}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
