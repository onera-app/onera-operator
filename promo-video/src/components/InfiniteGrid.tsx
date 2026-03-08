import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { C } from "../colors";
import { serifFont, monoFont } from "../fonts";
import { CornerMarks } from "./BlueprintElements";

const SchematicPanel = ({ children, style = {} }: any) => (
  <div style={{
    backgroundColor: "rgba(120, 180, 255, 0.04)",
    border: `1px solid ${C.wire}`,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    ...style
  }}>
    <CornerMarks color={C.wireDim} size={6} />
    {children}
  </div>
);

const EmailItem = ({ seed }: { seed: number }) => (
  <SchematicPanel style={{ width: 280, padding: 14, gap: 8 }}>
    <div style={{ display: "flex", gap: 8, alignItems: "center", borderBottom: `1px dashed ${C.wireDim}`, paddingBottom: 8 }}>
      <div style={{ width: 8, height: 8, border: `1px solid ${C.accent}` }} />
      <div style={{ fontFamily: monoFont, fontSize: 9, color: C.accent, fontWeight: 700, letterSpacing: "0.1em" }}>OUTREACH_EMAIL_{seed}</div>
    </div>
    <div style={{ width: "80%", height: 4, backgroundColor: C.wireDim }} />
    <div style={{ width: "100%", height: 3, backgroundColor: C.wireDim }} />
    <div style={{ width: "60%", height: 3, backgroundColor: C.wireDim }} />
  </SchematicPanel>
);

const TweetItem = ({ seed }: { seed: number }) => (
  <SchematicPanel style={{ width: 240, padding: 14, gap: 10 }}>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", border: `1px dashed ${C.wire}` }} />
      <div style={{ fontFamily: serifFont, fontSize: 12, fontWeight: 700, color: C.textSecondary }}>Onera Operator</div>
    </div>
    <div style={{ width: "100%", height: 3, backgroundColor: C.wireDim }} />
    <div style={{ width: "90%", height: 3, backgroundColor: C.wireDim }} />
    <div style={{ width: "40%", height: 3, backgroundColor: C.wireDim }} />
  </SchematicPanel>
);

const TaskItem = ({ seed }: { seed: number }) => (
  <SchematicPanel style={{ width: 260, padding: 14, gap: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontFamily: monoFont, fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: "0.1em" }}>TASK_#{seed}</div>
      <div style={{ fontFamily: monoFont, fontSize: 8, color: C.green, fontWeight: 700, border: `1px solid ${C.green}`, padding: "2px 4px", opacity: 0.7 }}>DONE</div>
    </div>
    <div style={{ height: 3, width: "100%", border: `1px dashed ${C.wireDim}`, display: "flex" }}>
      <div style={{ width: "100%", backgroundColor: C.accentDim }} />
    </div>
  </SchematicPanel>
);

export const InfiniteGrid = ({ scrollSpeed = 1, explosionFrame = 0 }: { scrollSpeed?: number, explosionFrame?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cols = 8;
  const rows = 12;
  const items = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = r * cols + c;
      const type = id % 3;

      const distFromCenter = Math.abs(c - cols / 2) + Math.abs(r - rows / 2);
      const delay = explosionFrame + distFromCenter * 2;

      const itemScale = spring({ frame: frame - delay, fps, config: { damping: 14 } });
      const itemOpacity = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

      if (frame < delay) continue;

      items.push(
        <div key={id} style={{
          position: "absolute",
          left: `${(c / cols) * 120 - 10}%`,
          top: `${(r / rows) * 120 - 10}%`,
          transform: `scale(${itemScale}) translateY(${(frame - explosionFrame) * scrollSpeed * -1}px)`,
          opacity: itemOpacity * 0.6,
        }}>
          {type === 0 && <EmailItem seed={id} />}
          {type === 1 && <TweetItem seed={id} />}
          {type === 2 && <TaskItem seed={id} />}
        </div>
      );
    }
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden", perspective: 1000 }}>
      <div style={{
        position: "absolute",
        width: "150%",
        height: "150%",
        left: "-25%",
        top: "-25%",
        transform: "rotateX(15deg) rotateY(-5deg) scale(1.1)",
        transformStyle: "preserve-3d",
      }}>
        {items}
      </div>

      {/* Dark radial fade so center is clear for text */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at center, transparent 25%, ${C.bg} 75%)` }} />
    </AbsoluteFill>
  );
};
