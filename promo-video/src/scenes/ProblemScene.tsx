import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { C } from "../colors";
import { sansFont } from "../fonts";
import { GlowOrb } from "../components/GlowOrb";

/**
 * Scene 2 — The Problem (5s)
 *
 * Roles cycle in rapidly with a staggered wipe effect,
 * stacking up to show the founder wears every hat.
 * Then the kicker line lands hard.
 * Background has subtle warm-toned orbs (problem = warm/red tones).
 */

const ROLES = [
  "The CEO",
  "The marketer",
  "The SDR",
  "The content writer",
  "The data analyst",
  "The growth hacker",
];

export const ProblemScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "You're wearing every hat." headline
  const headOpacity = interpolate(frame, [0.2 * fps, 0.9 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const headY = interpolate(frame, [0.2 * fps, 0.9 * fps], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Kicker
  const kickerStart = 3.2 * fps;
  const kickerOpacity = interpolate(frame, [kickerStart, kickerStart + 0.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const kickerY = interpolate(frame, [kickerStart, kickerStart + 0.6 * fps], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: C.darkBg }}>
      {/* Warm ambient orbs */}
      <GlowOrb color1="rgba(239, 68, 68, 0.15)" color2="transparent" size={600} x={25} y={50} delay={0} />
      <GlowOrb color1="rgba(245, 158, 11, 0.1)" color2="transparent" size={500} x={75} y={40} delay={15} />

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
            gap: 40,
          }}
        >
          {/* Headline */}
          <div
            style={{
              fontFamily: sansFont,
              fontSize: 52,
              fontWeight: 300,
              color: C.dimWhite,
              opacity: headOpacity,
              transform: `translateY(${headY}px)`,
            }}
          >
            You&apos;re wearing every hat.
          </div>

          {/* Role grid — staggered entrance */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 12,
              maxWidth: 900,
            }}
          >
            {ROLES.map((role, i) => {
              const roleStart = (0.8 + i * 0.28) * fps;
              const roleOpacity = interpolate(frame, [roleStart, roleStart + 0.4 * fps], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.quad),
              });
              const roleScale = interpolate(frame, [roleStart, roleStart + 0.4 * fps], [0.85, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.quad),
              });

              return (
                <div
                  key={i}
                  style={{
                    fontFamily: sansFont,
                    fontSize: 28,
                    fontWeight: 500,
                    color: C.white,
                    padding: "12px 28px",
                    borderRadius: 12,
                    border: `1px solid ${C.faintWhite}`,
                    backgroundColor: C.cardBg,
                    opacity: roleOpacity,
                    transform: `scale(${roleScale})`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {role}
                </div>
              );
            })}
          </div>

          {/* Kicker line */}
          <div
            style={{
              fontFamily: sansFont,
              fontSize: 44,
              fontWeight: 600,
              color: C.white,
              opacity: kickerOpacity,
              transform: `translateY(${kickerY}px)`,
            }}
          >
            None of it scales.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
