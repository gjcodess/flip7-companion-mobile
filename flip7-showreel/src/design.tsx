import { loadFont } from "@remotion/fonts";
import React from "react";
import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
void loadFont({
  family: "FlipUI",
  url: staticFile("brand/SegoeUI-Regular.ttf"),
  weight: "400",
});
void loadFont({
  family: "FlipUI",
  url: staticFile("brand/SegoeUI-Bold.ttf"),
  weight: "700",
});
void loadFont({
  family: "FlipUI",
  url: staticFile("brand/SegoeUI-Black.ttf"),
  weight: "900",
});
export const C = {
  navy: "#132d67",
  deep: "#101d4d",
  cream: "#fff7da",
  yellow: "#ffe05c",
  pink: "#ed4f7e",
  cyan: "#57b8d7",
  red: "#e83239",
  gold: "#f7c244",
};
export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const tween = (f: number, a: number, b: number, x: number, y: number) =>
  interpolate(f, [a, b], [x, y], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
export const pop = (f: number, fps: number, delay = 0) =>
  spring({
    frame: f - delay,
    fps,
    config: { damping: 17, stiffness: 150, mass: 0.8 },
  });
export const Pic = ({
  src,
  style,
}: {
  src: string;
  style?: React.CSSProperties;
}) => {
  const { fps } = useVideoConfig();
  return <CanvasImage premountFor={fps} src={staticFile(src)} style={style} />;
};
export const Base = ({
  children,
  color = C.cream,
  dark = false,
}: {
  children?: React.ReactNode;
  color?: string;
  dark?: boolean;
}) => (
  <AbsoluteFill
    style={{
      background: color,
      color: dark ? C.cream : C.navy,
      fontFamily: 'FlipUI,"Segoe UI",system-ui,sans-serif',
      overflow: "hidden",
    }}
  >
    {children}
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: dark ? 0.12 : 0.15,
        backgroundImage: `radial-gradient(${dark ? C.cream : C.navy} 1.3px,transparent 1.3px)`,
        backgroundSize: "22px 22px",
        mixBlendMode: dark ? "screen" : "multiply",
      }}
    />
  </AbsoluteFill>
);
export const Label = ({
  children,
  style = {},
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      fontSize: 23,
      fontWeight: 800,
      letterSpacing: 5,
      textTransform: "uppercase",
      ...style,
    }}
  >
    {children}
  </div>
);
export const Head = ({
  children,
  style = {},
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      fontSize: 136,
      lineHeight: 0.96,
      fontWeight: 900,
      letterSpacing: -7,
      ...style,
    }}
  >
    {children}
  </div>
);
export const Phone = ({
  screen,
  x,
  y,
  w = 400,
  rotate = 0,
  ry = 0,
  scale = 1,
}: {
  screen: string;
  x: number;
  y: number;
  w?: number;
  rotate?: number;
  ry?: number;
  scale?: number;
}) => {
  const { fps } = useVideoConfig();
  // Preserve the phone geometry and uniformly fill its display edge-to-edge.
  // Clip only the small aspect-ratio excess; never stretch the app capture.
  const bezel = 12;
  const border = 3;
  const screenWidth = w - 2 * (bezel + border);
  const hardwareInset = (24 * w) / 400;
  const screenHeight =
    ((screenWidth - (16 * w) / 400) * 1864) / 860 + 2 * hardwareInset;
  const imageScale = Math.max(screenWidth / 860, screenHeight / 1864);
  const imageWidth = 860 * imageScale;
  const imageHeight = 1864 * imageScale;
  return (
    <div
      data-phone-screen={screen}
      style={{
        position: "absolute",
        boxSizing: "border-box",
        left: x,
        top: y,
        width: w,
        height: screenHeight + 2 * (bezel + border),
        padding: bezel,
        background:
          "linear-gradient(110deg,#8193b0,#0a1536 15%,#0b1230 85%,#71809b)",
        border: "3px solid #62728d",
        borderRadius: 55,
        boxShadow: "16px 28px 0 #07113033, 22px 42px 65px #07113055",
        transform: `perspective(1600px) rotateY(${ry}deg) rotateZ(${rotate}deg) scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: screenWidth,
          height: screenHeight,
          borderRadius: (32 * w) / 400,
          overflow: "hidden",
          background: C.cream,
        }}
      >
        <CanvasImage
          src={staticFile(`screens/${screen}.png`)}
          width={860}
          height={1864}
          fit="cover"
          premountFor={fps}
          data-app-capture={screen}
          style={{
            position: "absolute",
            left: (screenWidth - imageWidth) / 2,
            top: (screenHeight - imageHeight) / 2,
            width: imageWidth,
            height: imageHeight,
            display: "block",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: hardwareInset / 3,
            left: "35%",
            width: "30%",
            height: (4 * w) / 400,
            borderRadius: 9,
            background: C.navy,
            opacity: 0.6,
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: -7,
          top: 155,
          width: 5,
          height: 60,
          borderRadius: 3,
          background: "#5b6c8e",
        }}
      />
    </div>
  );
};
export const Card = ({
  name,
  x,
  y,
  w = 200,
  rot = 0,
  ry = 0,
  scale = 1,
}: {
  name: string;
  x: number;
  y: number;
  w?: number;
  rot?: number;
  ry?: number;
  scale?: number;
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      filter: "drop-shadow(9px 16px 0 #101d4d40)",
      transform: `perspective(1100px) rotateY(${ry}deg) rotate(${rot}deg) scale(${scale})`,
    }}
  >
    <Pic
      src={`cards/${name}.webp`}
      style={{ width: "100%", borderRadius: 18 }}
    />
  </div>
);
export const Burst = ({
  x,
  y,
  r = 450,
  color = C.yellow,
  turn = 0,
}: {
  x: number;
  y: number;
  r?: number;
  color?: string;
  turn?: number;
}) => (
  <svg
    width={r * 2}
    height={r * 2}
    viewBox="-1 -1 2 2"
    style={{
      position: "absolute",
      left: x - r,
      top: y - r,
      rotate: `${turn}deg`,
    }}
  >
    <polygon
      fill={color}
      points={Array.from({ length: 48 }, (_, i) => {
        const a = (i * Math.PI) / 24;
        const s = i % 2 ? 0.72 : 1;
        return `${Math.cos(a) * s},${Math.sin(a) * s}`;
      }).join(" ")}
    />
  </svg>
);
export const Ring = ({
  x,
  y,
  r = 600,
  color = C.navy,
  opacity = 0.12,
}: {
  x: number;
  y: number;
  r?: number;
  color?: string;
  opacity?: number;
}) => (
  <div
    style={{
      position: "absolute",
      left: x - r / 2,
      top: y - r / 2,
      width: r,
      height: r,
      border: `2px solid ${color}`,
      borderRadius: "50%",
      opacity,
    }}
  />
);
export const Footer = ({
  text = "FLIP7 COMPANION",
  dark = false,
}: {
  text?: string;
  dark?: boolean;
}) => (
  <div
    style={{
      position: "absolute",
      left: 80,
      right: 80,
      bottom: 48,
      display: "flex",
      justifyContent: "space-between",
      fontSize: 18,
      letterSpacing: 3,
      fontWeight: 700,
      color: dark ? C.cream : C.navy,
      opacity: 0.75,
    }}
  >
    <span>{text}</span>
    <span>YOUR TABLE. YOUR GAME NIGHT.</span>
  </div>
);
export const Wipe = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {[C.pink, C.yellow, C.navy].map((c, i) => (
        <div
          key={c}
          style={{
            position: "absolute",
            top: -300,
            left: 0,
            width: 2350,
            height: 1800,
            background: c,
            transform: `translateX(${interpolate(f, [i * 2, 12 + i * 2, 24 + i * 2], [2400, 0, -2600], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px) skewX(-14deg)`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
