import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../colors";
import { monoFont } from "../fonts";

/**
 * Dark blueprint background with animated grid lines, subtle glow vignette,
 * and dimension annotations along the edges.
 */
export const BlueprintBackground = ({ children }: { children?: React.ReactNode }) => {
  const frame = useCurrentFrame();
  // Subtle grid drift for life
  const offsetX = (frame * 0.15) % 40;
  const offsetY = (frame * 0.1) % 40;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        overflow: "hidden",
      }}
    >
      {/* Fine grid (40px) */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(${C.line} 1px, transparent 1px),
            linear-gradient(90deg, ${C.line} 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          backgroundPosition: `${offsetX}px ${offsetY}px`,
        }}
      />

      {/* Major grid (160px = every 4th line, brighter) */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(${C.lineStrong} 1px, transparent 1px),
            linear-gradient(90deg, ${C.lineStrong} 1px, transparent 1px)
          `,
          backgroundSize: "160px 160px",
          backgroundPosition: `${offsetX}px ${offsetY}px`,
        }}
      />

      {/* Center glow vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${C.bgGlow} 0%, transparent 100%)`,
          opacity: 0.4,
        }}
      />

      {/* Edge vignette (darker corners) */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, ${C.bgDark} 100%)`,
          opacity: 0.6,
        }}
      />

      {/* Dimension annotations along bottom edge */}
      <div style={{
        position: "absolute",
        bottom: 16,
        left: 40,
        right: 40,
        display: "flex",
        justifyContent: "space-between",
        fontFamily: monoFont,
        fontSize: 9,
        color: C.textMuted,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        pointerEvents: "none",
      }}>
        <span>0.00</span>
        <span>480.00</span>
        <span>960.00</span>
        <span>1440.00</span>
        <span>1920.00</span>
      </div>

      {/* Dimension annotations along left edge */}
      <div style={{
        position: "absolute",
        top: 40,
        left: 12,
        bottom: 40,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: monoFont,
        fontSize: 9,
        color: C.textMuted,
        letterSpacing: "0.15em",
        writingMode: "vertical-rl" as const,
        textOrientation: "mixed" as const,
        pointerEvents: "none",
      }}>
        <span>1080</span>
        <span>540</span>
        <span>0</span>
      </div>

      {children}
    </AbsoluteFill>
  );
};
