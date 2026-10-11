import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  Base,
  Burst,
  C,
  Pic,
  Phone,
  Label,
  Footer,
  tween,
  pop,
} from "./design";
export const Reveal = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Base color={C.deep} dark>
      <Burst x={1425} y={470} r={600} color={C.cyan} turn={-f * 0.1} />
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 180,
          width: 850,
          transform: `translateY(${tween(f, 0, 45, 110, 0)}px)`,
          opacity: tween(f, 0, 20, 0, 1),
        }}
      >
        <Label style={{ color: C.cyan, marginBottom: 46 }}>
          Meet your game night sidekick
        </Label>
        <Pic
          src="brand/flip7-title-logo.webp"
          style={{ width: 830, filter: "drop-shadow(0 16px 0 #070f2f)" }}
        />
        <div
          style={{
            fontSize: 59,
            lineHeight: 1.12,
            fontWeight: 800,
            letterSpacing: -2,
            marginTop: 52,
          }}
        >
          Your cards.
          <br />
          <span style={{ color: C.yellow }}>Your crew. All here.</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            marginTop: 34,
          }}
        >
          <Pic
            src="brand/flip7-companion-icon-512-rounded.png"
            style={{ width: 95, height: 95, borderRadius: 24 }}
          />
          <span style={{ fontSize: 26, color: C.cream, opacity: 0.8 }}>
            Made for the physical card game.
          </span>
        </div>
      </div>
      <Phone
        screen="crew"
        x={1470}
        y={145}
        w={310}
        rotate={14}
        ry={-14}
        scale={pop(f, fps, 16) * 0.96}
      />
      <Phone
        screen="home"
        x={1120}
        y={76 + tween(f, 0, 55, 900, 0)}
        w={407}
        rotate={-7 + Math.sin(f / 60) * 2}
        ry={-8}
      />
      <Footer dark />
    </Base>
  );
};
