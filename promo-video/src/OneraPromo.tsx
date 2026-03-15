import { AbsoluteFill, useVideoConfig, Audio, staticFile } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

import { S1_TheGrind } from "./scenes/S1_TheGrind";
import { S2_BreakingPoint } from "./scenes/S2_BreakingPoint";
import { S3_TheShift } from "./scenes/S3_TheShift";
import { S4_OneraOperator } from "./scenes/S4_OneraOperator";
import { S5_Dashboard } from "./scenes/S5_Dashboard";
import { S6_CTA } from "./scenes/S6_CTA";
import { C } from "./colors";

export const OneraPromo = () => {
  const { fps } = useVideoConfig();
  const transitionDur = Math.round(0.3 * fps); // Fast 0.3s transitions

  // Total Duration: 30 seconds = 1800 frames @ 60fps
  const d1 = Math.round(5 * fps);   // The Grind (5s)
  const d2 = Math.round(4 * fps);   // Breaking Point (4s)
  const d3 = Math.round(4 * fps);   // Not a Chatbot (4s)
  const d4 = Math.round(5 * fps);   // Onera Reveal (5s)
  const d5 = Math.round(7 * fps);   // Dashboard Walkthrough (7s)
  const d6 = Math.round(5 * fps);   // CTA (5s)
  // Total ~1800

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      {/* Audio: Ensure you have a high-energy 30s track or voiceover */}
      <Audio src={staticFile("voiceover.mp3")} />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={d1}>
          <S1_TheGrind />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: transitionDur })} />

        <TransitionSeries.Sequence durationInFrames={d2}>
          <S2_BreakingPoint />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: transitionDur })} />

        <TransitionSeries.Sequence durationInFrames={d3}>
          <S3_TheShift />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: transitionDur })} />

        <TransitionSeries.Sequence durationInFrames={d4}>
          <S4_OneraOperator />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: transitionDur })} />

        <TransitionSeries.Sequence durationInFrames={d5}>
          <S5_Dashboard />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: transitionDur })} />

        <TransitionSeries.Sequence durationInFrames={d6}>
          <S6_CTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
