import { Composition } from "remotion";
import { OneraPromo } from "./OneraPromo";

export const RemotionRoot = () => {
  // 30-second high-impact edit: 30s * 60fps = 1800 frames
  return (
    <Composition
      id="OneraPromo"
      component={OneraPromo}
      durationInFrames={1800}
      fps={60}
      width={1920}
      height={1080}
    />
  );
};
