import { tool } from "ai";
import { z } from "zod";

/**
 * Execute Code Tool — runs code in a sandboxed E2B environment.
 *
 * Supports Python and JavaScript/TypeScript code execution.
 * Results include stdout, stderr, and any returned values.
 *
 * Requires E2B_API_KEY environment variable.
 * Get a key at: https://e2b.dev
 */
export const executeCode = tool({
  description:
    "Execute code in a secure sandbox environment. Use this to run Python or JavaScript scripts, " +
    "data analysis, web scraping scripts, automation tasks, or any code that needs to be executed. " +
    "Returns stdout, stderr, and execution results.",
  parameters: z.object({
    code: z.string().describe("The code to execute"),
    language: z
      .enum(["python", "javascript", "bash"])
      .default("python")
      .describe("Programming language to run the code in"),
    timeout: z
      .number()
      .min(5)
      .max(300)
      .optional()
      .default(60)
      .describe("Execution timeout in seconds (default: 60, max: 300)"),
    packages: z
      .array(z.string())
      .optional()
      .describe("Additional Python packages to install before running (e.g. ['pandas', 'requests'])"),
  }),
  execute: async ({ code, language = "python", timeout = 60, packages = [] }) => {
    const apiKey = process.env.E2B_API_KEY;

    if (!apiKey) {
      console.log(
        `[executeCode] E2B_API_KEY not set — would execute ${language} code:\n${code.substring(0, 200)}...`
      );
      return {
        success: false,
        language,
        stdout: "",
        stderr: "",
        error: "E2B_API_KEY not configured. Get your key at https://e2b.dev and set E2B_API_KEY.",
        sandboxed: false,
      };
    }

    try {
      const { Sandbox } = await import("@e2b/code-interpreter");

      const sandbox = await Sandbox.create({
        apiKey,
        timeoutMs: timeout * 1000,
      });

      try {
        // Install additional packages if requested (Python only)
        if (packages.length > 0 && language === "python") {
          const installCmd = `import subprocess; subprocess.run(['pip', 'install', '-q', ${packages.map((p) => JSON.stringify(p)).join(", ")}])`;
          await sandbox.runCode(installCmd);
        }

        let result;

        if (language === "javascript") {
          result = await sandbox.runCode(code, { language: "js" });
        } else if (language === "bash") {
          // Wrap bash in Python subprocess for execution in E2B
          const bashWrapper = [
            "import subprocess, sys",
            `result = subprocess.run(${JSON.stringify(code)}, shell=True, capture_output=True, text=True)`,
            "print(result.stdout, end='')",
            "sys.stderr.write(result.stderr)",
          ].join("\n");
          result = await sandbox.runCode(bashWrapper);
        } else {
          result = await sandbox.runCode(code);
        }

        const stdout = result.logs?.stdout?.join("") || "";
        const stderr = result.logs?.stderr?.join("") || "";
        const hasError = result.error !== undefined;

        return {
          success: !hasError,
          language,
          stdout: stdout.substring(0, 10000),
          stderr: stderr.substring(0, 5000),
          error: result.error ? String(result.error) : undefined,
          results: (result.results || []).map((r) => ({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: (r as any).type ?? r.constructor?.name ?? "unknown",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: (r as any).data ?? String(r),
          })),
          sandboxed: true,
        };
      } finally {
        await sandbox.kill();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[executeCode] Sandbox execution failed:", message);
      return {
        success: false,
        language,
        stdout: "",
        stderr: message,
        error: `Sandbox execution failed: ${message}`,
        sandboxed: true,
      };
    }
  },
});
