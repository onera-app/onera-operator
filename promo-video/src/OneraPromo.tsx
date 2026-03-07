import { AbsoluteFill, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { LogoReveal } from "./scenes/LogoReveal";
import { ProblemScene } from "./scenes/ProblemScene";
import { SolutionScene } from "./scenes/SolutionScene";
import { ProductScene } from "./scenes/ProductScene";
import { AgentScene } from "./scenes/AgentScene";
import { FeaturesScene } from "./scenes/FeaturesScene";
import { CTAScene } from "./scenes/CTAScene";

/**
 * Onera Promo — YC-Style Startup Launch Video
 *
 * Cinematic dark aesthetic with ambient gradient orbs, real product UI,
 * live terminal simulations, and clean kinetic typography.
 *
 * Timeline (~37s at 30fps):
 *   0:00 - 0:05  Logo reveal with glow effects
 *   0:05 - 0:10  Problem — "You're wearing every hat"
 *   0:10 - 0:15  Solution — "What if it ran itself?"
 *   0:15 - 0:22  Product showcase — animated dashboard mock
 *   0:22 - 0:28  Agents in action — live terminal feed
 *   0:28 - 0:36  Feature beats (4 x 2s)
 *   0:36 - 0:41  CTA close
 *
 * Total scene content: 5+5+5+7+6+8+5 = 41s
 * Minus 6 transitions x 0.7s = 4.2s overlap
 * Effective: ~37s
 */
export const OneraPromo = () => {
  const { fps } = useVideoConfig();
  const fadeDur = Math.round(0.7 * fps); // 0.7s fades

  return (
    <AbsoluteFill style={{ backgroundColor: "#06060f" }}>
      <TransitionSeries>
        {/* 1. Logo Reveal */}
        <TransitionSeries.Sequence durationInFrames={5 * fps}>
          <LogoReveal />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: fadeDur })}
        />

        {/* 2. Problem */}
        <TransitionSeries.Sequence durationInFrames={5 * fps}>
          <ProblemScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: fadeDur })}
        />

        {/* 3. Solution */}
        <TransitionSeries.Sequence durationInFrames={5 * fps}>
          <SolutionScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: fadeDur })}
        />

        {/* 4. Product Showcase */}
        <TransitionSeries.Sequence durationInFrames={7 * fps}>
          <ProductScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: fadeDur })}
        />

        {/* 5. Agents in Action */}
        <TransitionSeries.Sequence durationInFrames={6 * fps}>
          <AgentScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: fadeDur })}
        />

        {/* 6. Feature Beats */}
        <TransitionSeries.Sequence durationInFrames={8 * fps}>
          <FeaturesScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: fadeDur })}
        />

        {/* 7. CTA */}
        <TransitionSeries.Sequence durationInFrames={5 * fps}>
          <CTAScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
