import { AbsoluteFill, useCurrentFrame, interpolate, useVideoConfig } from "remotion";
import { ProductBackground } from "../components/ProductBackground";
import { sansFont } from "../fonts";
import { C } from "../colors";

export const S2_BreakingPoint = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 4-second sequence — all keyframes fps-relative
  const f10 = Math.round(fps * 10 / 30);
  const f30 = Math.round(fps * 30 / 30);
  const f40 = Math.round(fps * 40 / 30);
  const f50 = Math.round(fps * 50 / 30);
  const totalFrames = Math.round(fps * 120 / 30); // 4s

  // 0-40: "INCONSISTENT"
  const p1Opacity = interpolate(frame, [0, f10, f30, f40], [0, 1, 1, 0], { extrapolateRight: "clamp" });

  // 40-end: "ONLY ONE."
  const p2Opacity = interpolate(frame, [f40, f50], [0, 1], { extrapolateRight: "clamp" });
  const p2Scale = interpolate(frame, [f40, totalFrames], [0.8, 1], { extrapolateRight: "clamp" });

  return (
    <ProductBackground>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>

        {/* Part 1: Inconsistent */}
        <div style={{
          position: "absolute",
          opacity: p1Opacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24
        }}>
          <h1 style={{ fontFamily: sansFont, fontSize: 180, fontWeight: 900, color: C.red, margin: 0, letterSpacing: "-0.04em" }}>
            INCONSISTENT.
          </h1>
          <h2 style={{ fontFamily: sansFont, fontSize: 40, color: C.textSecondary, margin: 0, fontWeight: 500 }}>
            Quality is dropping.
          </h2>
        </div>

        {/* Part 2: The real reason */}
        <div style={{
          position: "absolute",
          opacity: p2Opacity,
          transform: `scale(${p2Scale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
        }}>
          <h1 style={{ fontFamily: sansFont, fontSize: 120, fontWeight: 300, color: C.textSecondary, margin: 0, letterSpacing: "-0.04em", textAlign: "center", lineHeight: 1.1 }}>
            THERE IS ONLY
          </h1>
          <h1 style={{ fontFamily: sansFont, fontSize: 440, fontWeight: 900, color: C.primary, margin: 0, lineHeight: 0.8 }}>
            ONE.
          </h1>
        </div>

      </AbsoluteFill>
    </ProductBackground>
  );
};
