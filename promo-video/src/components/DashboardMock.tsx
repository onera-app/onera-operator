import { C } from "../colors";
import { serifFont, monoFont, sansFont } from "../fonts";
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { CornerMarks } from "./BlueprintElements";

/**
 * Blueprint wireframe dashboard — dark blue with cyan/white wireframe lines.
 * Mimics the real Onera Operator dashboard layout.
 */
export const DashboardMock = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const dashboardEnter = spring({ frame, fps, config: { damping: 14 } });

  // Animated counters
  const tasksCompleted = Math.floor(interpolate(frame, [0, 200], [1402, 1408]));
  const emailsSent = Math.floor(interpolate(frame, [0, 200], [890, 895]));
  const tweetsPosted = Math.floor(interpolate(frame, [0, 200], [312, 314]));

  // Progress bar
  const progress1 = spring({ frame: frame - 45, fps, config: { damping: 20 }, durationInFrames: 120 }) * 75;

  // Blinker for live indicator
  const blink = Math.sin(frame * 0.15) > 0 ? 1 : 0.4;

  return (
    <div
      style={{
        width: 1440,
        height: 850,
        backgroundColor: "rgba(26, 39, 68, 0.95)",
        border: `1px solid ${C.wire}`,
        display: "flex",
        flexDirection: "column",
        transform: `scale(${interpolate(dashboardEnter, [0, 1], [0.95, 1])})`,
        opacity: dashboardEnter,
        position: "relative",
        boxShadow: `0 0 80px rgba(120, 180, 255, 0.08)`,
      }}
    >
      <CornerMarks color={C.wireGlow} size={16} />

      {/* ── Header ─────────────────────────────────── */}
      <div
        style={{
          height: 56,
          borderBottom: `1px solid ${C.wire}`,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontFamily: serifFont, fontWeight: 800, fontSize: 24, color: C.textPrimary }}>
            Onera Operator
          </div>
          <div style={{ width: 1, height: 20, backgroundColor: C.wire }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: `1px solid ${C.wire}`,
              color: C.accent,
              padding: "3px 10px",
              fontSize: 9,
              fontFamily: monoFont,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
            }}
          >
            <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: C.green, opacity: blink }} />
            SYSTEM_LIVE
          </div>
        </div>
        <div style={{ fontFamily: monoFont, fontSize: 10, color: C.textMuted }}>REV 3.2.0</div>
      </div>

      {/* ── 4-column Layout ──────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Col 1: Operator + Agents */}
        <div style={{ width: 280, borderRight: `1px solid ${C.wireDim}`, padding: 20, display: "flex", flexDirection: "column", gap: 28 }}>
          <div>
            <div style={{ borderBottom: `1px solid ${C.wire}`, paddingBottom: 8, marginBottom: 16 }}>
              <span style={{ fontFamily: monoFont, fontWeight: 700, fontSize: 10, color: C.accent, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                Operator Status
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: 100,
                border: `1px dashed ${C.wire}`,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                position: "relative",
              }}
            >
              <CornerMarks color={C.wireDim} size={8} />
              {/* Simple face indicator */}
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ width: 20, height: 6, backgroundColor: C.accent }} />
                <div style={{ width: 20, height: 6, backgroundColor: C.accent }} />
              </div>
            </div>
          </div>

          <div>
            <div style={{ borderBottom: `1px solid ${C.wire}`, paddingBottom: 8, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: monoFont, fontWeight: 700, fontSize: 10, color: C.accent, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                Active Nodes
              </span>
              <span style={{ fontFamily: monoFont, fontSize: 9, color: C.green }}>[3 ONLINE]</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["planner", "engineer", "outreach", "twitter"].map((agent, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: i < 3 ? C.green : C.textMuted, fontSize: 10 }}>{i < 3 ? "●" : "○"}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 13, color: i < 3 ? C.textPrimary : C.textMuted }}>{agent}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Col 2: Metrics */}
        <div style={{ width: 260, borderRight: `1px solid ${C.wireDim}`, padding: 20, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ borderBottom: `1px solid ${C.wire}`, paddingBottom: 8 }}>
            <span style={{ fontFamily: monoFont, fontWeight: 700, fontSize: 10, color: C.accent, letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Metrics
            </span>
          </div>

          {[
            { label: "Tasks Completed", value: tasksCompleted, size: 38 },
            { label: "Emails Sent", value: emailsSent, size: 28 },
            { label: "Tweets Posted", value: tweetsPosted, size: 28 },
          ].map(({ label, value, size }, i) => (
            <div key={i} style={{ ...(i > 0 ? { borderTop: `1px dashed ${C.wireDim}`, paddingTop: 12 } : {}) }}>
              <div style={{ fontFamily: monoFont, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: C.textMuted }}>
                {label}
              </div>
              <div style={{ fontFamily: sansFont, fontSize: size, fontWeight: 800, color: C.textPrimary, marginTop: 4 }}>
                {value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {/* Col 3: Tasks */}
        <div style={{ flex: 1, borderRight: `1px solid ${C.wireDim}`, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ borderBottom: `1px solid ${C.wire}`, paddingBottom: 8 }}>
            <span style={{ fontFamily: monoFont, fontWeight: 700, fontSize: 10, color: C.accent, letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Task Queue
            </span>
          </div>

          {/* Running task */}
          <div style={{ border: `1px solid ${C.wireGlow}`, backgroundColor: "rgba(120, 180, 255, 0.04)", padding: 16, position: "relative" }}>
            <CornerMarks color={C.wireGlow} size={8} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontFamily: monoFont, color: C.accent, fontSize: 14 }}>&gt;</div>
              <div style={{ fontFamily: sansFont, fontWeight: 700, fontSize: 16, color: C.textPrimary }}>Implement React Dashboard</div>
            </div>
            <div style={{ fontFamily: monoFont, fontSize: 11, color: C.textMuted, marginTop: 8 }}>
              Writing components based on LivePage design.
            </div>
            <div style={{ height: 3, border: `1px solid ${C.wireDim}`, marginTop: 12, padding: 1 }}>
              <div style={{ height: "100%", backgroundColor: C.accent, width: `${progress1}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
              <span style={{ fontFamily: monoFont, fontSize: 9, color: C.accent, letterSpacing: "0.12em" }}>[ENGINEERING]</span>
              <span style={{ fontFamily: monoFont, fontSize: 9, color: C.textMuted }}>T+ 2m 14s</span>
            </div>
          </div>

          {/* Completed task */}
          <div style={{ border: `1px dashed ${C.wireDim}`, padding: 16 }}>
            <div style={{ fontFamily: sansFont, fontWeight: 600, fontSize: 14, color: C.textSecondary }}>Research Open Source Competitors</div>
            <div style={{ fontFamily: monoFont, fontSize: 10, color: C.textMuted, marginTop: 6 }}>Analyzed 5 competitor repositories.</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, borderTop: `1px dashed ${C.wireDim}`, paddingTop: 8 }}>
              <span style={{ fontFamily: monoFont, fontSize: 9, color: C.textMuted, letterSpacing: "0.12em" }}>[RESEARCH]</span>
              <span style={{ fontFamily: monoFont, fontSize: 9, color: C.green }}>COMPLETED</span>
            </div>
          </div>
        </div>

        {/* Col 4: Terminal */}
        <div style={{ width: 320, padding: 20, display: "flex", flexDirection: "column", gap: 16, backgroundColor: "rgba(0, 0, 0, 0.15)" }}>
          <div style={{ borderBottom: `1px solid ${C.wire}`, paddingBottom: 8 }}>
            <span style={{ fontFamily: monoFont, fontWeight: 700, fontSize: 10, color: C.accent, letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Terminal I/O
            </span>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 16 }}>
            <div>
              <span style={{ fontFamily: monoFont, fontSize: 9, color: C.accent, letterSpacing: "0.1em" }}>&gt; USER_QUERY</span>
              <div style={{ fontFamily: monoFont, fontSize: 12, color: C.textSecondary, marginTop: 4 }}>What are you working on right now?</div>
            </div>
            <div>
              <span style={{ fontFamily: monoFont, fontSize: 9, color: C.accent, letterSpacing: "0.1em" }}>&gt; SYSTEM_REPLY</span>
              <div style={{ fontFamily: monoFont, fontSize: 12, borderLeft: `2px solid ${C.accent}`, paddingLeft: 12, color: C.textSecondary, lineHeight: 1.5, marginTop: 4 }}>
                Implementing the React dashboard. Task is 75% complete.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <div style={{ flex: 1, border: `1px solid ${C.wireDim}`, padding: "6px 12px", fontFamily: monoFont, fontSize: 10, color: C.textMuted }}>_</div>
            <div style={{ border: `1px solid ${C.wire}`, padding: "6px 14px", fontFamily: monoFont, fontSize: 10, color: C.accent, fontWeight: 700 }}>EXEC</div>
          </div>
        </div>
      </div>
    </div>
  );
};
