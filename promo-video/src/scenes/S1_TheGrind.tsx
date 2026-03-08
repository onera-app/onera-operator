import { AbsoluteFill, useCurrentFrame, interpolate, useVideoConfig } from "remotion";
import { BlueprintBackground } from "../components/BlueprintBackground";
import { Crosshair, Annotation, WirePanel } from "../components/BlueprintElements";
import { serifFont, monoFont, sansFont } from "../fonts";
import { C } from "../colors";

export const S1_TheGrind = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "You're a solo founder. It's 2am."
  const t1 = interpolate(frame, [15, 40], [0, 1], { extrapolateRight: "clamp" });

  // Tab counter: 1 → 47
  const tabsCount = Math.floor(
    interpolate(frame, [60, 140], [1, 47], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );
  const t2 = interpolate(frame, [50, 70], [0, 1], { extrapolateRight: "clamp" });

  // "3 hours writing cold emails..."
  const t3 = interpolate(frame, [210, 240], [0, 1], { extrapolateRight: "clamp" });

  // "CEO / MARKETER / SALES / ENGINEER"
  const roles = ["CEO", "MARKETER", "SALES REP", "ENGINEER", "SOCIAL MEDIA"];
  const t4 = interpolate(frame, [420, 450], [0, 1], { extrapolateRight: "clamp" });

  // "All at once. Every day."
  const t5 = interpolate(frame, [540, 570], [0, 1], { extrapolateRight: "clamp" });

  // Subtle breathing scale
  const breathe = 1 + Math.sin(frame * 0.02) * 0.003;

  return (
    <BlueprintBackground>
      <Crosshair x="15%" y="18%" size={200} rotation={frame * 0.08} opacity={0.08} />
      <Crosshair x="85%" y="82%" size={300} rotation={frame * -0.04} opacity={0.06} />
      <Annotation text="scene_01 / the_grind" x={60} y={40} opacity={0.3} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 100 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 48,
            width: "100%",
            maxWidth: 1200,
            transform: `scale(${breathe})`,
          }}
        >
          {/* Timestamp + Solo founder */}
          <div style={{ opacity: t1 }}>
            <div
              style={{
                fontFamily: monoFont,
                color: C.accent,
                fontSize: 14,
                marginBottom: 12,
                letterSpacing: "0.2em",
              }}
            >
              [ TIMESTAMP: 02:00 AM ]
            </div>
            <h1
              style={{
                fontFamily: serifFont,
                fontSize: 72,
                fontWeight: 700,
                color: C.textPrimary,
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              You're a solo founder.
            </h1>
          </div>

          {/* Tab counter — big number */}
          <div style={{ opacity: t2, display: "flex", alignItems: "baseline", gap: 20 }}>
            <div
              style={{
                fontFamily: sansFont,
                fontSize: 140,
                fontWeight: 900,
                color: C.accent,
                lineHeight: 1,
                textShadow: `0 0 60px rgba(120, 180, 255, 0.3)`,
              }}
            >
              {tabsCount}
            </div>
            <h2
              style={{
                fontFamily: sansFont,
                fontSize: 40,
                color: C.textSecondary,
                margin: 0,
                fontWeight: 500,
              }}
            >
              browser tabs open.
            </h2>
          </div>

          {/* Pain points */}
          <div
            style={{
              opacity: t3,
              borderLeft: `2px solid ${C.wire}`,
              paddingLeft: 28,
            }}
          >
            <h3
              style={{
                fontFamily: serifFont,
                fontSize: 36,
                color: C.textSecondary,
                margin: 0,
                lineHeight: 1.5,
                fontWeight: 400,
              }}
            >
              3 hours writing cold emails.
              <br />
              Debugging a landing page.
              <br />
              12 leads ghosted you.
            </h3>
          </div>

          {/* Roles */}
          <div style={{ opacity: t4, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {roles.map((role, i) => (
              <div
                key={role}
                style={{
                  fontFamily: monoFont,
                  fontSize: 16,
                  color: C.accent,
                  fontWeight: 700,
                  border: `1px solid ${C.wire}`,
                  padding: "8px 16px",
                  letterSpacing: "0.1em",
                  opacity: interpolate(frame, [420 + i * 15, 440 + i * 15], [0, 1], {
                    extrapolateRight: "clamp",
                    extrapolateLeft: "clamp",
                  }),
                }}
              >
                {role}
              </div>
            ))}
          </div>

          {/* All at once */}
          <div style={{ opacity: t5 }}>
            <h2
              style={{
                fontFamily: sansFont,
                fontSize: 52,
                fontWeight: 800,
                color: C.textPrimary,
                margin: 0,
                textShadow: `0 0 40px rgba(120, 180, 255, 0.15)`,
              }}
            >
              All at once. Every day.
            </h2>
          </div>
        </div>
      </AbsoluteFill>
    </BlueprintBackground>
  );
};
