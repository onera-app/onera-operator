import { C } from "../colors";
import { monoFont } from "../fonts";

/**
 * Corner registration marks — Royal Blue L-brackets.
 */
export const CornerMarks = ({ color = C.primary, size = 14, thickness = 2 }: { color?: string; size?: number; thickness?: number }) => (
  <>
    <div style={{ position: "absolute", top: -1, left: -1, width: size, height: size, borderTop: `${thickness}px solid ${color}`, borderLeft: `${thickness}px solid ${color}`, pointerEvents: "none" }} />
    <div style={{ position: "absolute", bottom: -1, right: -1, width: size, height: size, borderBottom: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}`, pointerEvents: "none" }} />
    <div style={{ position: "absolute", top: -1, right: -1, width: size, height: size, borderTop: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}`, pointerEvents: "none" }} />
    <div style={{ position: "absolute", bottom: -1, left: -1, width: size, height: size, borderBottom: `${thickness}px solid ${color}`, borderLeft: `${thickness}px solid ${color}`, pointerEvents: "none" }} />
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
  color = C.primary,
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
    <div style={{ width: 24, height: 1, backgroundColor: C.primary }} />
    <span style={{ fontFamily: monoFont, fontSize: 10, color: C.textMuted, letterSpacing: "0.15em", textTransform: "uppercase", whiteSpace: "nowrap", fontWeight: "bold" }}>
      {text}
    </span>
  </div>
);

/**
 * Blueprint panel — a schematic box with corner marks.
 */
export const WirePanel = ({
  children,
  width,
  padding = 32,
  style,
}: {
  children: React.ReactNode;
  width?: number | string;
  padding?: number;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      border: `2px solid ${C.primary}`,
      backgroundColor: "white",
      padding,
      position: "relative",
      ...(width ? { width } : {}),
      boxShadow: "0 4px 12px rgba(0, 51, 204, 0.05)",
      ...style,
    }}
  >
    <CornerMarks color={C.primary} />
    {children}
  </div>
);
