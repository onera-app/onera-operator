import type { FastifyInstance } from "fastify";
import { prisma } from "@onera/database";

export async function userRoutes(app: FastifyInstance) {
  // Get credits for the authenticated user
  app.get(
    "/api/users/me/credits",
    async (request, reply) => {
      const userId = request.authUser!.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }
      return reply.send({ credits: user.credits });
    }
  );

  // Keep legacy route for backwards compatibility (also auth-gated now)
  app.get<{ Params: { userId: string } }>(
    "/api/users/:userId/credits",
    async (request, reply) => {
      const authUserId = request.authUser!.id;
      const { userId } = request.params;

      // Users can only view their own credits
      if (userId !== authUserId) {
        return reply.code(403).send({ error: "Access denied" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }
      return reply.send({ credits: user.credits });
    }
  );
}
