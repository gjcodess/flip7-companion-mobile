import { AbsoluteFill, staticFile, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries } from "@remotion/transitions";
import { Opening } from "./Opening";
import { Reveal } from "./Reveal";
import { Scoring } from "./Scoring";
import { Vengeance } from "./Vengeance";
import { Standings } from "./Standings";
import { Finale } from "./Finale";
import { Wipe } from "./design";
export const Showreel = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <TransitionSeries>
        <TransitionSeries.Sequence
          name="01 — Turn game night up"
          durationInFrames={3 * fps}
          premountFor={fps}
        >
          <Opening />
        </TransitionSeries.Sequence>
        <TransitionSeries.Overlay durationInFrames={30} premountFor={fps}>
          <Wipe />
        </TransitionSeries.Overlay>
        <TransitionSeries.Sequence
          name="02 — Meet Flip7 Companion"
          durationInFrames={3.5 * fps}
          premountFor={fps}
        >
          <Reveal />
        </TransitionSeries.Sequence>
        <TransitionSeries.Overlay durationInFrames={30} premountFor={fps}>
          <Wipe />
        </TransitionSeries.Overlay>
        <TransitionSeries.Sequence
          name="03 — Every point handled"
          durationInFrames={4 * fps}
          premountFor={fps}
        >
          <Scoring />
        </TransitionSeries.Sequence>
        <TransitionSeries.Overlay durationInFrames={30} premountFor={fps}>
          <Wipe />
        </TransitionSeries.Overlay>
        <TransitionSeries.Sequence
          name="04 — With a Vengeance"
          durationInFrames={2.5 * fps}
          premountFor={fps}
        >
          <Vengeance />
        </TransitionSeries.Sequence>
        <TransitionSeries.Overlay durationInFrames={30} premountFor={fps}>
          <Wipe />
        </TransitionSeries.Overlay>
        <TransitionSeries.Sequence
          name="05 — Standings and offline"
          durationInFrames={3.5 * fps}
          premountFor={fps}
        >
          <Standings />
        </TransitionSeries.Sequence>
        <TransitionSeries.Overlay durationInFrames={30} premountFor={fps}>
          <Wipe />
        </TransitionSeries.Overlay>
        <TransitionSeries.Sequence
          name="06 — Bring game night to life"
          durationInFrames={8.5 * fps}
          premountFor={fps}
        >
          <Finale />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Audio
        name="ElevenLabs — Liam voice-over"
        src={staticFile("audio/voiceover.mp3")}
        volume={1}
        premountFor={fps}
      />
      <Audio
        name="Original 120 BPM electro-funk score"
        src={staticFile("audio/music.wav")}
        volume={0.34}
        premountFor={fps}
      />
      <Audio
        name="Opening snap and beat accents"
        src={staticFile("audio/accents.wav")}
        volume={0.58}
        premountFor={fps}
      />
      <Audio
        name="Reveal whoosh"
        src={staticFile("audio/whoosh.mp3")}
        from={2.75 * fps}
        volume={0.5}
        premountFor={fps}
      />
      <Audio
        name="Scoring whoosh"
        src={staticFile("audio/whoosh.mp3")}
        from={6.25 * fps}
        volume={0.4}
        premountFor={fps}
      />
      <Audio
        name="Vengeance impact"
        src={staticFile("audio/whoosh.mp3")}
        from={10.25 * fps}
        volume={0.55}
        premountFor={fps}
      />
      <Audio
        name="Standings transition"
        src={staticFile("audio/whoosh.mp3")}
        from={12.75 * fps}
        volume={0.4}
        premountFor={fps}
      />
      <Audio
        name="Finale transition"
        src={staticFile("audio/whoosh.mp3")}
        from={16.25 * fps}
        volume={0.5}
        premountFor={fps}
      />
    </AbsoluteFill>
  );
};
