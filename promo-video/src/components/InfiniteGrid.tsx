import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { C } from "../colors";
import { sansFont, monoFont } from "../fonts";

const ProCard = ({ children, style = {} }: any) => (
  <div style={{
    backgroundColor: "#FFFFFF",
    border: `1.5px solid ${C.border}`,
    borderRadius: 20,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    boxShadow: `0 10px 30px ${C.shadow}`,
    ...style
  }}>
    {children}
  </div>
);

const EmailItem = ({ seed }: { seed: number }) => (
  <ProCard style={{ width: 280, gap: 12 }}>
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
         <div style={{ width: 14, height: 10, border: "2px solid #fff" }} />
      </div>
      <div style={{ fontFamily: sansFont, fontSize: 14, color: C.foreground, fontWeight: 700 }}>Outreach Agent</div>
    </div>
    <div style={{ height: 1.5, backgroundColor: C.border }} />
    <div style={{ width: "100%", height: 6, backgroundColor: C.bgSecondary, borderRadius: 3 }} />
    <div style={{ width: "60%", height: 6, backgroundColor: C.bgSecondary, borderRadius: 3 }} />
  </ProCard>
);

const SocialItem = ({ seed }: { seed: number }) => (
  <ProCard style={{ width: 240, gap: 12 }}>
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: C.bgSecondary, border: `1.5px solid ${C.border}` }} />
      <div style={{ fontFamily: sansFont, fontSize: 14, fontWeight: 700, color: C.foreground }}>Twitter Node</div>
    </div>
    <div style={{ width: "100%", height: 6, backgroundColor: C.bgSecondary, borderRadius: 3 }} />
    <div style={{ width: "80%", height: 6, backgroundColor: C.bgSecondary, borderRadius: 3 }} />
  </ProCard>
);

const TaskItem = ({ seed }: { seed: number }) => (
  <ProCard style={{ width: 260, gap: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontFamily: monoFont, fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: "0.1em" }}>TASK_#{seed}</div>
      <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${C.green}`, backgroundColor: C.green + "20" }} />
    </div>
    <div style={{ height: 6, width: "100%", backgroundColor: C.bgSecondary, borderRadius: 3 }}>
      <div style={{ width: "100%", height: "100%", backgroundColor: C.green, opacity: 0.2 }} />
    </div>
  </ProCard>
);

export const InfiniteGrid = ({ scrollSpeed = 1, explosionFrame = 0 }: { scrollSpeed?: number, explosionFrame?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cols = 6;
  const rows = 8;
  const items = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = r * cols + c;
      const type = id % 3;

      const distFromCenter = Math.abs(c - cols / 2) + Math.abs(r - rows / 2);
      const delay = explosionFrame + distFromCenter * 3;

      const itemScale = spring({ frame: frame - delay, fps, config: { damping: 14 } });
      const itemOpacity = interpolate(frame - delay, [0, 20], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

      if (frame < delay) continue;

      items.push(
        <div key={id} style={{
          position: "absolute",
          left: `${(c / cols) * 110}%`,
          top: `${(r / rows) * 110}%`,
          transform: `scale(${itemScale}) translateY(${(frame - explosionFrame) * scrollSpeed * -1.5}px)`,
          opacity: itemOpacity * 0.5,
        }}>
          {type === 0 && <EmailItem seed={id} />}
          {type === 1 && <SocialItem seed={id} />}
          {type === 2 && <TaskItem seed={id} />}
        </div>
      );
    }
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden", perspective: 1200 }}>
      <div style={{
        position: "absolute",
        width: "120%",
        height: "120%",
        left: "-10%",
        top: "-10%",
        transform: "rotateX(20deg) rotateY(-10deg) scale(1.1)",
        transformStyle: "preserve-3d",
      }}>
        {items}
      </div>

      <AbsoluteFill style={{ background: `radial-gradient(circle at center, transparent 30%, ${C.bg} 85%)` }} />
    </AbsoluteFill>
  );
};
