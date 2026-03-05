import { prisma } from "@onera/database";

// ─── Subscription Product ────────────────────────────────────────
// DodoPayments subscription product (test_mode)
// $29/month, 500 credits per renewal, 3-day free trial
export const SUBSCRIPTION_PRODUCT_ID = "pdt_0NZp7XVHocEtZtWuUzffY";
export const SUBSCRIPTION_CREDITS_PER_MONTH = 500;
export const TRIAL_BONUS_CREDITS = 50;
export const TRIAL_PERIOD_DAYS = 3;

// ─── Credit Top-Up Packs (one-time purchases) ───────────────────
// DodoPayments one-time product IDs (test_mode)
export const CREDIT_PACKS = [
  { slug: "growth-500", name: "Growth", credits: 500, price: 2900, dodoProductId: "pdt_0NZp5BE9UAYTaMJTk1okg" },
  { slug: "scale-2000", name: "Scale", credits: 2000, price: 7900, dodoProductId: "pdt_0NZp5BKBRQssPeowsoW4P" },
  { slug: "power-5000", name: "Power", credits: 5000, price: 14900, dodoProductId: "pdt_0NZp5BNmHqf19pQMPcN3x" },
  { slug: "mega-15000", name: "Mega", credits: 15000, price: 29900, dodoProductId: "pdt_0NZp5BRB4RMv9CaC0KnYN" },
] as const;

export const MAX_TWEETS_PER_DAY_PER_PROJECT = 3;

// Credit costs per action type
export const ACTION_CREDITS: Record<string, number> = {
  twitter: 3,    // Post tweet
  outreach: 5,   // Send outreach email
  research: 5,   // Research task
  engineer: 5,   // Engineering task
  planner: 1,    // Plan tasks (auto)
  report: 0,     // Daily report — free
  chat: 0,       // Chat message — free
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
