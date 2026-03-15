/**
 * One-time backfill script:
 * Grants 200 free signup bonus credits to all existing users who never received them.
 *
 * Logic:
 *   - Finds all users who do NOT have a SIGNUP_BONUS credit transaction.
 *   - Gives each of them 200 credits and records the transaction.
 *
 * Usage:
 *   node scripts/backfill-signup-bonus.mjs
 *
 * Required env vars:
 *   DATABASE_URL — Postgres connection string
 *
 * Reads from .env automatically.
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

const SIGNUP_BONUS_CREDITS = 200;

async function main() {
  console.log("=== Backfill Signup Bonus Credits ===\n");

  // Find users who do NOT have a SIGNUP_BONUS transaction
  const usersWithoutBonus = await prisma.user.findMany({
    where: {
      creditTransactions: {
        none: { type: "SIGNUP_BONUS" },
      },
    },
    select: { id: true, email: true, credits: true },
  });

  console.log(`Found ${usersWithoutBonus.length} user(s) without signup bonus.\n`);

  if (usersWithoutBonus.length === 0) {
    console.log("Nothing to do — all users already have signup bonus.");
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const user of usersWithoutBonus) {
    try {
      // Atomically add credits and record the transaction
      const [updatedUser] = await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { credits: { increment: SIGNUP_BONUS_CREDITS } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: user.id,
            type: "SIGNUP_BONUS",
            amount: SIGNUP_BONUS_CREDITS,
            balance: user.credits + SIGNUP_BONUS_CREDITS,
            description: `Welcome bonus: ${SIGNUP_BONUS_CREDITS} free credits (backfill)`,
          },
        }),
      ]);

      console.log(
        `  ✓ ${user.email || user.id}: ${user.credits} → ${updatedUser.credits} credits`
      );
      successCount++;
    } catch (err) {
      console.error(`  ✗ ${user.email || user.id}: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\nDone! ${successCount} updated, ${errorCount} errors.`);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
