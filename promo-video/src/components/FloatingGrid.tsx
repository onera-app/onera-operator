import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { C } from "../colors";

/**
 * Blueprint-style grid that fades in with perspective tilt.
 * Gives depth and a tech/product feel without being distracting.
 */
export const FloatingGrid = ({
  delay = 0,
  opacity: maxOpacity = 0.5,
}: {
  delay?: number;
  opacity?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = Math.max(0, frame - delay);

  const fadeIn = interpolate(t, [0, fps * 1.2], [0, maxOpacity], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Slow upward drift
  const yOffset = interpolate(t, [0, fps * 30], [0, -40], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        perspective: 1200,
        overflow: "hidden",
        opacity: fadeIn,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: "140%",
          height: "200%",
          left: "-20%",
          top: "-20%",
          transform: `rotateX(55deg) translateY(${yOffset}px)`,
          transformOrigin: "50% 50%",
        }}
      >
        <svg width="100%" height="100%">
          <defs>
            <pattern
              id="perspGrid"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 80 0 L 0 0 0 80"
                fill="none"
                stroke={C.blueprintLine}
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#perspGrid)" />
        </svg>
      </div>

      {/* Bottom fade overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "50%",
          background: `linear-gradient(to top, ${C.darkBg}, transparent)`,
        }}
      />
    </AbsoluteFill>
  );
};
