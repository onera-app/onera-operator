import { AbsoluteFill } from "remotion";
import { C } from "../colors";

/**
 * Premium light background with subtle depth and warmth.
 * Multiple gradient layers create a sophisticated, non-flat feel.
 */
export const ProductBackground = ({ children }: { children?: React.ReactNode }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        overflow: "hidden",
      }}
    >
      {/* Warm top-center vignette — adds depth without darkness */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0, 51, 204, 0.05) 0%, transparent 70%)`,
        }}
      />

      {/* Bottom corner depth — ground shadow effect */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 100% 40% at 50% 110%, rgba(0, 0, 0, 0.04) 0%, transparent 70%)`,
        }}
      />

      {/* Subtle side vignette for cinematic feel */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 100% at 0% 50%, rgba(0, 0, 0, 0.02) 0%, transparent 60%),
                       radial-gradient(ellipse 60% 100% at 100% 50%, rgba(0, 0, 0, 0.02) 0%, transparent 60%)`,
        }}
      />

      {children}
    </AbsoluteFill>
  );
};
