import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { C } from "../colors";
import { sansFont } from "../fonts";
import { DashboardMock } from "../components/DashboardMock";
import { GlowOrb } from "../components/GlowOrb";

/**
 * Scene 4 — Product Showcase (7s)
 *
 * The dashboard UI floats up from below with a perspective tilt,
 * rotating slightly to show depth. Ambient glow behind it.
 * A label reads "Your AI command center."
 * The dashboard populates with live data as the scene plays.
 */
export const ProductScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Label
  const labelOpacity = interpolate(frame, [0.2 * fps, 0.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Dashboard entrance — floats up with slight 3D tilt
  const dashProgress = interpolate(frame, [0.5 * fps, 1.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const dashY = interpolate(dashProgress, [0, 1], [80, 0]);
  const dashRotateX = interpolate(dashProgress, [0, 1], [8, 2]);

  // Slow zoom in over time
  const dashScale = interpolate(frame, [1.5 * fps, 6.5 * fps], [0.82, 0.88], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: C.darkBg }}>
      {/* Ambient glow */}
      <GlowOrb color1={C.blueGlow} color2="transparent" size={900} x={50} y={55} delay={0} drift={8} />
      <GlowOrb color1={C.violetGlow} color2="transparent" size={400} x={20} y={40} delay={15} drift={10} />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          perspective: 1200,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
          }}
        >
          {/* Label */}
          <div
            style={{
              fontFamily: sansFont,
              fontSize: 18,
              fontWeight: 500,
              color: C.blueBright,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              opacity: labelOpacity,
            }}
          >
            Your AI Command Center
          </div>

          {/* Dashboard with 3D tilt */}
          <div
            style={{
              transform: `translateY(${dashY}px) rotateX(${dashRotateX}deg) scale(${dashScale})`,
              transformStyle: "preserve-3d",
              opacity: dashProgress,
            }}
          >
            <DashboardMock delay={Math.round(0.5 * fps)} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
