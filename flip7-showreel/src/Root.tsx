import { Composition, Folder } from "remotion";
import { Showreel } from "./Showreel";
import { Opening } from "./Opening";
import { Reveal } from "./Reveal";
import { Scoring } from "./Scoring";
import { Vengeance } from "./Vengeance";
import { Standings } from "./Standings";
import { Finale } from "./Finale";
export const RemotionRoot = () => (
  <>
    <Composition
      id="Flip7-Companion"
      component={Showreel}
      durationInFrames={1500}
      fps={60}
      width={1920}
      height={1080}
    />
    <Folder name="Scenes">
      <Composition
        id="Opening"
        component={Opening}
        durationInFrames={180}
        fps={60}
        width={1920}
        height={1080}
      />
      <Composition
        id="Product-Reveal"
        component={Reveal}
        durationInFrames={210}
        fps={60}
        width={1920}
        height={1080}
      />
      <Composition
        id="Scoring"
        component={Scoring}
        durationInFrames={240}
        fps={60}
        width={1920}
        height={1080}
      />
      <Composition
        id="Vengeance"
        component={Vengeance}
        durationInFrames={150}
        fps={60}
        width={1920}
        height={1080}
      />
      <Composition
        id="Standings"
        component={Standings}
        durationInFrames={210}
        fps={60}
        width={1920}
        height={1080}
      />
      <Composition
        id="Finale"
        component={Finale}
        durationInFrames={510}
        fps={60}
        width={1920}
        height={1080}
      />
    </Folder>
  </>
);
