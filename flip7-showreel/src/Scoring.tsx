import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  Base,
  C,
  Card,
  Head,
  Label,
  Phone,
  Footer,
  pop,
  tween,
  Ring,
} from "./design";
export const Scoring = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Base>
      <div
        style={{
          position: "absolute",
          right: -160,
          top: -240,
          width: 1150,
          height: 1550,
          background: C.yellow,
          rotate: "-16deg",
        }}
      />
      <Ring x={1480} y={550} r={1280} />
      <div
        style={{
          position: "absolute",
          left: 105,
          top: 122,
          transform: `translateX(${tween(f, 0, 35, -500, 0)}px)`,
        }}
      >
        <Label style={{ color: C.pink, marginBottom: 40 }}>
          You play. It keeps score.
        </Label>
        <Head>
          Every point.
          <br />
          <span style={{ color: C.pink }}>Handled.</span>
        </Head>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 25,
            marginTop: 46,
          }}
        >
          <span
            style={{
              fontSize: 178,
              fontWeight: 900,
              letterSpacing: -10,
              color: C.navy,
            }}
          >
            {Math.round(tween(f, 30, 110, 0, 37))}
          </span>
          <span style={{ fontSize: 37, fontWeight: 800 }}>
            POINTS.
            <br />
            ZERO MENTAL MATH.
          </span>
        </div>
      </div>
      {["3", "5", "7", "10", "12"].map((n, i) => (
        <Card
          key={n}
          name={n}
          x={105 + i * 141}
          y={700 + Math.sin((f - i * 6) / 40) * 9}
          w={155}
          rot={-12 + i * 6}
          ry={tween(f, i * 6, 40 + i * 6, 100, 0)}
          scale={pop(f, fps, 12 + i * 6)}
        />
      ))}
      <Phone
        screen="classic"
        x={1210}
        y={58 + tween(f, 0, 45, 700, 0)}
        w={425}
        rotate={7 - Math.sin(f / 80) * 2}
        ry={-12}
      />
      <Footer />
    </Base>
  );
};
