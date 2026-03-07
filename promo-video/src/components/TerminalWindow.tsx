import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { C } from "../colors";
import { monoFont } from "../fonts";

type TermLine = {
  prefix: string;
  prefixColor: string;
  text: string;
  delay: number; // seconds from scene start
};

/**
 * Simulated terminal / live-feed window with typing animation.
 * Mimics the product's actual terminal bar.
 */
export const TerminalWindow = ({
  lines,
  delay = 0,
  width = 900,
}: {
  lines: TermLine[];
  delay?: number; // frames
  width?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = Math.max(0, frame - delay);

  // Window entrance
  const windowOpacity = interpolate(t, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const windowY = interpolate(t, [0, fps * 0.5], [30, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <div
      style={{
        width,
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${C.cardBorder}`,
        backgroundColor: C.termBg,
        opacity: windowOpacity,
        transform: `translateY(${windowY}px)`,
        boxShadow: `0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px ${C.blueGlow}`,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          borderBottom: `1px solid ${C.cardBorder}`,
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#FF5F56" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#FFBD2E" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#27C93F" }} />
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: monoFont,
            fontSize: 12,
            color: C.dimWhite,
          }}
        >
          onera operator
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "16px 20px", minHeight: 200 }}>
        {lines.map((line, i) => {
          const lineT = t - line.delay * fps;
          if (lineT < 0) return null;

          // Typing effect
          const charsVisible = Math.floor(
            interpolate(lineT, [0, fps * 0.6], [0, line.text.length], {
              extrapolateRight: "clamp",
            })
          );
          const lineOpacity = interpolate(lineT, [0, fps * 0.15], [0, 1], {
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                fontFamily: monoFont,
                fontSize: 14,
                lineHeight: 1.8,
                opacity: lineOpacity,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ color: line.prefixColor }}>{line.prefix}</span>
              <span style={{ color: C.termText }}>
                {line.text.slice(0, charsVisible)}
              </span>
              {charsVisible < line.text.length && (
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 16,
                    backgroundColor: C.termCyan,
                    marginLeft: 2,
                    opacity: Math.sin(lineT * 0.3) > 0 ? 1 : 0,
                    verticalAlign: "middle",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
