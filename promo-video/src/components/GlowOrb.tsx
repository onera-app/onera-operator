import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

/**
 * Animated glowing gradient orb that drifts and pulses.
 * Used as ambient background motion graphic.
 */
export const GlowOrb = ({
  color1,
  color2,
  size = 600,
  x = 50,
  y = 50,
  delay = 0,
  drift = 30,
  pulseSpeed = 3,
}: {
  color1: string;
  color2: string;
  size?: number;
  x?: number; // percentage
  y?: number; // percentage
  delay?: number; // frames
  drift?: number; // px of movement
  pulseSpeed?: number; // seconds per pulse cycle
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = Math.max(0, frame - delay);
  const cycleFrames = pulseSpeed * fps;

  // Gentle drift
  const driftX = Math.sin((t / cycleFrames) * Math.PI * 2) * drift;
  const driftY = Math.cos((t / cycleFrames) * Math.PI * 2 * 0.7) * drift * 0.6;

  // Pulse scale
  const pulse = 1 + Math.sin((t / cycleFrames) * Math.PI * 2) * 0.08;

  // Fade in
  const opacity = interpolate(t, [0, fps * 0.8], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color1} 0%, ${color2} 40%, transparent 70%)`,
        filter: `blur(${size * 0.3}px)`,
        transform: `translate(-50%, -50%) translate(${driftX}px, ${driftY}px) scale(${pulse})`,
        opacity: opacity * 0.6,
        pointerEvents: "none" as const,
      }}
    />
  );
};
