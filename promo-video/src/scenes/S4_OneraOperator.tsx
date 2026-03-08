import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { BlueprintBackground } from "../components/BlueprintBackground";
import { CornerMarks, Crosshair, Annotation } from "../components/BlueprintElements";
import { serifFont, sansFont, monoFont } from "../fonts";
import { C } from "../colors";

const AgentCard = ({
  title,
  role,
  icon,
  delay,
}: {
  title: string;
  role: string;
  icon: string;
  delay: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 80 } });

  if (frame < delay - 5) return null;

  return (
    <div
      style={{
        transform: `scale(${enter}) translateY(${interpolate(enter, [0, 1], [30, 0])}px)`,
        opacity: enter,
        border: `1px solid ${C.wire}`,
        backgroundColor: "rgba(120, 180, 255, 0.04)",
        padding: "28px 24px",
        width: 260,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <CornerMarks color={C.wire} size={10} />

      {/* Icon + Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 36,
            height: 36,
            border: `1px solid ${C.wire}`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: 18,
          }}
        >
          {icon}
        </div>
        <div
          style={{
            fontFamily: sansFont,
            fontWeight: 700,
            fontSize: 18,
            color: C.textPrimary,
          }}
        >
          {title}
        </div>
      </div>

      {/* Role label */}
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 11,
          color: C.accent,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          borderTop: `1px solid ${C.wireDim}`,
          paddingTop: 12,
        }}
      >
        [ {role} ]
      </div>
    </div>
  );
};

export const S4_OneraOperator = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [15, 50], [0, 1], { extrapolateRight: "clamp" });
  const titleY = spring({ frame: frame - 10, fps, config: { damping: 14 } });

  return (
    <BlueprintBackground>
      <Crosshair x="50%" y="50%" size={600} rotation={frame * 0.02} opacity={0.04} />
      <Annotation text="scene_04 / onera_operator" x={60} y={40} opacity={0.3} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 60,
            width: "100%",
          }}
        >
          {/* Title block */}
          <div
            style={{
              opacity: titleOpacity,
              transform: `translateY(${interpolate(titleY, [0, 1], [40, 0])}px)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <h1
              style={{
                fontFamily: sansFont,
                fontWeight: 900,
                fontSize: 110,
                color: C.textPrimary,
                margin: 0,
                letterSpacing: "-0.03em",
                textShadow: `0 0 80px rgba(120, 180, 255, 0.2)`,
              }}
            >
              Onera Operator
            </h1>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 22,
                color: C.accent,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Your AI COO
            </div>
          </div>

          {/* Agent cards row */}
          <div
            style={{
              display: "flex",
              gap: 28,
              flexWrap: "wrap",
              justifyContent: "center",
              maxWidth: 1400,
            }}
          >
            <AgentCard title="Research" role="Finds Leads & Markets" icon="🔍" delay={150} />
            <AgentCard title="Outreach" role="Writes & Sends Email" icon="📧" delay={210} />
            <AgentCard title="Twitter" role="Posts Content Daily" icon="🐦" delay={270} />
            <AgentCard title="Engineer" role="Builds Code & Tools" icon="⚡" delay={330} />
          </div>
        </div>
      </AbsoluteFill>
    </BlueprintBackground>
  );
};
