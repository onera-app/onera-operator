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
  const fadeDur = Math.round(0.5 * fps);

  // Audio total duration: ~103.2s = ~3096 frames @ 30fps (1.2x speed ElevenLabs)
  // Distributed proportionally to match voiceover pacing:
  const d1 = 697;  // The Grind (~23.2s)
  const d2 = 577;  // Breaking Point (~19.2s)
  const d3 = 522;  // The Shift (~17.4s)
  const d4 = 577;  // Onera Operator (~19.2s)
  const d5 = 367;  // Dashboard (~12.2s)
  const d6 = 356;  // CTA (~11.9s)
  // Total = 3096

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      {/* Voiceover — replace public/voiceover.mp3 with your Azure TTS file */}
      <Audio src={staticFile("voiceover.mp3")} />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={d1}>
          <S1_TheGrind />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: fadeDur })} />

        <TransitionSeries.Sequence durationInFrames={d2}>
          <S2_BreakingPoint />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: fadeDur })} />

        <TransitionSeries.Sequence durationInFrames={d3}>
          <S3_TheShift />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: fadeDur })} />

        <TransitionSeries.Sequence durationInFrames={d4}>
          <S4_OneraOperator />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: fadeDur })} />

        <TransitionSeries.Sequence durationInFrames={d5}>
          <S5_Dashboard />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: fadeDur })} />

        <TransitionSeries.Sequence durationInFrames={d6}>
          <S6_CTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
