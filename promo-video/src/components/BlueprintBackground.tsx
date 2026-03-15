import { AbsoluteFill } from "remotion";
import { C } from "../colors";
import { monoFont } from "../fonts";

/**
 * OneraOS Light Blueprint Background
 * Subtle Lavender-White paper with Royal Blue "ink" grid lines
 * and dimension annotations along the edges.
 */
export const BlueprintBackground = ({ children }: { children?: React.ReactNode }) => {
  // Grid line colors — subtle Royal Blue tinted lines
  const fineLineColor = "rgba(0, 51, 204, 0.05)";
  const majorLineColor = "rgba(0, 51, 204, 0.1)";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        overflow: "hidden",
      }}
    >
      {/* Fine grid (60px) — static */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(${fineLineColor} 1px, transparent 1px),
            linear-gradient(90deg, ${fineLineColor} 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Major grid (240px = every 4th line) — slightly brighter */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(${majorLineColor} 1px, transparent 1px),
            linear-gradient(90deg, ${majorLineColor} 1px, transparent 1px)
          `,
          backgroundSize: "240px 240px",
        }}
      />

      {/* Blueprint vignette — subtle paper feel */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(0, 51, 204, 0.02) 100%)`,
          pointerEvents: "none",
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
        opacity: 0.6,
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
        opacity: 0.6,
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
