import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Sequence,
} from "remotion";
import { C } from "../colors";
import { sansFont, monoFont } from "../fonts";

/**
 * Scene 6 — Feature Beats (8s, 4 x 2s)
 *
 * Each capability gets a dramatic reveal:
 * Big number/stat on the left, feature description on the right.
 * Animated counter for the stat. Clean two-column layout.
 * No cards — just typography and a subtle colored accent line.
 */

type Feature = {
  stat: string;
  statLabel: string;
  title: string;
  description: string;
  accentColor: string;
};

const FEATURES: Feature[] = [
  {
    stat: "20+",
    statLabel: "leads per run",
    title: "Cold Outreach on Autopilot",
    description: "Finds leads, writes personalized emails, and sends them. Every single day.",
    accentColor: C.violet,
  },
  {
    stat: "24/7",
    statLabel: "content pipeline",
    title: "Social That Never Stops",
    description: "Writes, schedules, and posts on-brand content to Twitter. Zero effort.",
    accentColor: C.termCyan,
  },
  {
    stat: "Live",
    statLabel: "market intel",
    title: "Competitive Research in Real Time",
    description: "Monitors competitors, pricing changes, feature launches, and market shifts.",
    accentColor: C.amber,
  },
  {
    stat: "1-Click",
    statLabel: "orchestration",
    title: "One Command Runs Everything",
    description: "The Planner coordinates all agents. Prioritizes what matters. You just watch.",
    accentColor: C.blueBright,
  },
];

const FeatureBeat = ({ feature }: { feature: Feature }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Accent line
  const lineH = interpolate(frame, [0.1 * fps, 0.6 * fps], [0, 120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Stat
  const statOpacity = interpolate(frame, [0.15 * fps, 0.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const statY = interpolate(frame, [0.15 * fps, 0.6 * fps], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Title
  const titleOpacity = interpolate(frame, [0.3 * fps, 0.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const titleY = interpolate(frame, [0.3 * fps, 0.8 * fps], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Description
  const descOpacity = interpolate(frame, [0.6 * fps, 1.1 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: C.darkBg }}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 160px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 80,
            width: "100%",
          }}
        >
          {/* Left: Stat */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 24,
              flexShrink: 0,
            }}
          >
            {/* Accent line */}
            <div
              style={{
                width: 3,
                height: lineH,
                backgroundColor: feature.accentColor,
                borderRadius: 2,
                boxShadow: `0 0 20px ${feature.accentColor}60`,
              }}
            />
            <div
              style={{
                opacity: statOpacity,
                transform: `translateY(${statY}px)`,
              }}
            >
              <div
                style={{
                  fontFamily: sansFont,
                  fontSize: 80,
                  fontWeight: 700,
                  color: C.white,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}
              >
                {feature.stat}
              </div>
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: 14,
                  color: feature.accentColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginTop: 8,
                }}
              >
                {feature.statLabel}
              </div>
            </div>
          </div>

          {/* Right: Text */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: sansFont,
                fontSize: 40,
                fontWeight: 600,
                color: C.white,
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`,
                marginBottom: 14,
              }}
            >
              {feature.title}
            </div>
            <div
              style={{
                fontFamily: sansFont,
                fontSize: 20,
                fontWeight: 400,
                color: C.gray,
                lineHeight: 1.5,
                opacity: descOpacity,
                maxWidth: 500,
              }}
            >
              {feature.description}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const FeaturesScene = () => {
  const { fps } = useVideoConfig();
  const beatDuration = 2 * fps; // 2s per feature

  return (
    <AbsoluteFill>
      {FEATURES.map((feature, i) => (
        <Sequence
          key={i}
          from={i * beatDuration}
          durationInFrames={beatDuration}
        >
          <FeatureBeat feature={feature} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
