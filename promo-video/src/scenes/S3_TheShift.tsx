import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { BlueprintBackground } from "../components/BlueprintBackground";
import { Crosshair, WirePanel, Annotation } from "../components/BlueprintElements";
import { serifFont, sansFont } from "../fonts";
import { C } from "../colors";

export const S3_TheShift = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t1 = interpolate(frame, [15, 50], [0, 1], { extrapolateRight: "clamp" });
  const t2 = interpolate(frame, [150, 185], [0, 1], { extrapolateRight: "clamp" });
  const t3 = interpolate(frame, [300, 340], [0, 1], { extrapolateRight: "clamp" });

  const panelScale = spring({ frame: frame - 10, fps, config: { damping: 16 } });
  const operatorGlow = interpolate(frame, [300, 400], [0, 1], { extrapolateRight: "clamp" });

  // Crosshair orbits slowly around center
  const cx = 50 + Math.sin(frame * 0.008) * 15;
  const cy = 50 + Math.cos(frame * 0.008) * 10;

  return (
    <BlueprintBackground>
      <Crosshair x={`${cx}%`} y={`${cy}%`} size={500} rotation={frame * 0.03} opacity={0.06} />
      <Annotation text="scene_03 / the_shift" x={60} y={40} opacity={0.3} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            transform: `scale(${interpolate(panelScale, [0, 1], [0.92, 1])})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 32,
          }}
        >
          <WirePanel width={900} padding={64} glow>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
              {/* Question */}
              <h1
                style={{
                  opacity: t1,
                  fontFamily: serifFont,
                  fontSize: 60,
                  color: C.textPrimary,
                  margin: 0,
                  textAlign: "center",
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                What if you had an AI that
                <br />
                actually did the work?
              </h1>

              {/* Not a chatbot */}
              <h2
                style={{
                  opacity: t2,
                  fontFamily: sansFont,
                  fontWeight: 600,
                  fontSize: 36,
                  color: C.textMuted,
                  margin: 0,
                  textAlign: "center",
                }}
              >
                Not a chatbot. Not a template.
              </h2>

              {/* AN OPERATOR */}
              <h1
                style={{
                  opacity: t3,
                  fontFamily: sansFont,
                  fontWeight: 900,
                  fontSize: 88,
                  color: C.accent,
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  textShadow: `0 0 60px rgba(120, 180, 255, ${operatorGlow * 0.4})`,
                  textAlign: "center",
                }}
              >
                An Operator.
              </h1>
            </div>
          </WirePanel>
        </div>
      </AbsoluteFill>
    </BlueprintBackground>
  );
};
