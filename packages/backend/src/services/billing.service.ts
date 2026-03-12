import { prisma } from "@onera/database";

// ─── Subscription Product ────────────────────────────────────────
// DodoPayments subscription product
// $29/month, 500 credits per renewal, 3-day free trial
//
// Product IDs differ between test_mode and live_mode.
// Set via env vars (DODO_SUBSCRIPTION_PRODUCT_ID, etc.) or fall back to test IDs.
const isLive = process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode";

// Test-mode product IDs (created on https://test.dodopayments.com)
const TEST_SUBSCRIPTION_ID = "pdt_0NZp7XVHocEtZtWuUzffY";
const TEST_GROWTH_ID       = "pdt_0NZp5BE9UAYTaMJTk1okg";
const TEST_SCALE_ID        = "pdt_0NZp5BKBRQssPeowsoW4P";
const TEST_POWER_ID        = "pdt_0NZp5BNmHqf19pQMPcN3x";
const TEST_MEGA_ID         = "pdt_0NZp5BRB4RMv9CaC0KnYN";

// Live-mode product IDs — set these env vars once you create products in Dodo live dashboard
// If not set, falls back to test IDs (will fail in live mode until set)
const LIVE_SUBSCRIPTION_ID = process.env.DODO_SUBSCRIPTION_PRODUCT_ID || "";
const LIVE_GROWTH_ID       = process.env.DODO_GROWTH_PRODUCT_ID || "";
const LIVE_SCALE_ID        = process.env.DODO_SCALE_PRODUCT_ID || "";
const LIVE_POWER_ID        = process.env.DODO_POWER_PRODUCT_ID || "";
const LIVE_MEGA_ID         = process.env.DODO_MEGA_PRODUCT_ID || "";

export const SUBSCRIPTION_PRODUCT_ID = isLive ? LIVE_SUBSCRIPTION_ID : TEST_SUBSCRIPTION_ID;
export const SUBSCRIPTION_CREDITS_PER_MONTH = 500;
export const TRIAL_BONUS_CREDITS = 50;
export const SIGNUP_BONUS_CREDITS = 20;
export const TRIAL_PERIOD_DAYS = 3;

// ─── Credit Top-Up Packs (one-time purchases) ───────────────────
export const CREDIT_PACKS = [
  { slug: "growth-500", name: "Growth", credits: 500, price: 2900, dodoProductId: isLive ? LIVE_GROWTH_ID : TEST_GROWTH_ID },
  { slug: "scale-2000", name: "Scale", credits: 2000, price: 7900, dodoProductId: isLive ? LIVE_SCALE_ID : TEST_SCALE_ID },
  { slug: "power-5000", name: "Power", credits: 5000, price: 14900, dodoProductId: isLive ? LIVE_POWER_ID : TEST_POWER_ID },
  { slug: "mega-15000", name: "Mega", credits: 15000, price: 29900, dodoProductId: isLive ? LIVE_MEGA_ID : TEST_MEGA_ID },
] as const;

export const MAX_TWEETS_PER_DAY_PER_PROJECT = 3;

// Credit costs per action type
// Pricing reflects actual LLM cost per agent tier:
//   Premium agents (GPT-5.4): multi-step tool use, 6+ LLM calls/task → expensive
//   Default agents (Kimi K2.5): simple tasks, 1-3 LLM calls/task → cheap
export const ACTION_CREDITS: Record<string, number> = {
  twitter: 3,     // Post tweet (Kimi K2.5, short-form)
  outreach: 8,    // Send outreach email (GPT-5.4, lead finding + email writing)
  research: 8,    // Research task (GPT-5.4, web search + synthesis)
  engineer: 10,   // Engineering task (GPT-5.4, code gen + multi-step tool use)
  planner: 1,     // Plan tasks (Kimi K2.5, structured output)
  report: 0,      // Daily report — free
  chat: 0,        // Chat message — free
};

// ─── Activate Subscription (give 50 trial credits) ──────────────
// Called when DodoPayments webhook confirms subscription is active (trial start).
export async function activateSubscription(
  userId: string,
  dodoCustomerId: string,
  dodoSubscriptionId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dodoSubscriptionId: true, trialActivated: true },
  });

  const isFirstSubscription = !user?.trialActivated;

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_PERIOD_DAYS);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      dodoCustomerId,
      dodoSubscriptionId,
      subscriptionStatus: "trialing",
      trialActivated: true,
      trialEndsAt,
      ...(isFirstSubscription ? { credits: { increment: TRIAL_BONUS_CREDITS } } : {}),
    },
  });

  // Record the bonus transaction (only on first subscription)
  if (isFirstSubscription) {
    await prisma.creditTransaction.create({
      data: {
        userId,
        type: "CARD_BONUS",
        amount: TRIAL_BONUS_CREDITS,
        balance: updated.credits,
        description: `Free trial started: ${TRIAL_BONUS_CREDITS} credits to get started`,
      },
    });
  }

  return updated;
}

