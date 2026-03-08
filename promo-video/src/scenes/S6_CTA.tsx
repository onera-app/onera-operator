import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { BlueprintBackground } from "../components/BlueprintBackground";
import { Crosshair, WirePanel, Annotation } from "../components/BlueprintElements";
import { serifFont, monoFont, sansFont } from "../fonts";
import { C } from "../colors";

export const S6_CTA = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const o1 = interpolate(frame, [15, 50], [0, 1], { extrapolateRight: "clamp" });
  const panelScale = spring({ frame: frame - 10, fps, config: { damping: 14 } });

  // Pulsing glow on the main text
  const glowPulse = 0.15 + Math.sin(frame * 0.06) * 0.1;

  return (
    <BlueprintBackground>
      <Crosshair x="50%" y="50%" size={900} rotation={frame * 0.03} opacity={0.04} />
      <Annotation text="scene_06 / call_to_action" x={60} y={40} opacity={0.3} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            opacity: o1,
            transform: `scale(${interpolate(panelScale, [0, 1], [0.9, 1])})`,
          }}
        >
          <WirePanel width={900} padding={80} glow>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 28,
              }}
            >
              {/* Main message */}
              <h2
                style={{
                  fontFamily: serifFont,
                  fontSize: 46,
                  color: C.textPrimary,
                  fontWeight: 600,
                  margin: 0,
                  textAlign: "center",
                  lineHeight: 1.3,
                }}
              >
                Stop doing the work of 5 people.
                <br />
                <span
                  style={{
                    color: C.accent,
                    textShadow: `0 0 40px rgba(120, 180, 255, ${glowPulse})`,
                  }}
                >
                  Let Onera Operator run your startup.
                </span>
              </h2>

              {/* Big brand name */}
              <h1
                style={{
                  fontFamily: sansFont,
                  fontWeight: 900,
                  fontSize: 140,
                  color: C.textPrimary,
                  margin: 0,
                  letterSpacing: "-0.04em",
                  textShadow: `0 0 80px rgba(120, 180, 255, 0.2)`,
                  marginTop: 16,
                }}
              >
                onera
              </h1>

              {/* Divider */}
              <div
                style={{
                  height: 1,
                  width: 200,
                  backgroundColor: C.wire,
                  margin: "12px 0",
                }}
              />

              {/* CTA details */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 22,
                    color: C.textPrimary,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  100 FREE CREDITS. NO CARD REQUIRED.
                </div>
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 18,
                    color: C.accent,
                    letterSpacing: "0.1em",
                  }}
                >
                  operator.onera.chat
                </div>
              </div>
            </div>
          </WirePanel>
        </div>
      </AbsoluteFill>
    </BlueprintBackground>
  );
};
