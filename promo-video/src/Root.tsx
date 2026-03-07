import { Composition } from "remotion";
import { OneraPromo } from "./OneraPromo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="OneraPromo"
      component={OneraPromo}
      durationInFrames={1110}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
