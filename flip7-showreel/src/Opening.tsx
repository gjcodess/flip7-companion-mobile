import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  Base,
  Burst,
  Card,
  C,
  Head,
  Label,
  Footer,
  pop,
  tween,
} from "./design";
export const Opening = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phase = f < 1.05 * fps;
  const p = pop(phase ? f : f - 1.05 * fps, fps);
  return (
    <Base color={phase ? C.yellow : C.pink}>
      <Burst
        x={960}
        y={535}
        r={920}
        color={phase ? C.cream : C.yellow}
        turn={f * 0.08}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse,transparent 40%,#132d6718)",
        }}
      />
      {["3", "5", "7", "10", "12", "x2"].map((n, i) => {
        const side = i % 2 ? -1 : 1;
        return (
          <Card
            key={n}
            name={n}
            x={side === 1 ? 1620 + (i % 3) * 35 : 30 + (i % 3) * 30}
            y={-80 + i * 195}
            w={210}
            rot={side * (20 + i * 4) + f * 0.04}
            ry={tween(f, 0, 45, 80, 0)}
            scale={pop(f, fps, i * 3)}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 360,
          right: 360,
          top: 157,
          textAlign: "center",
          transform: `scale(${0.85 + 0.15 * p}) rotate(${phase ? -3 : 2}deg)`,
        }}
      >
        <Label style={{ marginBottom: 45 }}>Let the good times flip</Label>
        <Head
          style={{
            fontSize: phase ? 238 : 170,
            lineHeight: 0.89,
            letterSpacing: -9,
            textShadow: `8px 9px 0 ${phase ? C.yellow : C.cream}`,
          }}
        >
          {phase ? (
            <>
              GAME
              <br />
              NIGHT.
            </>
          ) : (
            <>
              TURNED
              <br />
              <span
                style={{
                  color: C.cream,
                  WebkitTextStroke: `3px ${C.navy}`,
                  textShadow: `9px 10px 0 ${C.navy}`,
                }}
              >
                ALL THE
                <br />
                WAY UP.
              </span>
            </>
          )}
        </Head>
      </div>
      <Footer />
    </Base>
  );
};
