import type { FastifyInstance } from "fastify";
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from "../services/project.service.js";
import { researchCompanyUrl } from "@onera/tools";
import { getSchedulerQueue } from "../queue/scheduler.queue.js";
import { provisionCompanyEmail, sendWelcomeEmail } from "../services/email.service.js";

export async function projectRoutes(app: FastifyInstance) {
  // List all projects for the authenticated user
  app.get(
    "/api/projects",
    async (request, reply) => {
      const userId = request.authUser!.id;
      const projects = await listProjects(userId);
      return reply.send(projects);
    }
  );

  // Get a single project
  app.get<{ Params: { id: string } }>(
    "/api/projects/:id",
    async (request, reply) => {
      const project = await getProject(request.params.id);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }
      return reply.send(project);
    }
  );

  // Create a project (with optional auto-research from URL)
  app.post<{
    Body: {
      name: string;
      description?: string;
      product?: string;
      targetUsers?: string;
      competitors?: string;
      goals?: string;
      website?: string;
      autoResearch?: boolean;
    };
  }>("/api/projects", async (request, reply) => {
    const {
      name,
      description,
      product,
      targetUsers,
      competitors,
      goals,
      website,
      autoResearch,
    } = request.body;

    if (!name) {
      return reply.code(400).send({ error: "Project name is required" });
    }

    // User is already authenticated and synced to DB by auth middleware
    const userId = request.authUser!.id;

    // Create the project
    const project = await createProject({
      userId,
      name,
      description,
      product,
      targetUsers,
      competitors,
      goals,
      website,
    });

    // If auto-research is requested and there's a URL, run the research tool
    if (autoResearch && website) {
      try {
        const toolResult = await researchCompanyUrl.execute(
          { url: website, companyName: name },
          { toolCallId: "auto-research", messages: [] }
        );

        if (toolResult && typeof toolResult === "object") {
          const research = toolResult as Record<string, unknown>;

          // Provision a company-specific sender email (e.g. acmecorp@onera.app)
          const companyEmail = await provisionCompanyEmail(name);

          await updateProject(project.id, {
            description:
              (research.description as string) || description || undefined,
            product: (research.product as string) || product || undefined,
            targetUsers:
              (research.targetUsers as string) || targetUsers || undefined,
            competitors: Array.isArray(research.competitors)
              ? JSON.stringify(research.competitors)
              : competitors || undefined,
            goals: Array.isArray(research.goals)
              ? JSON.stringify(research.goals)
              : goals || undefined,
            ...(companyEmail && { companyEmail }),
          });

          // Send welcome email from the company's own address (fire-and-forget)
          sendWelcomeEmail({
            projectId: project.id,
            projectName: name,
            companyEmail: companyEmail || "operator@onera.app",
            website,
            description: (research.description as string) || description,
            product: (research.product as string) || product,
          }).catch((err) =>
            console.warn(
              "[projects] Welcome email failed:",
              err instanceof Error ? err.message : err
            )
          );

          // Trigger the agent loop for the researched project
          try {
            const queue = getSchedulerQueue();
            await queue.add("initial-agent-loop", {
              type: "agent-loop",
              projectId: project.id,
            });
            console.log(
              `[projects] Triggered initial agent loop for researched project "${name}"`
            );
          } catch (queueErr) {
            console.warn(
              "[projects] Failed to trigger initial agent loop:",
              queueErr instanceof Error ? queueErr.message : queueErr
            );
          }

          // Return the updated project
          const updated = await getProject(project.id);
          return reply.code(201).send(updated);
        }
      } catch (err) {
        // Research failed but project was created - that's fine
        console.warn(
          "[projects] Auto-research failed:",
          err instanceof Error ? err.message : err
        );
      }
    }

    // Trigger the agent loop immediately for this new project
    // This kicks off planner → task creation → task execution
    try {
      const queue = getSchedulerQueue();
      await queue.add("initial-agent-loop", {
        type: "agent-loop",
        projectId: project.id,
      });
      console.log(
        `[projects] Triggered initial agent loop for project "${name}" (${project.id})`
      );
    } catch (err) {
      console.warn(
        "[projects] Failed to trigger initial agent loop:",
        err instanceof Error ? err.message : err
      );
    }

    return reply.code(201).send(project);
  });

  // Update a project
  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      product?: string;
      targetUsers?: string;
      competitors?: string;
      goals?: string;
      website?: string;
    };
  }>("/api/projects/:id", async (request, reply) => {
    try {
      const project = await updateProject(request.params.id, request.body);
      return reply.send(project);
    } catch {
      return reply.code(404).send({ error: "Project not found" });
    }
  });

  // Delete a project
  app.delete<{ Params: { id: string } }>(
    "/api/projects/:id",
    async (request, reply) => {
      try {
        await deleteProject(request.params.id);
        return reply.code(204).send();
      } catch {
        return reply.code(404).send({ error: "Project not found" });
      }
    }
  );
}
