import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { InfiniteGrid } from "../components/InfiniteGrid";
import { ProductBackground } from "../components/ProductBackground";
import { sansFont } from "../fonts";
import { C } from "../colors";

export const S3_TheShift = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 4-second sequence — all keyframes fps-relative
  const f10 = Math.round(fps * 10 / 30);
  const f40 = Math.round(fps * 40 / 30);
  const f50 = Math.round(fps * 50 / 30);
  const f60 = Math.round(fps * 60 / 30);

  const explosionFrame = 0;

  // 0-50: "Not a chatbot."
  const t1 = interpolate(frame, [0, f10, f40, f50], [0, 1, 1, 0], { extrapolateRight: "clamp" });

  // 50-120: "AN OPERATOR."
  const t2 = interpolate(frame, [f50, f60], [0, 1], { extrapolateRight: "clamp" });
  const scale2 = spring({ frame: frame - f50, fps, config: { damping: 14 } });

  return (
    <ProductBackground>
      <InfiniteGrid scrollSpeed={4} explosionFrame={explosionFrame} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>

        {/* Not a chatbot */}
        <div style={{
          position: "absolute",
          opacity: t1,
        }}>
          <h1 style={{ fontFamily: sansFont, fontSize: 140, fontWeight: 800, color: C.foreground, margin: 0, letterSpacing: "-0.04em" }}>
            Not a chatbot.
          </h1>
        </div>

        {/* An Operator */}
        <div style={{
          position: "absolute",
          opacity: t2,
          transform: `scale(${scale2})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}>
          <h1 style={{ fontFamily: sansFont, fontSize: 180, fontWeight: 900, color: C.primary, margin: 0, letterSpacing: "-0.04em", textTransform: "uppercase" }}>
            AN OPERATOR.
          </h1>
          <div style={{ width: 160, height: 8, backgroundColor: C.primary, marginTop: 40 }} />
        </div>

      </AbsoluteFill>
    </ProductBackground>
  );
};
