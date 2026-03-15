import { C } from "../colors";
import { sansFont, monoFont } from "../fonts";
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

/**
 * A faithful recreation of the real Onera Dashboard in "Pro Light" mode.
 */
export const DashboardMock = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 14 } });
  
  const progress1 = spring({ frame: frame - 60, fps, config: { damping: 20 }, durationInFrames: 120 }) * 78;

  return (
    <div
      style={{
        width: 1440,
        height: 880,
        backgroundColor: "#FFFFFF",
        border: `1.5px solid ${C.border}`,
        display: "flex",
        flexDirection: "column",
        transform: `scale(${interpolate(enter, [0, 1], [0.98, 1])})`,
        opacity: enter,
        position: "relative",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: `0 40px 100px ${C.shadow}`
      }}
    >
      {/* ── Terminal Bar (Top) ───────────────────────────────────── */}
      <div style={{ 
        height: 48, 
        backgroundColor: "#09090b", 
        borderBottom: `1px solid ${C.primary}`, 
        display: "flex", 
        alignItems: "center", 
        padding: "0 20px", 
        gap: 12
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#ff5f57" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#febc2e" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#28c840" }} />
        </div>
        <div style={{ fontFamily: monoFont, fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>
          SYSTEM_LOG_v1.0.4 — <span style={{ color: C.green }}>CONNECTED</span>
        </div>
      </div>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div style={{ 
        height: 64, 
        borderBottom: `1px solid ${C.border}`, 
        display: "flex", 
        alignItems: "center", 
        padding: "0 32px", 
        justifyContent: "space-between",
        backgroundColor: C.bgSecondary
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontFamily: sansFont, fontWeight: 800, fontSize: 22, color: C.foreground, letterSpacing: "-0.02em" }}>Onera</div>
          <div style={{ 
            backgroundColor: "rgba(250, 120, 42, 0.1)", 
            color: "#fa782a", 
            padding: "4px 8px", 
            fontSize: 10, 
            fontFamily: sansFont, 
            fontWeight: "bold", 
            textTransform: "uppercase", 
            letterSpacing: "0.1em",
            borderRadius: 4,
            border: "1px solid rgba(250, 120, 42, 0.2)"
          }}>
            Live
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#fff", border: `1px solid ${C.border}` }} />
        </div>
      </div>

      {/* ── 5-Column Grid Layout ─────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        
        {/* Col 1: Company */}
        <div style={{ width: 280, borderRight: `1px solid ${C.border}`, padding: 24, display: "flex", flexDirection: "column", gap: 32, backgroundColor: "#fff" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontFamily: sansFont, fontWeight: 700, fontSize: 13, color: C.textSecondary, textTransform: "uppercase", letterSpacing: "0.1em" }}>Nodes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {["planner", "research", "social", "engineer"].map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: i < 3 ? C.green : C.textMuted }} />
                  <span style={{ fontFamily: sansFont, fontSize: 15, color: i < 3 ? C.foreground : C.textSecondary, fontWeight: 500 }}>{a}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 16, backgroundColor: C.bgSecondary, padding: 20 }}>
             <div style={{ fontFamily: sansFont, fontSize: 12, color: C.textSecondary, marginBottom: 8, fontWeight: 600 }}>CREDITS</div>
             <div style={{ fontFamily: sansFont, fontSize: 32, fontWeight: 800, color: C.primary }}>1,240</div>
          </div>
        </div>

        {/* Col 2: Tasks */}
        <div style={{ width: 280, borderRight: `1px solid ${C.border}`, padding: 24, display: "flex", flexDirection: "column", gap: 24, backgroundColor: C.bgSecondary + "40" }}>
          <div style={{ fontFamily: sansFont, fontWeight: 700, fontSize: 13, color: C.textSecondary, textTransform: "uppercase", letterSpacing: "0.1em" }}>Task Queue</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ padding: 16, border: `1.5px solid ${C.border}`, borderRadius: 16, backgroundColor: "#fff" }}>
                <div style={{ fontFamily: sansFont, fontSize: 14, fontWeight: 700, color: C.foreground, marginBottom: 4 }}>Research Target {i}</div>
                <div style={{ fontFamily: sansFont, fontSize: 12, color: C.textSecondary }}>Growth Strategy</div>
              </div>
            ))}
          </div>
        </div>

        {/* Col 3: Social */}
        <div style={{ width: 280, borderRight: `1px solid ${C.border}`, padding: 24, display: "flex", flexDirection: "column", gap: 24, backgroundColor: "#fff" }}>
          <div style={{ fontFamily: sansFont, fontWeight: 700, fontSize: 13, color: C.textSecondary, textTransform: "uppercase", letterSpacing: "0.1em" }}>Social Feed</div>
          <div style={{ padding: 16, border: `1.5px solid ${C.border}`, borderRadius: 16, backgroundColor: C.bgSecondary, gap: 12, display: "flex", flexDirection: "column" }}>
             <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
               <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: C.primary }} />
               <div style={{ fontFamily: sansFont, fontSize: 12, fontWeight: 700, color: C.foreground }}>onera_ops</div>
             </div>
             <div style={{ fontFamily: sansFont, fontSize: 13, color: C.foreground, lineHeight: 1.4 }}>Scheduled: Weekly growth report summary...</div>
             <div style={{ fontSize: 11, color: C.primary, fontWeight: 700 }}>POSTED</div>
          </div>
        </div>

        {/* Col 4: Engineering */}
        <div style={{ flex: 1, borderRight: `1px solid ${C.border}`, padding: 24, display: "flex", flexDirection: "column", gap: 24, backgroundColor: C.bgSecondary + "40" }}>
          <div style={{ fontFamily: sansFont, fontWeight: 700, fontSize: 13, color: C.textSecondary, textTransform: "uppercase", letterSpacing: "0.1em" }}>Operational Log</div>
          <div style={{ padding: 24, border: `2px solid ${C.primary}`, borderRadius: 16, backgroundColor: "#fff", position: "relative" }}>
             <div style={{ fontFamily: sansFont, fontSize: 18, fontWeight: 800, color: C.foreground, marginBottom: 8 }}>Building Analytics UI</div>
             <div style={{ fontFamily: monoFont, fontSize: 11, color: C.primary, marginBottom: 16, fontWeight: 600 }}>&gt; Writing React components...</div>
             <div style={{ height: 6, backgroundColor: C.bgSecondary, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", backgroundColor: C.primary, width: `${progress1}%` }} />
             </div>
          </div>
        </div>

        {/* Col 5: Reports */}
        <div style={{ width: 300, padding: 24, display: "flex", flexDirection: "column", gap: 24, backgroundColor: "#fff" }}>
          <div style={{ fontFamily: sansFont, fontWeight: 700, fontSize: 13, color: C.textSecondary, textTransform: "uppercase", letterSpacing: "0.1em" }}>Daily Reports</div>
          <div style={{ padding: 20, border: `1.5px solid ${C.border}`, borderRadius: 16, backgroundColor: C.bgSecondary }}>
             <div style={{ fontFamily: sansFont, fontSize: 15, fontWeight: 700, color: C.foreground, marginBottom: 4 }}>Mar 11 Report</div>
             <div style={{ fontFamily: sansFont, fontSize: 13, color: C.textSecondary }}>12 tasks completed.</div>
          </div>
        </div>

      </div>

      {/* ── Chat Widget (Bottom Right) ───────────────────────────── */}
      <div style={{ 
        position: "absolute", 
        bottom: 24, 
        right: 24, 
        width: 320, 
        height: 54, 
        backgroundColor: C.primary, 
        borderRadius: 27, 
        display: "flex", 
        alignItems: "center", 
        padding: "0 24px", 
        justifyContent: "space-between",
        boxShadow: `0 20px 40px rgba(0, 51, 204, 0.2)`
      }}>
        <div style={{ fontFamily: sansFont, fontSize: 14, color: "#fff", fontWeight: 500 }}>Ask Onera anything...</div>
        <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
           <div style={{ width: 8, height: 8, borderTop: `2.5px solid ${C.primary}`, borderRight: `2.5px solid ${C.primary}`, transform: "rotate(45deg) translate(-1px, 1px)" }} />
        </div>
      </div>
    </div>
  );
};
