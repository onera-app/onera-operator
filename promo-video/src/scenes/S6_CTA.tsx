import { AbsoluteFill, useCurrentFrame, interpolate, useVideoConfig } from "remotion";
import { ProductBackground } from "../components/ProductBackground";
import { sansFont } from "../fonts";
import { C } from "../colors";

export const S6_CTA = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 5-second sequence — all keyframes fps-relative
  const f15 = Math.round(fps * 15 / 30);
  const totalFrames = Math.round(fps * 150 / 30); // 5s

  const o1 = interpolate(frame, [0, f15], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, totalFrames], [0.95, 1], { extrapolateRight: "clamp" });

  return (
    <ProductBackground>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            opacity: o1,
            transform: `scale(${scale})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div style={{ fontFamily: sansFont, fontSize: 32, color: C.textSecondary, letterSpacing: "0.2em", fontWeight: 500, marginBottom: 16 }}>
             THE OPERATING SYSTEM FOR
          </div>
          <h1 style={{
            fontFamily: sansFont,
            fontWeight: 900,
            fontSize: 220,
            color: C.primary,
            margin: 0,
            letterSpacing: "-0.04em",
            textAlign: "center",
            lineHeight: 0.9
          }}>
            ONERA.
          </h1>

          <div style={{ height: 8, width: 240, backgroundColor: C.primary, margin: "40px 0" }} />

          <div style={{
            fontFamily: sansFont,
            fontSize: 48,
            color: C.foreground,
            fontWeight: 300,
            letterSpacing: "-0.01em"
          }}>
            Scale without the grind.
          </div>

          <div style={{
            marginTop: 60,
            fontFamily: sansFont,
            fontSize: 24,
            color: "#fff",
            letterSpacing: "0.05em",
            fontWeight: 700,
            backgroundColor: C.primary,
            padding: "20px 48px",
            borderRadius: 40,
            boxShadow: `0 20px 40px ${C.shadow}`
          }}>
            Get Started
          </div>
        </div>
      </AbsoluteFill>
    </ProductBackground>
  );
};
