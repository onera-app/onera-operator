import { C } from "../colors";
import { monoFont } from "../fonts";

/**
 * Corner registration marks — white/cyan L-brackets on dark blueprint.
 */
export const CornerMarks = ({ color = C.wire, size = 14, thickness = 2 }: { color?: string; size?: number; thickness?: number }) => (
  <>
    <div style={{ position: "absolute", top: -1, left: -1, width: size, height: size, borderTop: `${thickness}px solid ${color}`, borderLeft: `${thickness}px solid ${color}` }} />
    <div style={{ position: "absolute", bottom: -1, right: -1, width: size, height: size, borderBottom: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}` }} />
    <div style={{ position: "absolute", top: -1, right: -1, width: size, height: size, borderTop: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}` }} />
    <div style={{ position: "absolute", bottom: -1, left: -1, width: size, height: size, borderBottom: `${thickness}px solid ${color}`, borderLeft: `${thickness}px solid ${color}` }} />
  </>
);

/**
 * Crosshair — technical targeting reticle for blueprint aesthetic.
 */
export const Crosshair = ({
  x,
  y,
  size = 80,
  rotation = 0,
  opacity = 0.2,
  color = C.wire,
}: {
  x: number | string;
  y: number | string;
  size?: number;
  rotation?: number;
  opacity?: number;
  color?: string;
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: size,
      height: size,
      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      opacity,
      pointerEvents: "none",
    }}
  >
    <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, backgroundColor: color }} />
    <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, backgroundColor: color }} />
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: size * 0.5,
        height: size * 0.5,
        border: `1px solid ${color}`,
        borderRadius: "50%",
        transform: "translate(-50%, -50%)",
      }}
    />
    {/* Tick marks */}
    <div style={{ position: "absolute", top: 0, left: "50%", width: 1, height: 6, backgroundColor: color, transform: "translateX(-0.5px)" }} />
    <div style={{ position: "absolute", bottom: 0, left: "50%", width: 1, height: 6, backgroundColor: color, transform: "translateX(-0.5px)" }} />
    <div style={{ position: "absolute", left: 0, top: "50%", height: 1, width: 6, backgroundColor: color, transform: "translateY(-0.5px)" }} />
    <div style={{ position: "absolute", right: 0, top: "50%", height: 1, width: 6, backgroundColor: color, transform: "translateY(-0.5px)" }} />
  </div>
);

/**
 * Blueprint annotation label — mono text with a small line connector.
 */
export const Annotation = ({
  text,
  x,
  y,
  anchor = "left",
  opacity = 1,
}: {
  text: string;
  x: string | number;
  y: string | number;
  anchor?: "left" | "right";
  opacity?: number;
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      opacity,
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexDirection: anchor === "right" ? "row-reverse" : "row",
      pointerEvents: "none",
    }}
  >
    <div style={{ width: 24, height: 1, backgroundColor: C.wire }} />
    <span style={{ fontFamily: monoFont, fontSize: 10, color: C.textMuted, letterSpacing: "0.15em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {text}
    </span>
  </div>
);

/**
 * Blueprint panel — a wireframe box with corner marks, used to group content.
 */
export const WirePanel = ({
  children,
  width,
  padding = 32,
  glow = false,
  style,
}: {
  children: React.ReactNode;
  width?: number | string;
  padding?: number;
  glow?: boolean;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      border: `1px solid ${glow ? C.wireGlow : C.wire}`,
      backgroundColor: glow ? "rgba(120, 180, 255, 0.05)" : "rgba(255, 255, 255, 0.02)",
      padding,
      position: "relative",
      ...(width ? { width } : {}),
      ...(glow ? { boxShadow: `0 0 40px rgba(120, 180, 255, 0.1), inset 0 0 40px rgba(120, 180, 255, 0.03)` } : {}),
      ...style,
    }}
  >
    <CornerMarks color={glow ? C.wireGlow : C.wire} />
    {children}
  </div>
);
