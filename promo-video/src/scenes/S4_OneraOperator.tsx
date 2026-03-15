import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { InfiniteGrid } from "../components/InfiniteGrid";
import { ProductBackground } from "../components/ProductBackground";
import { sansFont } from "../fonts";
import { C } from "../colors";

const AgentCard = ({ title, delay }: { title: string, delay: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // delay is passed in fps-relative frames already
  const scale = spring({ frame: frame - delay, fps, config: { damping: 14 } });

  if (frame < delay) return null;

  return (
    <div style={{
      transform: `scale(${scale})`,
      backgroundColor: "#fff",
      border: `1.5px solid ${C.border}`,
      borderRadius: 24,
      padding: "20px 40px",
      display: "flex",
      alignItems: "center",
      gap: 16,
      boxShadow: `0 20px 40px ${C.shadow}`
    }}>
      <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: C.primary }} />
      <div style={{ fontFamily: sansFont, fontWeight: 700, fontSize: 32, color: C.foreground }}>{title}</div>
    </div>
  );
};

export const S4_OneraOperator = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 5-second sequence — all keyframes fps-relative
  const f15 = Math.round(fps * 15 / 30);
  const totalFrames = Math.round(fps * 150 / 30); // 5s

  const titleOpacity = interpolate(frame, [0, f15], [0, 1], { extrapolateRight: "clamp" });
  const titleScale = interpolate(frame, [0, totalFrames], [0.9, 1], { extrapolateRight: "clamp" });

  // Agent card pop-in delays — scaled to fps
  const d1 = Math.round(fps * 30 / 30);
  const d2 = Math.round(fps * 45 / 30);
  const d3 = Math.round(fps * 60 / 30);
  const d4 = Math.round(fps * 75 / 30);

  return (
    <ProductBackground>
      <InfiniteGrid scrollSpeed={4} explosionFrame={-100} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 80, width: "100%" }}>

          <div style={{ opacity: titleOpacity, transform: `scale(${titleScale})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ fontFamily: sansFont, fontSize: 32, color: C.textSecondary, letterSpacing: "0.2em", fontWeight: 500 }}>
              MEET YOUR
            </div>
            <h1 style={{ fontFamily: sansFont, fontWeight: 900, fontSize: 180, color: C.primary, margin: 0, letterSpacing: "-0.04em" }}>
              AI COO.
            </h1>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 1000 }}>
            {/* Rapid fire pop-ins */}
            <AgentCard title="Research" delay={d1} />
            <AgentCard title="Outreach" delay={d2} />
            <AgentCard title="Social" delay={d3} />
            <AgentCard title="Engineer" delay={d4} />
          </div>

        </div>
      </AbsoluteFill>
    </ProductBackground>
  );
};
