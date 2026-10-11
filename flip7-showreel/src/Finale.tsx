import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  Base,
  C,
  Pic,
  Phone,
  Label,
  Head,
  Footer,
  Burst,
  tween,
  pop,
} from "./design";
export const Finale = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lock = tween(f, 2.3 * fps, 3.3 * fps, 0, 1);
  return (
    <Base color={C.yellow}>
      <Burst x={960} y={560} r={1100} color={C.cream} turn={f * 0.05} />
      {Array.from({ length: 28 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: (i * 173 + 38) % 1920,
            top: ((i * 91 + f * (1 + (i % 3))) % 1320) - 120,
            width: i % 3 ? 13 : 24,
            height: i % 3 ? 36 : 24,
            borderRadius: i % 3 ? 2 : 50,
            background: [C.pink, C.cyan, C.navy][i % 3],
            rotate: `${i * 31 + f * 0.8}deg`,
            opacity: 0.55,
          }}
        />
      ))}
      <div style={{ opacity: 1 - lock }}>
        <Phone
          screen="classic"
          x={180 - tween(f, 2.3 * fps, 3.3 * fps, 0, 500)}
          y={190}
          w={290}
          rotate={-16}
          scale={pop(f, fps)}
        />
        <Phone
          screen="vengeance"
          x={1460 + tween(f, 2.3 * fps, 3.3 * fps, 0, 500)}
          y={190}
          w={290}
          rotate={16}
          scale={pop(f, fps, 10)}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 460,
          right: 460,
          top: tween(f, 2.3 * fps, 3.3 * fps, 100, 125),
          textAlign: "center",
        }}
      >
        <Pic
          src="brand/flip7-companion-icon-512-rounded.png"
          style={{
            width: tween(f, 2.3 * fps, 3.3 * fps, 180, 225),
            height: tween(f, 2.3 * fps, 3.3 * fps, 180, 225),
            borderRadius: 48,
            filter: "drop-shadow(9px 13px 0 #132d67)",
            transform: `rotate(${tween(f, 0, 40, -20, 0)}deg) scale(${pop(f, fps)})`,
          }}
        />
        <Pic
          src="brand/flip7-title-logo.webp"
          style={{
            width: 960,
            marginTop: 50,
            transform: `scale(${0.9 + 0.1 * pop(f, fps, 12)})`,
          }}
        />
        <Head
          style={{
            fontSize: 77,
            letterSpacing: -3,
            lineHeight: 1.08,
            marginTop: 45,
          }}
        >
          Bring your game night
          <br />
          <span style={{ color: C.pink }}>to life.</span>
        </Head>
        <Label style={{ marginTop: 37, fontSize: 19, letterSpacing: 4 }}>
          CLASSIC + VENGEANCE • ALWAYS OFFLINE
        </Label>
      </div>
      <Footer />
    </Base>
  );
};
