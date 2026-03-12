/**
 * Admin script: Add credits to a user by email.
 *
 * Usage:
 *   node scripts/add-credits.mjs <email> <amount>
 *
 * Example:
 *   node scripts/add-credits.mjs shreyas@onera.chat 500
 *
 * Required env vars:
 *   DATABASE_URL — Postgres connection string
 */

import { readFileSync } from "fs";
import { createRequire } from "module";

// Load .env manually (no dotenv dependency)
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

const [email, amountStr] = process.argv.slice(2);

if (!email || !amountStr) {
  console.error("Usage: node scripts/add-credits.mjs <email> <amount>");
  process.exit(1);
}

const amount = parseInt(amountStr, 10);
if (isNaN(amount) || amount <= 0) {
  console.error("Amount must be a positive integer.");
  process.exit(1);
}

async function main() {
  console.log(`\n=== Add ${amount} Credits to ${email} ===\n`);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, credits: true },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  console.log(`  Found user: ${user.email} (${user.id})`);
  console.log(`  Current credits: ${user.credits}`);

  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { credits: { increment: amount } },
    }),
    prisma.creditTransaction.create({
      data: {
        userId: user.id,
        type: "MANUAL",
        amount,
        balance: user.credits + amount,
        description: `Manual admin credit addition: +${amount} credits`,
      },
    }),
  ]);

  console.log(`  New credits: ${updatedUser.credits}`);
  console.log(`\nDone! Added ${amount} credits to ${email}.`);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
