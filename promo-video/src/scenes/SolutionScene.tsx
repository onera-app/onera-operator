import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { C } from "../colors";
import { sansFont, monoFont } from "../fonts";
import { GlowOrb } from "../components/GlowOrb";

/**
 * Scene 3 — The Solution Reveal (5s)
 *
 * "What if it ran itself?"
 * Then "onera" appears big with a blue glow surge.
 * Below: a row of agent labels lights up one by one.
 * Clean, confident, product-focused.
 */

const AGENTS = [
  { name: "Planner", color: C.blueBright },
  { name: "Outreach", color: C.violet },
  { name: "Twitter", color: C.termCyan },
  { name: "Research", color: C.amber },
  { name: "Engineer", color: C.cyan },
];

export const SolutionScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Hook question
  const hookOpacity = interpolate(frame, [0.2 * fps, 0.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const hookDim = interpolate(frame, [1.8 * fps, 2.2 * fps], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const hookY = interpolate(frame, [0.2 * fps, 0.8 * fps], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Brand reveal
  const brandOpacity = interpolate(frame, [2.0 * fps, 2.7 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const brandScale = interpolate(frame, [2.0 * fps, 2.7 * fps], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Glow surge
  const glowIntensity = interpolate(frame, [1.8 * fps, 2.5 * fps, 3.5 * fps], [0, 1, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtitle
  const subOpacity = interpolate(frame, [3.0 * fps, 3.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const subY = interpolate(frame, [3.0 * fps, 3.6 * fps], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: C.darkBg }}>
      {/* Ambient orbs */}
      <GlowOrb color1={C.blueGlow} color2="transparent" size={700} x={50} y={45} delay={Math.round(1.5 * fps)} drift={10} />
      <GlowOrb color1={C.violetGlow} color2="transparent" size={400} x={30} y={55} delay={Math.round(2.0 * fps)} drift={12} />

      {/* Center glow surge */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "40%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.blue} 0%, transparent 60%)`,
          transform: "translate(-50%, -50%)",
          opacity: glowIntensity * 0.35,
          filter: "blur(80px)",
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
            position: "relative",
          }}
        >
          {/* Hook question */}
          <div
            style={{
              fontFamily: sansFont,
              fontSize: 52,
              fontWeight: 300,
              color: C.white,
              opacity: hookOpacity * hookDim,
              transform: `translateY(${hookY}px)`,
              position: "absolute",
              top: "50%",
              left: "50%",
              whiteSpace: "nowrap",
              transform: `translate(-50%, -50%) translateY(${hookY}px)`,
            }}
          >
            What if it ran itself?
          </div>

          {/* Brand name */}
          <div
            style={{
              fontFamily: sansFont,
              fontSize: 120,
              fontWeight: 700,
              color: C.white,
              letterSpacing: "-0.04em",
              opacity: brandOpacity,
              transform: `scale(${brandScale})`,
            }}
          >
            onera
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontFamily: sansFont,
              fontSize: 24,
              fontWeight: 400,
              color: C.gray,
              textAlign: "center",
              maxWidth: 600,
              lineHeight: 1.5,
              marginTop: 20,
              opacity: subOpacity,
              transform: `translateY(${subY}px)`,
            }}
          >
            Autonomous AI agents that run your startup&apos;s
            <br />
            growth, outreach, social, and research.
          </div>

          {/* Agent pills */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 36,
            }}
          >
            {AGENTS.map((agent, i) => {
              const pillStart = (3.4 + i * 0.2) * fps;
              const pillOpacity = interpolate(frame, [pillStart, pillStart + 0.3 * fps], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.quad),
              });
              const pillScale = interpolate(frame, [pillStart, pillStart + 0.3 * fps], [0.8, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.quad),
              });

              return (
                <div
                  key={i}
                  style={{
                    fontFamily: monoFont,
                    fontSize: 13,
                    fontWeight: 500,
                    color: agent.color,
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: `1px solid ${agent.color}30`,
                    backgroundColor: `${agent.color}10`,
                    opacity: pillOpacity,
                    transform: `scale(${pillScale})`,
                    letterSpacing: "0.02em",
                  }}
                >
                  {agent.name}
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
