import { chromium } from "../../node_modules/playwright/index.mjs";
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
});
await page.goto("http://127.0.0.1:5173/landing");
const ids = await page.evaluate(async () => {
  const s = await import("/src/lib/room-store.ts");
  const b = await import("/src/game/bankerGame.ts");
  const d = await import("/src/game/demoGame.ts");
  const c = await import("/src/game/cards.ts");
  const v = await import("/src/game/vengeanceGame.ts");
  const vc = await import("/src/game/vengeanceCards.ts");
  const roster = ["Alex", "Mia", "Leo", "Zoe"].map((name, i) => ({
    ...s.newProfile(name, i),
    avatar: ["male-1", "female-1", "neutral-1", "female-2"][i],
  }));
  const room = s.createRoom("Friday Night Crew", 200, roster);
  s.startRoom(room);
  let state = s.getLibrary().rooms.find((r) => r.id === room.id).state;
  state = {
    ...state,
    roundNumber: 4,
    history: [1, 2, 3].map((r) => ({
      round: r,
      scores: Object.fromEntries(
        roster.map((p, i) => [
          p.id,
          [
            [42, 38, 33, 29],
            [44, 36, 32, 30],
            [40, 38, 33, 28],
          ][r - 1][i],
        ]),
      ),
    })),
    players: state.players.map((p, i) => ({
      ...p,
      totalScore: [126, 112, 98, 87][i],
    })),
  };
  for (const n of [3, 5, 7, 10, 12])
    state = b.bankerReducer(state, {
      type: "player",
      playerId: roster[0].id,
      action: {
        type: "add",
        card: c.pickerCards.find((c) => c.id === "number-" + n),
      },
    });
  s.saveRoomState(room.id, state);
  const vr = s.createRoom(
    "Vengeance Night",
    200,
    roster,
    "vengeance",
    roster[0].id,
  );
  s.startRoom(vr);
  let vs = s.getLibrary().rooms.find((r) => r.id === vr.id).vengeanceState;
  vs = {
    ...vs,
    phase: "turn",
    dealIndex: 4,
    roundNumber: 3,
    players: vs.players.map((p, i) => ({
      ...p,
      totalScore: [84, 76, 65, 52][i],
      entries: [7, 11, 13].map((n, j) => ({
        instanceId: "show-" + i + "-" + j,
        card: vc.vengeanceCards.find((c) => c.id === "v-number-" + n),
      })),
    })),
    nextId: 40,
  };
  s.saveVengeanceState(vr.id, vs);
  s.updateLibrary((l) => ({
    ...l,
    archivedStats: Object.fromEntries(
      roster.map((p, i) => [
        p.id,
        { matches: 12, wins: [5, 4, 2, 1][i], best: [247, 232, 211, 204][i] },
      ]),
    ),
  }));
  return { classic: room.id, vengeance: vr.id };
});
const shot = async (name, url) => {
  await page.goto("http://127.0.0.1:5173" + url);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "public/screens/" + name + ".png" });
  console.log(
    name + ": " + (await page.locator("body").innerText()).slice(0, 650),
  );
};
await shot("home", "/landing");
await shot("classic", "/banker?room=" + ids.classic);
await shot("crew", "/players");
await shot("scoreboard", "/room?id=" + ids.classic);
await shot("vengeance", "/vengeance?room=" + ids.vengeance);
await browser.close();
