import type { FastifyRequest, FastifyReply } from "fastify";
import { createClerkClient } from "@clerk/backend";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

/**
 * Fastify preHandler that checks if the authenticated user has admin role
 * in their Clerk publicMetadata. Must run AFTER requireAuth.
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id;
  if (!userId) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }

  try {
    const clerkUser = await clerk.users.getUser(userId);
    const role = (clerkUser.publicMetadata as Record<string, unknown>)?.role;

    if (role !== "admin") {
      reply.code(403).send({ error: "Forbidden: admin access required" });
      return;
    }
  } catch (err) {
    request.log.warn({ err }, "Failed to check admin status");
    reply.code(403).send({ error: "Forbidden" });
    return;
  }
}
