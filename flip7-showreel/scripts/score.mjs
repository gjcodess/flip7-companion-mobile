import fs from "node:fs";
const sr = 48000,
  N = sr * 25,
  L = new Float64Array(N),
  R = new Float64Array(N),
  A = new Float64Array(N),
  B = new Float64Array(N);
let seed = 7;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};
const hz = (n) => 440 * 2 ** ((n - 69) / 12);
function add(t, d, fn, amp = 1, pan = 0, dst = [L, R]) {
  const st = Math.round(t * sr);
  for (let i = 0; i < d * sr && st + i < N; i++) {
    if (st + i < 0) continue;
    const v = fn(i / sr, i) * amp;
    dst[0][st + i] += v * Math.sqrt((1 - pan) / 2);
    dst[1][st + i] += v * Math.sqrt((1 + pan) / 2);
  }
}
const tone = (freq, t) => Math.sin(2 * Math.PI * freq * t);
function kick(t, a = 1) {
  add(
    t,
    0.38,
    (x) =>
      Math.sin(2 * Math.PI * (49 * x + 7 * (1 - Math.exp(-x * 40)))) *
        Math.exp(-x * 12) +
      noise() * 0.08 * Math.exp(-x * 140),
    0.65 * a,
  );
}
function snare(t) {
  add(
    t,
    0.22,
    (x) => (noise() * 0.7 + tone(180, x) * 0.25) * Math.exp(-x * 21),
    0.3,
  );
  for (let i = 0; i < 3; i++)
    add(t + i * 0.008, 0.06, (x) => noise() * Math.exp(-x * 60), 0.12, 0.2);
}
function hat(t, open = false, pan = 0.35) {
  let last = 0;
  add(
    t,
    open ? 0.24 : 0.065,
    (x) => {
      let n = noise();
      let hi = n - last;
      last = n;
      return hi * Math.exp(-x * (open ? 23 : 80));
    },
    open ? 0.095 : 0.065,
    pan,
  );
}
function bass(t, n, d = 0.22) {
  const freq = hz(n);
  add(
    t,
    d,
    (x) =>
      (tone(freq, x) + 0.3 * tone(freq * 2, x) + 0.12 * tone(freq * 3, x)) *
      Math.min(1, x * 250) *
      Math.exp(-x * 7) *
      Math.min(1, (d - x) * 100),
    0.33,
    -0.05,
  );
}
function pluck(t, n, amp = 0.1, pan = 0.2) {
  const fr = hz(n);
  add(
    t,
    0.6,
    (x) =>
      (tone(fr, x) + 0.3 * tone(fr * 2.003, x) + 0.12 * tone(fr * 3, x)) *
      Math.exp(-x * 9) *
      Math.min(1, x * 350),
    amp,
    pan,
  );
  add(
    t + 0.1875,
    0.5,
    (x) => tone(fr, x) * Math.exp(-x * 10),
    amp * 0.26,
    -pan,
  );
}
function chord(t, ns, amp = 0.09, d = 0.32) {
  ns.forEach((n, i) => {
    add(
      t,
      d,
      (x) => {
        const f = hz(n);
        return (
          (tone(f, x) + 0.23 * tone(f * 2, x) + 0.11 * tone(f * 3, x)) *
          Math.min(1, x * 80) *
          Math.exp(-x * 5) *
          Math.min(1, (d - x) * 30)
        );
      },
      amp,
      (i - 1.5) * 0.35,
    );
  });
}
const roots = [38, 41, 36, 43],
  chords = [
    [62, 65, 69, 72],
    [65, 69, 72, 76],
    [60, 64, 67, 71],
    [67, 70, 74, 77],
  ];
for (let beat = 0; beat < 44; beat++) {
  const t = beat * 0.5,
    bar = Math.floor(beat / 4),
    root = roots[bar % 4];
  if (t >= 2) {
    kick(t, beat % 4 === 0 ? 1.2 : 1);
    if (beat % 2) snare(t);
    hat(t + 0.25, true, -0.3);
    hat(t, false, 0.3);
    hat(t + 0.125, false, -0.25);
    if (beat % 2 === 0) hat(t + 0.375, false, 0.4);
  } else {
    kick(t, beat % 2 ? 0.5 : 1);
    hat(t + 0.25);
  }
  bass(t, root, 0.23);
  if (beat % 2 === 0) bass(t + 0.375, root + 12, 0.11);
  if (beat % 4 === 3) bass(t + 0.25, root + 7, 0.18);
  if (beat % 2 === 0) chord(t + 0.25, chords[bar % 4], 0.055);
  if (t >= 3 && t < 21)
    pluck(
      t + 0.25,
      [74, 77, 81, 84, 81, 77, 79, 76][beat % 8],
      0.075,
      ((beat % 3) - 1) * 0.55,
    );
  if (beat % 8 === 7)
    for (let j = 0; j < 4; j++)
      hat(t + 0.25 + j * 0.0625, false, j % 2 ? 0.5 : -0.5);
}
// A harmonically resolved closing logo sting and spacious tail.
kick(22, 1.4);
chord(22, [62, 65, 69, 74], 0.15, 2.8);
[74, 77, 81, 86].forEach((n, i) =>
  pluck(22 + i * 0.125, n, 0.13, (i - 1.5) * 0.3),
);
for (const t of [0, 1.05, 3, 6.5, 10.5, 13, 16.5, 20]) {
  add(
    t,
    0.48,
    (x) =>
      Math.sin(2 * Math.PI * (57 * x + 4 * (1 - Math.exp(-30 * x)))) *
      Math.exp(-x * 12),
    0.48,
    0,
    [A, B],
  );
  add(t, 0.1, (x) => noise() * Math.exp(-x * 60), 0.23, 0.15, [A, B]);
}
for (const t of [2.7, 6.2, 10.2, 12.7, 16.2, 19.5])
  add(t, 0.3, (x) => noise() * (x / 0.3) ** 2 * 0.22, 0.7, -0.2, [A, B]);
for (const t of [7.1, 7.3, 7.5, 7.7, 7.9])
  add(
    t,
    0.06,
    (x) => (noise() * 0.2 + tone(1700, x) * 0.3) * Math.exp(-x * 85),
    0.2,
    0.4,
    [A, B],
  );
function write(name, l, r) {
  let peak = 0;
  for (let i = 0; i < N; i++)
    peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
  const out = Buffer.alloc(44 + N * 4);
  out.write("RIFF");
  out.writeUInt32LE(out.length - 8, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(2, 22);
  out.writeUInt32LE(sr, 24);
  out.writeUInt32LE(sr * 4, 28);
  out.writeUInt16LE(4, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    const t = i / sr,
      fade = Math.min(1, (25 - t) / 0.9),
      gain = (0.88 / Math.max(peak, 1)) * fade;
    out.writeInt16LE(Math.round(Math.tanh(l[i] * gain) * 32767), 44 + i * 4);
    out.writeInt16LE(Math.round(Math.tanh(r[i] * gain) * 32767), 46 + i * 4);
  }
  fs.writeFileSync("public/audio/" + name + ".wav", out);
  console.log(name, peak);
}
write("music", L, R);
write("accents", A, B);
