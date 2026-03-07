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
 * Scene 7 — CTA Close (5s)
 *
 * "Start operating smarter."
 * URL in brand blue.
 * Bottom: handle + email, subtle.
 * Big ambient glow behind everything — confident, warm close.
 */
export const CTAScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Headline
  const headOpacity = interpolate(frame, [0.3 * fps, 1.0 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const headScale = interpolate(frame, [0.3 * fps, 1.0 * fps], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // URL pill
  const urlOpacity = interpolate(frame, [1.4 * fps, 2.0 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const urlY = interpolate(frame, [1.4 * fps, 2.0 * fps], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Tagline
  const tagOpacity = interpolate(frame, [2.2 * fps, 2.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Bottom
  const bottomOpacity = interpolate(frame, [3.0 * fps, 3.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Pulsing glow on URL pill
  const pulse = 0.7 + Math.sin(frame * 0.08) * 0.3;

  return (
    <AbsoluteFill style={{ backgroundColor: C.darkBg }}>
      {/* Big ambient glow */}
      <GlowOrb color1={C.blueGlow} color2="transparent" size={1000} x={50} y={45} delay={0} drift={6} />
      <GlowOrb color1={C.violetGlow} color2="transparent" size={500} x={65} y={60} delay={10} drift={10} />

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
            gap: 28,
          }}
        >
          {/* Headline */}
          <div
            style={{
              fontFamily: sansFont,
              fontSize: 68,
              fontWeight: 700,
              color: C.white,
              textAlign: "center",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              opacity: headOpacity,
              transform: `scale(${headScale})`,
            }}
          >
            Start operating smarter.
          </div>

          {/* URL pill */}
          <div
            style={{
              padding: "14px 40px",
              borderRadius: 100,
              backgroundColor: C.blue,
              opacity: urlOpacity,
              transform: `translateY(${urlY}px)`,
              boxShadow: `0 0 ${40 * pulse}px ${C.blueGlow}`,
            }}
          >
            <div
              style={{
                fontFamily: sansFont,
                fontSize: 22,
                fontWeight: 600,
                color: C.white,
                letterSpacing: "0.01em",
              }}
            >
              operator.onera.chat
            </div>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontFamily: sansFont,
              fontSize: 18,
              fontWeight: 400,
              color: C.gray,
              letterSpacing: "0.04em",
              opacity: tagOpacity,
            }}
          >
            Your AI-powered growth team. Always on.
          </div>
        </div>
      </AbsoluteFill>

      {/* Bottom info */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 40,
          opacity: bottomOpacity,
        }}
      >
        <div style={{ fontFamily: monoFont, fontSize: 13, color: C.gray }}>
          @onerachat
        </div>
        <div style={{ fontFamily: monoFont, fontSize: 13, color: C.gray }}>
          contact@onera.chat
        </div>
      </div>
    </AbsoluteFill>
  );
};
