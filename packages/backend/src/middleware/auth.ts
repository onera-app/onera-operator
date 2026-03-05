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
// Auth middleware — verifies Clerk JWT and syncs user to DB
// ---------------------------------------------------------------------------

/**
 * Fastify preHandler that:
 * 1. Extracts Bearer token from the Authorization header
 * 2. Verifies it using Clerk's JWT verification
 * 3. Fetches the full user profile from Clerk (email, name, image)
 * 4. Upserts the user in our DB (ensuring real email is stored)
 * 5. Attaches `request.authUser` for downstream route handlers
 *
 * Returns 401 if no token or verification fails.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
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
