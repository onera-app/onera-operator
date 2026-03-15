import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { ProductBackground } from "../components/ProductBackground";
import { DashboardMock } from "../components/DashboardMock";

export const S5_Dashboard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 7-second sequence — all keyframes fps-relative
  const f10 = Math.round(fps * 10 / 30);
  const totalFrames = Math.round(fps * 210 / 30); // 7s

  const dashboardY = spring({ frame: frame - f10, fps, config: { damping: 14 } });

  // Slow zoom out to show full dashboard
  const scale = interpolate(frame, [0, totalFrames], [0.95, 0.85], { extrapolateRight: "clamp" });

  return (
    <ProductBackground>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>

        <div style={{
          transform: `translateY(${interpolate(dashboardY, [0, 1], [400, 0])}px) scale(${scale})`,
          transformOrigin: "center center",
        }}>
          <DashboardMock />
        </div>

      </AbsoluteFill>
    </ProductBackground>
  );
};
