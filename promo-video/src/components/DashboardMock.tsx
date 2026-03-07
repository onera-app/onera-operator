import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { C } from "../colors";
import { sansFont, monoFont } from "../fonts";

/**
 * Simulated dashboard UI that mimics the real Onera Operator product.
 * Shows a multi-column layout with live data, agent activity, etc.
 */
export const DashboardMock = ({ delay = 0 }: { delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.max(0, frame - delay);

  // Main window entrance
  const windowProgress = interpolate(t, [0, fps * 0.8], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const windowScale = interpolate(t, [0, fps * 0.8], [0.92, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const col1Opacity = interpolate(t, [fps * 0.3, fps * 0.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const col2Opacity = interpolate(t, [fps * 0.6, fps * 1.1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const col3Opacity = interpolate(t, [fps * 0.9, fps * 1.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pulsing dot for live indicator
  const pulse = 0.5 + Math.sin(t * 0.15) * 0.5;

  // Animated task count
  const taskCount = Math.min(47, Math.floor(interpolate(t, [fps * 1.2, fps * 2.5], [0, 47], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })));

  const cardStyle = {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    border: `1px dashed ${C.blueprintLine}`,
    borderRadius: 8,
    padding: "12px 14px",
    marginBottom: 10,
  };

  const labelStyle = {
    fontFamily: monoFont,
    fontSize: 10,
    color: C.blue,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: 4,
  };

  const statStyle = {
    fontFamily: monoFont,
    fontSize: 22,
    fontWeight: 700,
    color: C.white,
  };

  return (
    <div
      style={{
        width: 1100,
        height: 660,
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${C.cardBorder}`,
        backgroundColor: "rgba(6, 6, 15, 0.95)",
        opacity: windowProgress,
        transform: `scale(${windowScale})`,
        boxShadow: `0 30px 80px rgba(0, 0, 0, 0.6), 0 0 60px ${C.blueGlow}`,
      }}
    >
      {/* Top terminal bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          backgroundColor: "rgba(10, 12, 24, 0.95)",
          borderBottom: `1px solid ${C.cardBorder}`,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#FF5F56" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#FFBD2E" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#27C93F" }} />
        <div style={{ flex: 1 }} />
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 11,
            color: C.termCyan,
          }}
        >
          {">"} planner agent running...
        </div>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: C.termGreen,
            opacity: pulse,
          }}
        />
      </div>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          borderBottom: `1px solid ${C.cardBorder}`,
        }}
      >
        <div style={{ fontFamily: sansFont, fontSize: 16, fontWeight: 700, color: C.white, letterSpacing: "-0.02em" }}>
          Onera Operator
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 10,
              color: C.termGreen,
              padding: "3px 8px",
              borderRadius: 4,
              border: `1px solid rgba(74, 222, 128, 0.3)`,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                backgroundColor: C.termGreen,
                opacity: pulse,
              }}
            />
            Live
          </div>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              backgroundColor: C.blue,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: sansFont,
              fontSize: 11,
              fontWeight: 600,
              color: C.white,
            }}
          >
            S
          </div>
        </div>
      </div>

      {/* Columns */}
      <div style={{ display: "flex", flex: 1, height: "calc(100% - 80px)" }}>
        {/* Column 1: Company */}
        <div
          style={{
            width: "30%",
            borderRight: `1px solid ${C.cardBorder}`,
            padding: 16,
            opacity: col1Opacity,
            overflow: "hidden",
          }}
        >
          <div style={{ fontFamily: sansFont, fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 4 }}>
            Acme Corp
          </div>
          <div style={{ fontFamily: sansFont, fontSize: 11, color: C.gray, marginBottom: 16 }}>
            AI-powered growth platform
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div style={{ ...cardStyle, flex: 1, textAlign: "center" as const }}>
              <div style={labelStyle}>Tasks</div>
              <div style={statStyle}>{taskCount}</div>
            </div>
            <div style={{ ...cardStyle, flex: 1, textAlign: "center" as const }}>
              <div style={labelStyle}>Agents</div>
              <div style={statStyle}>5</div>
            </div>
          </div>

          {/* Agent list */}
          <div style={labelStyle}>Active Agents</div>
          {["Planner", "Outreach", "Twitter", "Research", "Engineer"].map((agent, i) => {
            const isActive = i < 3;
            const agentAppear = interpolate(t, [fps * (1.0 + i * 0.15), fps * (1.3 + i * 0.15)], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 0",
                  opacity: agentAppear,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: isActive ? C.termGreen : C.gray,
                    opacity: isActive ? pulse : 0.5,
                  }}
                />
                <div style={{ fontFamily: monoFont, fontSize: 12, color: isActive ? C.white : C.gray }}>
                  {agent}
                </div>
                {isActive && (
                  <div
                    style={{
                      marginLeft: "auto",
                      fontFamily: monoFont,
                      fontSize: 9,
                      color: C.termGreen,
                      padding: "1px 6px",
                      borderRadius: 3,
                      border: `1px solid rgba(74, 222, 128, 0.2)`,
                    }}
                  >
                    running
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Column 2: Tasks */}
        <div
          style={{
            width: "40%",
            borderRight: `1px solid ${C.cardBorder}`,
            padding: 16,
            opacity: col2Opacity,
            overflow: "hidden",
          }}
        >
          <div style={labelStyle}>Running Tasks</div>

          {/* Active task */}
          <div
            style={{
              ...cardStyle,
              borderStyle: "solid",
              borderColor: "rgba(74, 222, 128, 0.3)",
              borderWidth: 1,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: 9,
                  color: "#67E8F9",
                  padding: "1px 6px",
                  borderRadius: 3,
                  backgroundColor: "rgba(103, 232, 249, 0.1)",
                }}
              >
                TWITTER
              </div>
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  backgroundColor: C.termGreen,
                  opacity: pulse,
                }}
              />
            </div>
            <div style={{ fontFamily: sansFont, fontSize: 13, color: C.white, fontWeight: 500 }}>
              Generate and schedule 3 tweets about product launch
            </div>
            <div style={{ fontFamily: monoFont, fontSize: 10, color: C.gray, marginTop: 4 }}>
              2m 14s elapsed
            </div>
          </div>

          {/* More tasks */}
          {[
            { tag: "OUTREACH", tagColor: "#A78BFA", text: "Send personalized cold emails to 15 B2B leads" },
            { tag: "RESEARCH", tagColor: "#FCD34D", text: "Competitive analysis: pricing and feature comparison" },
            { tag: "ENGINEERING", tagColor: "#34D399", text: "Set up automated email sequences with tracking" },
          ].map((task, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 9,
                    color: task.tagColor,
                    padding: "1px 6px",
                    borderRadius: 3,
                    backgroundColor: `${task.tagColor}15`,
                  }}
                >
                  {task.tag}
                </div>
              </div>
              <div style={{ fontFamily: sansFont, fontSize: 12, color: C.dimWhite }}>
                {task.text}
              </div>
            </div>
          ))}

          <div style={labelStyle}>Completed Today</div>
          {["Analyze top 5 competitor landing pages", "Draft weekly growth report"].map((task, i) => (
            <div key={i} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontFamily: sansFont, fontSize: 11, color: C.termGreen }}>
                {"✓"}
              </div>
              <div style={{ fontFamily: sansFont, fontSize: 12, color: C.gray }}>
                {task}
              </div>
            </div>
          ))}
        </div>

        {/* Column 3: Social / Output */}
        <div
          style={{
            width: "30%",
            padding: 16,
            opacity: col3Opacity,
            overflow: "hidden",
          }}
        >
          <div style={labelStyle}>Recent Tweets</div>

          {[
            "We just shipped autonomous cold outreach. Your AI SDR finds leads, writes personalized emails, and sends them. Zero manual work.",
            "Building in public: our research agent now monitors 50+ competitor signals in real-time. Pricing changes, feature launches, hiring patterns.",
          ].map((tweet, i) => {
            const tweetProgress = interpolate(t, [fps * (1.8 + i * 0.5), fps * (2.2 + i * 0.5)], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div key={i} style={{ ...cardStyle, opacity: tweetProgress }}>
                <div style={{ fontFamily: sansFont, fontSize: 11, color: C.dimWhite, lineHeight: 1.5 }}>
                  {tweet}
                </div>
                <div style={{ fontFamily: monoFont, fontSize: 9, color: C.gray, marginTop: 6 }}>
                  @onerachat · 2h ago
                </div>
              </div>
            );
          })}

          <div style={{ ...labelStyle, marginTop: 8 }}>Email Outreach</div>
          {[
            { to: "sarah@techcorp.io", subject: "Quick thought on your growth stack" },
            { to: "james@saasly.com", subject: "Saw your Series A — congrats!" },
          ].map((email, i) => {
            const emailProgress = interpolate(t, [fps * (2.5 + i * 0.4), fps * (2.9 + i * 0.4)], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div key={i} style={{ ...cardStyle, opacity: emailProgress }}>
                <div style={{ fontFamily: monoFont, fontSize: 10, color: C.termGreen, marginBottom: 2 }}>
                  SENT
                </div>
                <div style={{ fontFamily: sansFont, fontSize: 11, color: C.white }}>
                  {email.subject}
                </div>
                <div style={{ fontFamily: monoFont, fontSize: 9, color: C.gray, marginTop: 2 }}>
                  to: {email.to}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
