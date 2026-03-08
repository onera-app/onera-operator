// ─── Dark Blueprint Color Palette ────────────────────────────────
// Inspired by real engineering blueprints: deep blue background,
// white/cyan wireframe lines, glowing accents.

export const C = {
  // Core blueprint
  bg: "#1a2744",               // Deep blueprint blue background
  bgDark: "#131e35",           // Even darker for layered panels
  bgLight: "#223456",          // Lighter blue for highlighted panels
  bgGlow: "#1e3a5f",           // Subtle glow behind elements

  // Lines and wireframes
  line: "rgba(255, 255, 255, 0.15)",       // Faint grid lines
  lineStrong: "rgba(255, 255, 255, 0.25)", // Stronger grid lines (every 4th)
  wire: "rgba(120, 180, 255, 0.5)",        // Wireframe blue for borders
  wireGlow: "rgba(120, 180, 255, 0.8)",    // Bright wireframe glow
  wireDim: "rgba(120, 180, 255, 0.2)",     // Dim wireframe for dashed

  // Text
  textPrimary: "#FFFFFF",                  // White headings
  textSecondary: "rgba(255, 255, 255, 0.7)", // Dimmer body text
  textMuted: "rgba(255, 255, 255, 0.4)",     // Annotations, labels
  textAccent: "#78B4FF",                     // Blue accent text (same as wire)
  textWarn: "#FF8A65",                       // Orange for emphasis/warning

  // Accents
  accent: "#78B4FF",           // Primary accent blue (cyan-blue)
  accentGlow: "#5C9CFF",      // Glow version
  accentDim: "rgba(120, 180, 255, 0.3)", // Dim accent
  green: "#4ADE80",            // Success/completion
  orange: "#FF8A65",           // Warning/breaking point
  red: "#EF4444",              // Error/failure

  // Legacy aliases (for any component that still references old names)
  primary: "#78B4FF",
  primaryForeground: "#FFFFFF",
  background: "#1a2744",
  blueprintGrid: "rgba(255, 255, 255, 0.08)",
  foreground: "#FFFFFF",
  mutedForeground: "rgba(255, 255, 255, 0.5)",
};
