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
 * Scene 1 — Cinematic Logo Reveal (5s)
 *
 * Dark background with ambient gradient orbs drifting.
 * A horizontal line draws across center.
 * "onera" scales up from behind a glow.
 * Tagline and badge appear below.
 */
export const LogoReveal = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Horizontal line ---
  const lineProgress = interpolate(frame, [0.5 * fps, 1.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // --- Wordmark ---
  const logoOpacity = interpolate(frame, [0.8 * fps, 1.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const logoScale = interpolate(frame, [0.8 * fps, 1.6 * fps], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // --- Glow behind logo ---
  const glowOpacity = interpolate(frame, [0.3 * fps, 1.2 * fps], [0, 0.8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glowScale = interpolate(frame, [0.3 * fps, 2.5 * fps], [0.5, 1.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // --- Tagline ---
  const tagOpacity = interpolate(frame, [2.0 * fps, 2.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const tagY = interpolate(frame, [2.0 * fps, 2.8 * fps], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // --- Badge ---
  const badgeOpacity = interpolate(frame, [2.8 * fps, 3.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: C.darkBg }}>
      {/* Ambient orbs */}
      <GlowOrb color1={C.blueGlow} color2="transparent" size={800} x={35} y={40} delay={0} drift={20} />
      <GlowOrb color1={C.violetGlow} color2="transparent" size={500} x={65} y={55} delay={10} drift={15} />

      {/* Center glow behind logo */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "46%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.blueGlow} 0%, transparent 70%)`,
          transform: `translate(-50%, -50%) scale(${glowScale})`,
          opacity: glowOpacity,
          filter: "blur(60px)",
        }}
      />

      {/* Content */}
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
          }}
        >
          {/* Wordmark */}
          <div
            style={{
              fontFamily: sansFont,
              fontSize: 110,
              fontWeight: 700,
              color: C.white,
              letterSpacing: "-0.04em",
              opacity: logoOpacity,
              transform: `scale(${logoScale})`,
            }}
          >
            onera
          </div>

          {/* Line */}
          <div
            style={{
              width: lineProgress * 260,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${C.blueBright}, transparent)`,
              marginTop: 16,
              marginBottom: 20,
            }}
          />

          {/* Tagline */}
          <div
            style={{
              fontFamily: sansFont,
              fontSize: 22,
              fontWeight: 400,
              color: C.gray,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: tagOpacity,
              transform: `translateY(${tagY}px)`,
            }}
          >
            The Autonomous Startup Operator
          </div>

          {/* Badge pill */}
          <div
            style={{
              marginTop: 24,
              padding: "8px 20px",
              borderRadius: 100,
              border: `1px solid ${C.cardBorder}`,
              backgroundColor: C.cardBg,
              opacity: badgeOpacity,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: C.termGreen,
                boxShadow: `0 0 8px ${C.termGreen}`,
              }}
            />
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 12,
                color: C.dimWhite,
                letterSpacing: "0.04em",
              }}
            >
              Open Source AI Operator
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
