import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  Base,
  C,
  Card,
  Phone,
  Pic,
  Label,
  Head,
  Footer,
  tween,
  Burst,
  pop,
} from "./design";
export const Vengeance = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Base color={C.deep} dark>
      <div
        style={{
          position: "absolute",
          left: -370,
          top: -300,
          width: 1250,
          height: 1750,
          background: C.red,
          rotate: "22deg",
        }}
      />
      <Burst x={500} y={530} r={480} color={C.gold} turn={f * 0.07} />
      <Phone
        screen="vengeance"
        x={325}
        y={62 + tween(f, 0, 40, 800, 0)}
        w={410}
        rotate={-8}
        ry={15}
      />
      <div
        style={{
          position: "absolute",
          left: 1010,
          top: 132,
          width: 800,
          opacity: tween(f, 10, 30, 0, 1),
          transform: `translateX(${tween(f, 10, 55, 500, 0)}px)`,
        }}
      >
        <Label style={{ color: C.gold }}>Switch up the stakes</Label>
        <Pic
          src="brand/flip7-vengeance-logo.webp"
          style={{
            width: 750,
            height: 220,
            objectFit: "contain",
            marginTop: 24,
          }}
        />
        <Head style={{ fontSize: 105, marginTop: 16 }}>
          Same crew.
          <br />
          <span style={{ color: C.gold }}>New chaos.</span>
        </Head>
      </div>
      <Card
        name="vengeance/v-action-steal"
        x={1010}
        y={680}
        w={160}
        rot={-12}
        scale={pop(f, fps, 20)}
      />
      <Card
        name="vengeance/v-number-13"
        x={1240}
        y={670}
        w={160}
        rot={5}
        scale={pop(f, fps, 28)}
      />
      <Card
        name="vengeance/v-action-swap"
        x={1470}
        y={680}
        w={160}
        rot={20}
        scale={pop(f, fps, 36)}
      />
      <Footer dark text="CLASSIC + WITH A VENGEANCE" />
    </Base>
  );
};

