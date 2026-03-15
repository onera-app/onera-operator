import { AbsoluteFill, useCurrentFrame, interpolate, useVideoConfig } from "remotion";
import { ProductBackground } from "../components/ProductBackground";
import { sansFont } from "../fonts";
import { C } from "../colors";

export const S1_TheGrind = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Compressed 5-second High-Impact Opener (5s total)
  // All keyframes are fps-relative so they work at any frame rate

  // 0-1.33s: "02:00 AM"
  const f10 = Math.round(fps * 10 / 30);
  const f30 = Math.round(fps * 30 / 30);
  const f40 = Math.round(fps * 40 / 30);
  const f50 = Math.round(fps * 50 / 30);
  const f60 = Math.round(fps * 60 / 30);
  const f70 = Math.round(fps * 70 / 30);
  const f80 = Math.round(fps * 80 / 30);
  const f90 = Math.round(fps * 90 / 30);
  const f100 = Math.round(fps * 100 / 30);
  const f110 = Math.round(fps * 110 / 30);
  const f120 = Math.round(fps * 120 / 30);

  // 0-40: "02:00 AM"
  const timeOpacity = interpolate(frame, [0, f10, f30, f40], [0, 1, 1, 0], { extrapolateRight: "clamp" });

  // 40-80: "47 Tabs"
  const tabsOpacity = interpolate(frame, [f40, f50, f70, f80], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const tabsCount = Math.floor(interpolate(frame, [f40, f60], [1, 47], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }));

  // 80-110: "EVERYTHING. EVERYWHERE."
  const chaosOpacity = interpolate(frame, [f80, f90, f100, f110], [0, 1, 1, 0], { extrapolateRight: "clamp" });

  // 110-150: Role Flashing (very fast — ~8 frames per role at 60fps ≈ same speed)
  const rolesOpacity = interpolate(frame, [f110, f120], [0, 1], { extrapolateRight: "clamp" });
  const flashInterval = Math.round(fps * 4 / 30); // 4 frames at 30fps → 8 at 60fps
  const activeRoleIndex = Math.floor((frame - f110) / Math.max(flashInterval, 1)) % 4;
  const roles = ["CEO", "MARKETER", "ENGINEER", "SALES"];

  return (
    <ProductBackground>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>

        {/* It's 2am */}
        <div style={{ position: "absolute", opacity: timeOpacity, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h1 style={{ fontFamily: sansFont, fontSize: 320, fontWeight: 900, color: C.foreground, margin: 0, letterSpacing: "-0.05em" }}>
            02:00
          </h1>
          <div style={{ fontFamily: sansFont, fontSize: 40, fontWeight: 600, color: C.primary, letterSpacing: "0.2em" }}>AM</div>
        </div>

        {/* 47 Tabs */}
        <div style={{ position: "absolute", opacity: tabsOpacity, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h1 style={{ fontFamily: sansFont, fontSize: 480, fontWeight: 900, color: C.primary, margin: 0, lineHeight: 0.8 }}>
            {tabsCount}
          </h1>
          <h2 style={{ fontFamily: sansFont, fontSize: 60, color: C.foreground, margin: 0, fontWeight: 700, marginTop: 40 }}>
            Tabs Open.
          </h2>
        </div>

        {/* Chaos / Overwhelm */}
        <div style={{ position: "absolute", opacity: chaosOpacity, display: "flex", flexDirection: "column", gap: 32, alignItems: "center" }}>
          <h1 style={{ fontFamily: sansFont, fontSize: 160, fontWeight: 900, color: C.foreground, margin: 0, letterSpacing: "-0.04em", textAlign: "center", lineHeight: 1 }}>
            EVERYTHING,<br/>EVERYWHERE.
          </h1>
        </div>

        {/* Roles flashing */}
        <div style={{ position: "absolute", opacity: rolesOpacity, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontFamily: sansFont, fontSize: 32, color: C.textSecondary, marginBottom: 40, fontWeight: 500 }}>
            You are the:
          </div>
          <h1 style={{ fontFamily: sansFont, fontSize: 240, fontWeight: 900, color: C.primary, margin: 0, letterSpacing: "-0.04em" }}>
            {frame > f110 ? roles[activeRoleIndex] : roles[0]}
          </h1>
        </div>

      </AbsoluteFill>
    </ProductBackground>
  );
};
