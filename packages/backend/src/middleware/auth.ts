import type { FastifyRequest, FastifyReply } from "fastify";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { ensureUser } from "../services/project.service.js";

// ---------------------------------------------------------------------------
// Clerk client — used to fetch full user profile (email, name, image)
// ---------------------------------------------------------------------------

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

// ---------------------------------------------------------------------------
// Augment Fastify request to carry the authenticated user
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

// ---------------------------------------------------------------------------
// Internal service secret — used for tool→API calls within the same backend.
// The chat route already verified the user; tool calls send
// X-Internal-Secret + X-Internal-User-Id so they don't rely on the
// short-lived Clerk JWT (which can expire mid-stream).
// ---------------------------------------------------------------------------

export const INTERNAL_SECRET =
  process.env.INTERNAL_API_SECRET || "onera-internal-2026";

// ---------------------------------------------------------------------------
// Auth middleware — verifies Clerk JWT and syncs user to DB
// ---------------------------------------------------------------------------

/**
 * Fastify preHandler that:
 * 1. Checks for trusted internal service calls (X-Internal-Secret header)
 * 2. Otherwise extracts Bearer token from the Authorization header
 * 3. Verifies it using Clerk's JWT verification
 * 4. Fetches the full user profile from Clerk (email, name, image)
 * 5. Upserts the user in our DB (ensuring real email is stored)
 * 6. Attaches `request.authUser` for downstream route handlers
 *
 * Returns 401 if no token or verification fails.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // --- Fast path: trusted internal call from chat agent tools ---
  const internalSecret = request.headers["x-internal-secret"] as
    | string
    | undefined;
  const internalUserId = request.headers["x-internal-user-id"] as
    | string
    | undefined;

  if (internalSecret && internalUserId && internalSecret === INTERNAL_SECRET) {
    // Look up the user from our DB (already synced from a prior real auth)
    const { prisma } = await import("@onera/database");
    const user = await prisma.user.findUnique({
      where: { id: internalUserId },
    });
    if (user && user.email) {
      request.authUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
      return; // Authenticated via internal secret
    }
    // If user not found, fall through to normal auth
  }

  // --- Normal path: Clerk JWT ---
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    // Verify the JWT and extract claims
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    const clerkUserId = payload.sub;
    if (!clerkUserId) {
      reply.code(401).send({ error: "Invalid token: no subject" });
      return;
    }

    // Fetch the full user profile from Clerk (includes email, name, image)
    const clerkUser = await clerk.users.getUser(clerkUserId);

    const email =
      clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      null;

    const image = clerkUser.imageUrl || null;

    if (!email) {
      reply.code(401).send({ error: "User has no email address" });
      return;
    }

    // Sync user to our database with real email/name/image
    await ensureUser({
      id: clerkUserId,
      email,
      name: name || undefined,
      image: image || undefined,
    });

    // Attach to request for downstream handlers
    request.authUser = { id: clerkUserId, email, name, image };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    request.log.warn({ err: message }, "Auth verification failed");
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }
}
