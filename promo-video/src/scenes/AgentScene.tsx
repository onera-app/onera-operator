import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { C } from "../colors";
import { sansFont } from "../fonts";
import { TerminalWindow } from "../components/TerminalWindow";
import { GlowOrb } from "../components/GlowOrb";

/**
 * Scene 5 — Agents in Action (6s)
 *
 * Shows a simulated terminal with agent activity typing in live.
 * On the left: big typography saying what's happening.
 * On the right: the terminal window with live output.
 *
 * This proves the product actually does something — it's not vaporware.
 */

const TERM_LINES = [
  { prefix: "> ", prefixColor: C.termGreen, text: "planner: analyzing company goals...", delay: 0.3 },
  { prefix: "~ ", prefixColor: C.blueBright, text: "research: scanning 12 competitors...", delay: 1.0 },
  { prefix: "$ ", prefixColor: C.amber, text: "outreach: found 18 leads matching ICP", delay: 1.8 },
  { prefix: "$ ", prefixColor: C.amber, text: "outreach: drafting personalized emails...", delay: 2.5 },
  { prefix: "+ ", prefixColor: C.termGreen, text: "twitter: scheduled 3 posts for today", delay: 3.0 },
  { prefix: "+ ", prefixColor: C.termGreen, text: "outreach: sent 15 emails (3 bounced)", delay: 3.6 },
  { prefix: "< ", prefixColor: C.termCyan, text: "research: report ready — 3 pricing changes detected", delay: 4.2 },
  { prefix: "> ", prefixColor: C.termGreen, text: "planner: all tasks complete. next cycle in 24h.", delay: 4.8 },
];

export const AgentScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Left side copy
  const headOpacity = interpolate(frame, [0.2 * fps, 0.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const headY = interpolate(frame, [0.2 * fps, 0.8 * fps], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const subOpacity = interpolate(frame, [0.8 * fps, 1.4 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: C.darkBg }}>
      {/* Ambient */}
      <GlowOrb color1={C.cyanGlow} color2="transparent" size={500} x={70} y={50} delay={0} drift={12} />
      <GlowOrb color1={C.blueGlow} color2="transparent" size={400} x={25} y={45} delay={10} drift={8} />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 100px",
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
          {/* Left: Typography */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                fontFamily: sansFont,
                fontSize: 52,
                fontWeight: 700,
                color: C.white,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                opacity: headOpacity,
                transform: `translateY(${headY}px)`,
              }}
            >
              5 agents.
              <br />
              One command.
            </div>
            <div
              style={{
                fontFamily: sansFont,
                fontSize: 20,
                fontWeight: 400,
                color: C.gray,
                lineHeight: 1.6,
                opacity: subOpacity,
                maxWidth: 380,
              }}
            >
              Hit run and watch your AI team execute outreach,
              content, research, and planning — all at once.
            </div>
          </div>

          {/* Right: Terminal */}
          <div style={{ flexShrink: 0 }}>
            <TerminalWindow
              lines={TERM_LINES}
              delay={Math.round(0.4 * fps)}
              width={700}
            />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
