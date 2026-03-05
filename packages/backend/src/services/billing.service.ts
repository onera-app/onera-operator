import { prisma } from "@onera/database";

// ─── Credit Pack Definitions (Final Pricing) ────────────────────
export const CREDIT_PACKS = [
  { slug: "growth-500", name: "Growth", credits: 500, price: 2900 },      // $29
  { slug: "scale-2000", name: "Scale", credits: 2000, price: 79_00 },     // $79
  { slug: "power-5000", name: "Power", credits: 5000, price: 149_00 },    // $149
  { slug: "mega-15000", name: "Mega", credits: 15000, price: 299_00 },    // $299
] as const;

export const CARD_BONUS_CREDITS = 50;
export const AUTO_CHARGE_PACK = CREDIT_PACKS[0]; // Growth 500 @ $29
export const MAX_TWEETS_PER_DAY_PER_PROJECT = 3;

// Credit costs per action type (1 credit = 1 action unit)
export const ACTION_CREDITS: Record<string, number> = {
  twitter: 3,    // Post tweet
  outreach: 5,   // Send outreach email
  research: 5,   // Research task
  engineer: 5,   // Engineering task
  planner: 1,    // Plan tasks (auto)
  report: 0,     // Daily report — free
  chat: 0,       // Chat message — free
};

// ─── Activate Card (give 50 free credits on first card add) ─────
// Called when DodoPayments webhook confirms card/payment for the first time.
export async function activateCard(userId: string, dodoCustomerId: string) {
  // Check if already activated
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dodoCustomerId: true },
  });

  const isFirstCard = !user?.dodoCustomerId;

  // Link customer and mark card added
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      dodoCustomerId,
      ...(isFirstCard ? { credits: { increment: CARD_BONUS_CREDITS } } : {}),
    },
  });

  // Record the bonus transaction (only on first card)
  if (isFirstCard) {
    await prisma.creditTransaction.create({
      data: {
        userId,
        type: "CARD_BONUS",
        amount: CARD_BONUS_CREDITS,
        balance: updated.credits,
        description: `Card added: ${CARD_BONUS_CREDITS} free credits to get started`,
      },
    });
  }

  return updated;
}

// ─── Link DodoPayments Customer ─────────────────────────────────
export async function linkDodoCustomer(userId: string, dodoCustomerId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { dodoCustomerId },
  });
}

// ─── Add Credits (after purchase) ───────────────────────────────
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
    // Insufficient credits
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true, autoChargeEnabled: true, dodoCustomerId: true },
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

// ─── Auto-Charge (when credits run out) ─────────────────────────
export async function attemptAutoCharge(
  userId: string
): Promise<{ success: boolean; creditsAdded: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      autoChargeEnabled: true,
      dodoCustomerId: true,
      email: true,
      name: true,
    },
  });

  if (!user?.autoChargeEnabled || !user?.dodoCustomerId) {
    return { success: false, creditsAdded: 0 };
  }

  const env = process.env.DODO_PAYMENTS_ENVIRONMENT || "test_mode";
  const baseUrl =
    env === "live_mode"
      ? "https://api.dodopayments.com"
      : "https://test.dodopayments.com";

  try {
    const response = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
      },
      body: JSON.stringify({
        billing: { country: "US" },
        customer: {
          customer_id: user.dodoCustomerId,
          email: user.email || `${userId}@onera.chat`,
          name: user.name || "OneraOS User",
        },
        product_cart: [
          { product_id: AUTO_CHARGE_PACK.slug, quantity: 1 },
        ],
        metadata: {
          userId,
          type: "auto_charge",
          packSlug: AUTO_CHARGE_PACK.slug,
        },
      }),
    });

    if (!response.ok) {
      console.error(
        `[billing] Auto-charge failed for user ${userId}: ${response.status} ${await response.text()}`
      );
      return { success: false, creditsAdded: 0 };
    }

    // Optimistically add credits so the task can proceed
    await addCredits(userId, AUTO_CHARGE_PACK.credits, {
      type: "AUTO_CHARGE",
      description: `Auto-charged: ${AUTO_CHARGE_PACK.credits} credits ($${AUTO_CHARGE_PACK.price / 100}) — pending payment confirmation`,
      packSlug: AUTO_CHARGE_PACK.slug,
    });

    console.log(
      `[billing] Auto-charged ${AUTO_CHARGE_PACK.credits} credits for user ${userId}`
    );
    return { success: true, creditsAdded: AUTO_CHARGE_PACK.credits };
  } catch (err) {
    console.error(`[billing] Auto-charge error for user ${userId}:`, err);
    return { success: false, creditsAdded: 0 };
  }
}

// ─── Get User Billing Status ────────────────────────────────────
export async function getBillingStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      credits: true,
      autoChargeEnabled: true,
      dodoCustomerId: true,
    },
  });

  if (!user) return null;

  return {
    credits: user.credits,
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

// ─── Get user billing summary ───────────────────────────────────
export async function getBillingSummary(userId: string) {
  const [status, history] = await Promise.all([
    getBillingStatus(userId),
    getCreditHistory(userId, 20),
  ]);

  if (!status) return null;

  return {
    credits: status.credits,
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
