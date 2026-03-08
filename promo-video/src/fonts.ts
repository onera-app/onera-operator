import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadPlatypi } from "@remotion/google-fonts/Platypi";

// Blueprint aesthetic: Clean sans for body, serif for titles, mono for labels/annotations

export const { fontFamily: sansFont } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const { fontFamily: monoFont } = loadJetBrainsMono("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});

// Platypi — a geometric serif that feels technical/architectural
export const { fontFamily: serifFont } = loadPlatypi("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});
