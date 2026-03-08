import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { BlueprintBackground } from "../components/BlueprintBackground";
import { Crosshair, CornerMarks, WirePanel, Annotation } from "../components/BlueprintElements";
import { serifFont, sansFont, monoFont } from "../fonts";
import { C } from "../colors";

export const S2_BreakingPoint = () => {
  const frame = useCurrentFrame();

  const o1 = interpolate(frame, [30, 60], [0, 1], { extrapolateRight: "clamp" });
  const o2 = interpolate(frame, [150, 180], [0, 1], { extrapolateRight: "clamp" });
  const o3 = interpolate(frame, [280, 310], [0, 1], { extrapolateRight: "clamp" });
  const o4 = interpolate(frame, [420, 450], [0, 1], { extrapolateRight: "clamp" });

  // Warning line grows
  const lineWidth = interpolate(frame, [280, 380], [0, 100], { extrapolateRight: "clamp" });

  return (
    <BlueprintBackground>
      <Crosshair x="90%" y="10%" size={140} opacity={0.12} rotation={frame * 0.06} />
      <Annotation text="scene_02 / breaking_point" x={60} y={40} opacity={0.3} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <WirePanel width={1000} padding={80} glow>
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            {/* Inconsistent outreach */}
            <h2
              style={{
                opacity: o1,
                fontFamily: serifFont,
                fontSize: 46,
                color: C.textPrimary,
                margin: 0,
                lineHeight: 1.3,
                fontWeight: 600,
              }}
            >
              Your outreach is inconsistent.
              <br />
              <span style={{ color: C.orange }}>Some weeks 50 emails. Some weeks zero.</span>
            </h2>

            {/* Leads slipping */}
            <h2
              style={{
                opacity: o2,
                fontFamily: serifFont,
                fontSize: 38,
                color: C.textSecondary,
                margin: 0,
                lineHeight: 1.4,
                fontWeight: 400,
              }}
            >
              Leads slip through the cracks.
              <br />
              Twitter dead for 2 weeks.
            </h2>

            {/* Warning line */}
            <div
              style={{
                opacity: o3,
                height: 2,
                backgroundColor: C.orange,
                width: `${lineWidth}%`,
                boxShadow: `0 0 20px rgba(255, 138, 101, 0.4)`,
                transition: "width 0.3s",
              }}
            />

            {/* Root cause */}
            <div style={{ opacity: o4 }}>
              <div
                style={{
                  fontFamily: monoFont,
                  color: C.orange,
                  fontSize: 14,
                  marginBottom: 16,
                  letterSpacing: "0.2em",
                }}
              >
                [ ROOT_CAUSE_ANALYSIS ]
              </div>
              <h1
                style={{
                  fontFamily: sansFont,
                  fontSize: 52,
                  fontWeight: 800,
                  color: C.textPrimary,
                  margin: 0,
                  lineHeight: 1.15,
                }}
              >
                You're not failing because your idea is bad.
                <br />
                You're failing because there's{" "}
                <span
                  style={{
                    color: C.orange,
                    textShadow: `0 0 30px rgba(255, 138, 101, 0.3)`,
                  }}
                >
                  only one of you.
                </span>
              </h1>
            </div>
          </div>
        </WirePanel>
      </AbsoluteFill>
    </BlueprintBackground>
  );
};
