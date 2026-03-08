import { Composition } from "remotion";
import { OneraPromo } from "./OneraPromo";

export const RemotionRoot = () => {
  // Voiceover is ~103.2 seconds * 30 fps = ~3096 frames (1.2x speed ElevenLabs)
  return (
    <Composition
      id="OneraPromo"
      component={OneraPromo}
      durationInFrames={3096}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
