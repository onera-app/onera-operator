"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, parseChatStream, injectSourceLinks } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectOption {
  id: string;
  name: string;
}

interface AskPanelProps {
  projectId?: string;
  projects?: ProjectOption[];
  onProjectChange?: (projectId: string) => void;
}

// ---------------------------------------------------------------------------
// ProjectSwitcher — compact dropdown inside the Ask Operator header
// ---------------------------------------------------------------------------

function ProjectSwitcher({
  projects,
  activeProjectId,
  onSwitch,
}: {
  projects: ProjectOption[];
  activeProjectId?: string;
  onSwitch: (id: string) => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const activeName =
    projects.find((p) => p.id === activeProjectId)?.name ?? "Select project";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 border border-dashed px-2 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors",
          dropdownOpen
            ? "border-primary text-primary bg-primary/5"
            : "border-border text-muted-foreground hover:border-primary hover:text-primary"
        )}
      >
        <span className="max-w-[120px] truncate">{activeName}</span>
        <ChevronDown
          size={10}
          className={cn(
            "shrink-0 transition-transform",
            dropdownOpen && "rotate-180"
          )}
        />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-1 z-[60] min-w-[160px] max-w-[220px] border border-dashed border-border bg-background shadow-md">
          <div className="px-2 py-1.5 border-b border-dashed border-border">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-mono">
              Switch Company
            </span>
          </div>
          {projects.map((p) => {
            const isActive = p.id === activeProjectId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSwitch(p.id);
                  setDropdownOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] font-mono transition-colors",
                  isActive
                    ? "text-primary bg-primary/5"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                )}
              >
                <Check
                  size={10}
                  className={cn(
                    "shrink-0",
                    isActive ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AskPanelChat — inner component that owns the useChat hook.
// Keyed by projectId so React remounts it (and resets the chat) on switch.
// ---------------------------------------------------------------------------

function AskPanelChat({ projectId }: { projectId?: string }) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new TextStreamChatTransport({
      api: "/api/chat",
      body: { projectId },
    }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const suggestions = [
    "What are you working on?",
    "Create a HIGH priority outreach task",
    "Summarize today's progress",
  ];

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">Try asking:</p>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={isLoading}
                className="block w-full text-left text-[11px] text-muted-foreground hover:text-primary border border-dashed border-border hover:border-primary/40 px-3 py-2 transition-colors disabled:opacity-50"
                onClick={() => {
                  sendMessage({ text: s });
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((message) => {
          const isAssistant = message.role === "assistant";
          const messageText =
            message.parts
              ?.filter(
                (p): p is { type: "text"; text: string } => p.type === "text"
              )
              .map((p) => p.text)
              .join("") || "";
          const parsed = isAssistant ? parseChatStream(messageText) : null;
          const rawText = parsed ? parsed.text : messageText;
          // Inject source links so [1], [2] become clickable markdown links
          const displayText = parsed?.sources?.length
            ? injectSourceLinks(rawText, parsed.sources)
            : rawText;
          const isLastAssistant =
            isAssistant &&
            isLoading &&
            message.id ===
              messages.filter((m) => m.role === "assistant").at(-1)?.id;
          const activeLabel = isLastAssistant ? parsed?.activeLabel : null;

          return (
            <div key={message.id}>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 block mb-1">
                {message.role === "user" ? "You" : "Operator"}
              </span>
              {message.role === "user" ? (
                <div className="text-xs leading-relaxed text-muted-foreground">
                  {messageText}
                </div>
              ) : (
                <div className="border-l-2 border-primary pl-3 text-xs leading-relaxed prose-sm">
                  {activeLabel && (
                    <div className="flex items-center gap-1.5 mb-2 text-[10px] text-primary animate-pulse font-mono">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                      {activeLabel}...
                    </div>
                  )}
                  {parsed && parsed.statuses.length > 0 && (
                    <div className="mb-2 space-y-0.5">
                      {parsed.statuses
                        .filter((s) => s.type === "tool-result")
                        .map((s, i) => (
                          <div
                            key={i}
                            className="text-[10px] text-muted-foreground/70 font-mono"
                          >
                            ✓ {s.tool}
                          </div>
                        ))}
                    </div>
                  )}
                  {displayText && (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => (
                          <p className="text-xs leading-relaxed mb-1.5 last:mb-0">
                            {children}
                          </p>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-bold text-primary">
                            {children}
                          </strong>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc pl-4 space-y-0.5 mb-1.5">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-4 space-y-0.5 mb-1.5">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="text-xs leading-relaxed">
                            {children}
                          </li>
                        ),
                        code: ({ children }) => (
                          <code className="bg-muted px-1 py-0.5 text-[10px] font-mono">
                            {children}
                          </code>
                        ),
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-2 hover:text-primary/80"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {displayText}
                    </ReactMarkdown>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isLoading &&
          messages.filter((m) => m.role === "assistant").length === 0 && (
            <div>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 block mb-1">
                Operator
              </span>
              <div className="border-l-2 border-primary pl-3 text-xs text-primary animate-pulse">
                thinking...
              </div>
            </div>
          )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || isLoading) return;
          sendMessage({ text: input });
          setInput("");
        }}
        className="shrink-0 flex items-center gap-2 border-t border-dashed border-border px-4 py-3"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything..."
          disabled={isLoading}
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-7 border-dashed px-3 text-[10px]"
          disabled={!input.trim() || isLoading}
        >
          Send
        </Button>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------
// AskPanel — the outer shell with toggle, header, and project switcher
// ---------------------------------------------------------------------------

export function AskPanel({
  projectId,
  projects,
  onProjectChange,
}: AskPanelProps) {
  const [open, setOpen] = useState(false);
  // Track a local override so the user can switch inside the panel
  const [localProjectId, setLocalProjectId] = useState<string | undefined>(
    projectId
  );
  const [chatKey, setChatKey] = useState(0);

  // Sync when the parent changes the selected project (e.g. via the dashboard bar)
  useEffect(() => {
    setLocalProjectId(projectId);
    setChatKey((k) => k + 1);
  }, [projectId]);

  const activeProjectId = localProjectId ?? projectId;
  const activeProjectName = projects?.find(
    (p) => p.id === activeProjectId
  )?.name;

  const handleProjectSwitch = (newProjectId: string) => {
    if (newProjectId === activeProjectId) return;
    setLocalProjectId(newProjectId);
    // Force chat to reinitialize with the new project context
    setChatKey((k) => k + 1);
    // Notify parent so the dashboard can stay in sync
    onProjectChange?.(newProjectId);
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex items-center gap-2 border border-dashed px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all",
          open
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-primary hover:border-primary hover:bg-primary/5"
        )}
      >
        {open ? "Close" : "> Ask Operator"}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-16 right-5 z-50 flex w-[400px] flex-col border border-dashed border-border bg-background shadow-lg"
          style={{ maxHeight: "min(520px, calc(100vh - 120px))" }}
        >
          {/* Header */}
          <div className="shrink-0 border-b border-dashed border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ask Operator
              </h3>
              {/* Project switcher dropdown — visible when multiple companies exist */}
              {projects && projects.length > 1 && (
                <ProjectSwitcher
                  projects={projects}
                  activeProjectId={activeProjectId}
                  onSwitch={handleProjectSwitch}
                />
              )}
            </div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
              Ask for status, create tasks, or request updates.
              {activeProjectName && (
                <span className="ml-1 font-mono text-primary">
                  [{activeProjectName}]
                </span>
              )}
            </p>
          </div>

          {/* Chat body — keyed by chatKey so switching projects resets the conversation */}
          <AskPanelChat key={chatKey} projectId={activeProjectId} />
        </div>
      )}
    </>
  );
}
