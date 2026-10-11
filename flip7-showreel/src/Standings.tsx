import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  Base,
  C,
  Head,
  Label,
  Phone,
  Footer,
  Ring,
  tween,
  pop,
} from "./design";
export const Standings = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Base color={C.cyan}>
      <Ring x={1345} y={500} r={1200} />
      <Ring x={1345} y={500} r={970} />
      <Ring x={1345} y={500} r={750} />
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 158,
          transform: `translateY(${tween(f, 0, 35, 100, 0)}px)`,
        }}
      >
        <Label style={{ marginBottom: 45 }}>Keep the rivalry rolling</Label>
        <Head style={{ fontSize: 121 }}>
          Own the
          <br />
          scoreboard.
        </Head>
        <div
          style={{
            marginTop: 65,
            background: C.navy,
            color: C.yellow,
            display: "inline-flex",
            padding: "24px 38px",
            borderRadius: 24,
            alignItems: "center",
            gap: 20,
            transform: `scale(${pop(f, fps, 65)})`,
          }}
        >
          <svg
            width="70"
            height="70"
            viewBox="0 0 80 80"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
          >
            <path d="M12 28Q40 5 68 28M23 40Q40 25 57 40M33 52Q40 46 47 52M7 8L72 73" />
            <circle cx="40" cy="64" r="3" fill="currentColor" />
          </svg>
          <span style={{ fontSize: 59, fontWeight: 900, letterSpacing: -2 }}>
            100% OFFLINE
          </span>
        </div>
        <div
          style={{
            fontSize: 34,
            marginTop: 25,
            opacity: tween(f, 95, 115, 0, 1),
          }}
        >
          No accounts. Just game night.
        </div>
      </div>
      <Phone
        screen="crew"
        x={1470}
        y={167}
        w={305}
        rotate={14}
        ry={-13}
        scale={0.97}
      />
      <Phone
        screen="scoreboard"
        x={1110}
        y={70 + tween(f, 0, 50, 900, 0)}
        w={413}
        rotate={-5}
        ry={-5}
      />
      <Footer />
    </Base>
  );
};
