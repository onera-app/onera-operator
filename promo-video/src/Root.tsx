import { Composition } from "remotion";
import { OneraPromo } from "./OneraPromo";

export const RemotionRoot = () => {
  // Voiceover is 112.61 seconds * 30 fps = ~3378 frames
  return (
    <Composition
      id="OneraPromo"
      component={OneraPromo}
      durationInFrames={3378}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
