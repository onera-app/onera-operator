import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";

// Apple Aesthetic: Geist (SF Pro vibes) for all primary communication.
// Bold weights for impact, light weights for detail.

export const { fontFamily: sansFont } = loadGeist("normal", {
  weights: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const { fontFamily: monoFont } = loadGeistMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

// Alias everything to Sans for a unified modern look
export const serifFont = sansFont;
