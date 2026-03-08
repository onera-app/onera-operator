"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { cn, parseChatStream, injectSourceLinks } from "@/lib/utils";

interface ChatBarProps {
  projectId?: string;
}

export function ChatBar({ projectId }: ChatBarProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    sendMessage,
    status,
    setMessages,
  } = useChat({
    transport: new TextStreamChatTransport({
      api: "/api/chat",
      body: { projectId },
    }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  function clearChat() {
    setMessages([]);
  }

  return (
    <div className="w-full">
      {/* Chat overlay panel */}
      {hasMessages && (
        <div className="border border-dashed border-border border-b-0 bg-background max-h-[400px] overflow-y-auto scrollbar-thin mx-4">
          <div className="flex items-center justify-between px-4 py-2 border-b border-dashed border-border">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Chat
            </span>
            <Button
              onClick={clearChat}
              variant="ghost"
              size="sm"
              className="h-6 px-1 text-[10px] text-muted-foreground hover:bg-transparent hover:text-primary"
            >
              [close]
            </Button>
          </div>
          <div className="p-4 space-y-3">
            {messages.map((message) => {
              const isAssistant = message.role === "assistant";
              const messageText = message.parts
                ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map((p) => p.text)
                .join("") || "";
              const parsed = isAssistant ? parseChatStream(messageText) : null;
              const rawText = parsed ? parsed.text : messageText;
              const displayText = parsed?.sources?.length
                ? injectSourceLinks(rawText, parsed.sources)
                : rawText;
              const isLastAssistant =
                isAssistant &&
                isLoading &&
                message.id === messages.filter((m) => m.role === "assistant").at(-1)?.id;
              const activeLabel = isLastAssistant ? parsed?.activeLabel : null;

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-start gap-2",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {isAssistant && (
                    <span className="text-xs text-primary font-bold shrink-0 mt-0.5">
                      AI&gt;
                    </span>
                  )}
                  <div
                    className={cn(
                      "px-3 py-2 text-xs max-w-[80%] leading-relaxed",
                      message.role === "user"
                        ? "border-2 border-primary bg-primary text-primary-foreground"
                        : "border border-dashed border-border"
                    )}
                  >
                    {activeLabel && (
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] text-primary animate-pulse font-mono">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                        {activeLabel}...
                      </div>
                    )}
                    {displayText ? (
                      isAssistant ? (
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
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
                      ) : (
                        displayText
                      )
                    ) : (isLastAssistant && !activeLabel && (
                      <span className="animate-pulse text-primary">thinking...</span>
                    ))}
                  </div>
                  {message.role === "user" && (
                    <span className="text-xs text-muted-foreground font-bold shrink-0 mt-0.5">
                      You
                    </span>
                  )}
                </div>
              );
            })}
            {isLoading && messages.filter((m) => m.role === "assistant").length === 0 && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-primary font-bold shrink-0 mt-0.5">
                  AI&gt;
                </span>
                <div className="border border-dashed border-border px-3 py-2 text-xs">
                  <span className="animate-pulse">thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = input.trim();
          if (!trimmed || isLoading) return;
          sendMessage({ text: trimmed });
          setInput("");
        }}
        className={cn(
          "flex items-center gap-3 border-t border-dashed border-border bg-background px-6 py-3",
          hasMessages && "mx-4 border border-dashed border-border border-t-0"
        )}
      >
        <span className="text-xs text-muted-foreground shrink-0 font-mono">&gt;</span>
        <Input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Onera anything..."
          className="h-8 flex-1 border-0 border-b-2 border-border bg-transparent px-1 text-xs focus-visible:border-primary"
        />

        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={!input.trim() || isLoading}
          className="shrink-0 text-[10px] disabled:opacity-30"
        >
          Send &rarr;
        </Button>
      </form>
    </div>
  );
}
