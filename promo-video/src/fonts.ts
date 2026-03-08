import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";

// Apple-like aesthetic: Geist (SF Pro vibes) for all text, Geist Mono for code/labels

export const { fontFamily: sansFont } = loadGeist("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const { fontFamily: monoFont } = loadGeistMono("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});

// serifFont alias → Geist (Apple doesn't use serifs; clean geometric sans everywhere)
export const { fontFamily: serifFont } = loadGeist("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});
