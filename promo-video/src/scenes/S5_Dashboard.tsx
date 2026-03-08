import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { BlueprintBackground } from "../components/BlueprintBackground";
import { DashboardMock } from "../components/DashboardMock";
import { Annotation } from "../components/BlueprintElements";
import { sansFont, monoFont } from "../fonts";
import { C } from "../colors";

export const S5_Dashboard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const dashboardY = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  const textOpacity = interpolate(frame, [60, 90], [0, 1], { extrapolateRight: "clamp" });

  return (
    <BlueprintBackground>
      <Annotation text="scene_05 / dashboard" x={60} y={40} opacity={0.3} />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 32,
        }}
      >
        {/* Title */}
        <div
          style={{
            opacity: textOpacity,
            fontFamily: sansFont,
            fontWeight: 700,
            fontSize: 40,
            color: C.textPrimary,
            textAlign: "center",
            textShadow: `0 0 40px rgba(120, 180, 255, 0.2)`,
          }}
        >
          Wake up to everything done.
        </div>

        {/* Dashboard mock */}
        <div
          style={{
            transform: `translateY(${interpolate(dashboardY, [0, 1], [300, 0])}px) scale(0.92)`,
            transformOrigin: "center top",
          }}
        >
          <DashboardMock />
        </div>
      </AbsoluteFill>
    </BlueprintBackground>
  );
};