// ─── Handle Subscription Renewal (add monthly credits) ──────────
export async function handleSubscriptionRenewal(
  userId: string,
  dodoPaymentId?: string,
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      credits: { increment: SUBSCRIPTION_CREDITS_PER_MONTH },
      subscriptionStatus: "active",
    },
  });

  await prisma.creditTransaction.create({
    data: {
      userId,
      type: "SUBSCRIPTION_RENEWAL",
      amount: SUBSCRIPTION_CREDITS_PER_MONTH,
      balance: user.credits,
      description: `Monthly subscription: +${SUBSCRIPTION_CREDITS_PER_MONTH} credits`,
      dodoPaymentId,
    },
  });

  return user;
}

// ─── Update Subscription Status ─────────────────────────────────
export async function updateSubscriptionStatus(
  userId: string,
  status: string,
) {
  return prisma.user.update({
    where: { id: userId },
    data: { subscriptionStatus: status },
  });
}

// ─── Add Credits (after one-time pack purchase) ─────────────────
export async function addCredits(
  userId: string,
  amount: number,
  opts: {
    type: "PURCHASE" | "AUTO_CHARGE" | "REFUND" | "MANUAL";
    description: string;
    dodoPaymentId?: string;
    packSlug?: string;
  }
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { credits: { increment: amount } },
  });

  await prisma.creditTransaction.create({
    data: {
      userId,
      type: opts.type,
      amount,
      balance: user.credits,
      description: opts.description,
      dodoPaymentId: opts.dodoPaymentId,
      packSlug: opts.packSlug,
    },
  });

  return user;
}

// ─── Deduct Credits (for a task) ────────────────────────────────
export async function deductCreditsForTask(
  userId: string,
  amount: number,
  taskId: string,
  description: string
): Promise<{ success: boolean; remainingCredits: number }> {
  // Free actions (0 credits) always succeed
  if (amount <= 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    return { success: true, remainingCredits: user?.credits ?? 0 };
  }

  // Atomic check-and-deduct
  const result = await prisma.user.updateMany({
    where: { id: userId, credits: { gte: amount } },
    data: { credits: { decrement: amount } },
  });

  if (result.count === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    return { success: false, remainingCredits: user?.credits ?? 0 };
  }

  // Get new balance
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  const balance = user?.credits ?? 0;

  // Record transaction
  await prisma.creditTransaction.create({
    data: {
      userId,
      type: "TASK_DEDUCTION",
      amount: -amount,
      balance,
      description,
      taskId,
    },
  });

  return { success: true, remainingCredits: balance };
}

// ─── Get User Billing Status ────────────────────────────────────
export async function getBillingStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      credits: true,
      autoChargeEnabled: true,
      dodoCustomerId: true,
      dodoSubscriptionId: true,
      subscriptionStatus: true,
      trialActivated: true,
      trialEndsAt: true,
    },
  });

  if (!user) return null;

  return {
    credits: user.credits,
    hasSubscription: !!user.dodoSubscriptionId || !!user.subscriptionStatus,
    subscriptionStatus: user.subscriptionStatus,
    isTrialing: user.subscriptionStatus === "trialing",
    trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
    hasCard: !!user.dodoCustomerId,
    autoChargeEnabled: user.autoChargeEnabled,
  };
}

// ─── Credit Transaction History ─────────────────────────────────
export async function getCreditHistory(userId: string, limit = 50) {
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ─── Tweet Rate Limiting (3/day/project) ────────────────────────
export async function getTweetCountToday(projectId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return prisma.task.count({
    where: {
      projectId,
      category: "TWITTER",
      status: { in: ["COMPLETED", "IN_PROGRESS"] },
      updatedAt: { gte: todayStart },
    },
  });
}

export async function canPostTweet(projectId: string): Promise<boolean> {
  const count = await getTweetCountToday(projectId);
  return count < MAX_TWEETS_PER_DAY_PER_PROJECT;
}

// ─── Resolve user from DodoPayments customer ID ─────────────────
export async function getUserByDodoCustomerId(dodoCustomerId: string) {
  return prisma.user.findUnique({
    where: { dodoCustomerId },
  });
}

// ─── Get user billing summary (for frontend) ────────────────────
export async function getBillingSummary(userId: string) {
  const [status, history] = await Promise.all([
    getBillingStatus(userId),
    getCreditHistory(userId, 20),
  ]);

  if (!status) return null;

  return {
    credits: status.credits,
    hasSubscription: status.hasSubscription,
    subscriptionStatus: status.subscriptionStatus,
    isTrialing: status.isTrialing,
    trialEndsAt: status.trialEndsAt,
    hasCard: status.hasCard,
    autoChargeEnabled: status.autoChargeEnabled,
    recentTransactions: history,
    packs: CREDIT_PACKS.map((p) => ({
      slug: p.slug,
      name: p.name,
      credits: p.credits,
      price: p.price / 100, // dollars
    })),
  };
}
