import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

// CI uses its local production preview. Managed QA must supply the provisioned
// preview URL; this runner never creates an additional managed preview server.
let server;
let browser;
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const viewports = [
  [360, 640],
  [390, 664],
  [390, 844],
];
const results = [];
const requested = process.env.E2E_CASES?.split(",");
const wanted = (id) => !requested || requested.includes(id);
const routeIds = ["intro", "basic", "full", "ear", "mixed"];
const routeArtwork = {
  intro: "/art/meadow.webp",
  basic: "/art/village.webp",
  full: "/art/mountains.webp",
  ear: "/art/night-tunnel.webp",
  mixed: "/art/sea-bridge.webp",
};
const artworkPaths = [
  "/art/title-hero.webp",
  "/art/route-map.webp",
  ...Object.values(routeArtwork),
];
const spellingFixture = {
  kind: "make",
  start: 12,
  target: 15,
  dir: 1,
  num: 3,
  startNote: { letter: 0, acc: 0, octave: 4 },
  targetNote: { letter: 2, acc: -1, octave: 4 },
  iv: { num: 3, quality: "m", semis: 3 },
  title: "단3도 ↑",
  sub: "글자를 세고 반음 수를 맞춰요.",
  itemKey: "make:m3",
  choices: [],
  respelled: false,
  presentation: "up",
};
const qualityKo = { P: "완전", M: "장", m: "단", A: "증", d: "감", AA: "겹증", dd: "겹감" };
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const name = (ticket) =>
  ticket.kind === "ear" && ticket.iv.semis === 6
    ? "증4도/감5도"
    : `${qualityKo[ticket.iv.quality]}${ticket.iv.num}도`;
function save(overrides = {}) {
  return {
    version: 3,
    settings: {
      volume: 0.75,
      muted: false,
      vibration: false,
      motion: "reduced",
      assist: true,
      tutorialSeen: true,
    },
    mastery: {},
    routes: Object.fromEntries(
      routeIds.map((route) => [
        route,
        { stars: route === "basic" || route === "ear" ? 1 : 0, runs: route === "basic" ? 2 : 0 },
      ]),
    ),
    stats: { runs: 0, tickets: 0, clean: 0, bestStreak: 0 },
    activeRun: null,
    ...overrides,
  };
}
function audioSpy() {
  window.__driveAudio = [];
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  const original = Ctor.prototype.createOscillator;
  Ctor.prototype.createOscillator = function (...args) {
    const oscillator = original.apply(this, args);
    const record = { frequency: 0, time: 0, stops: [] };
    const setValue = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
    oscillator.frequency.setValueAtTime = (value, time) => {
      record.frequency = value;
      return setValue(value, time);
    };
    const start = oscillator.start.bind(oscillator);
    oscillator.start = (time = 0) => {
      record.time = time;
      window.__driveAudio.push(record);
      start(time);
    };
    const stop = oscillator.stop.bind(oscillator);
    oscillator.stop = (time) => {
      record.stops.push(time ?? null);
      stop(time);
    };
    return oscillator;
  };
}
async function waitFor(fn, timeout = 8000) {
  const end = Date.now() + timeout;
  let value;
  while (Date.now() < end) {
    value = await fn();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`condition not reached (${timeout}ms): ${String(value)}`);
}
async function readSave(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("ijs_save_v3") || "null"));
}
async function checkpoint(page) {
  return (await readSave(page))?.activeRun?.checkpoint;
}
async function ticket(page) {
  return waitFor(async () => (await checkpoint(page))?.ticket);
}
async function phase(page, expected) {
  await waitFor(async () => (await checkpoint(page))?.phase === expected);
}
async function action(page, value) {
  await page.locator(`[data-action="${value}"]:visible`).first().click();
}
async function start(page, route = "intro") {
  await action(page, "routes");
  await action(page, `start-${route}`);
  await ticket(page);
}
async function decodeArtwork(page) {
  const decoded = await page.evaluate(async (paths) => {
    return Promise.all(
      paths.map(async (path) => {
        const url = new URL(path, location.href);
        const response = await fetch(url);
        const bytes = await response.arrayBuffer();
        const image = new Image();
        image.src = url.href;
        await image.decode();
        return {
          path,
          sameOrigin: new URL(response.url).origin === location.origin,
          status: response.status,
          type: response.headers.get("content-type"),
          bytes: bytes.byteLength,
          width: image.naturalWidth,
          height: image.naturalHeight,
        };
      }),
    );
  }, artworkPaths);
  assert.equal(decoded.length, 7);
  for (const art of decoded) {
    assert.ok(art.sameOrigin, `${art.path} must stay on the game origin`);
    assert.equal(art.status, 200, `${art.path} response`);
    assert.match(art.type ?? "", /^image\/webp(?:;|$)/, `${art.path} type`);
    assert.ok(art.bytes > 0 && art.width > 0 && art.height > 0, `${art.path} must decode`);
  }
}
async function keyAction(page, wanted) {
  for (let i = 0; i < 50; i++) {
    const current = await page.evaluate(() => document.activeElement?.getAttribute("data-action"));
    if (current === wanted) {
      await page.keyboard.press("Enter");
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error(`keyboard could not focus ${wanted}`);
}
async function moveToTarget(page, t) {
  const current = (await readSave(page)).activeRun.pos;
  if (current === t.target) return;
  const key = t.target > current ? "ArrowRight" : "ArrowLeft";
  const steps = t.kind === "degree" ? t.num - 1 : Math.abs(t.target - current);
  for (let i = 0; i < steps; i++) await page.keyboard.press(key);
}
async function solve(page, { keyboard = false } = {}) {
  const t = await ticket(page);
  if (t.kind === "ear") {
    const cp = await checkpoint(page);
    if (!cp.earDirectionAnswered) await action(page, t.dir > 0 ? "direction-up" : "direction-down");
    await page.getByRole("button", { name: name(t), exact: true }).click();
  } else {
    await moveToTarget(page, t);
    await page.keyboard.press("Enter");
    if (t.kind === "read") await page.getByRole("button", { name: name(t), exact: true }).click();
  }
  await phase(page, "verify");
  if (keyboard) await keyAction(page, "next");
  return t;
}
async function expandedTextAudit(page) {
  for (const [width, height] of [
    [390, 664],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "130%";
    });
    await waitFor(async () => (await page.locator("#stage").boundingBox())?.height >= 210);
    for (const state of ["drive", "verify"]) {
      if (state === "verify") await solve(page);
      const bounds = await page.evaluate(() => {
        const inside = (inner, outer) =>
          inner.x >= outer.x - 1 &&
          inner.y >= outer.y - 1 &&
          inner.right <= outer.right + 1 &&
          inner.bottom <= outer.bottom + 1;
        const readout = document.querySelector("#readout");
        const range = document.createRange();
        range.selectNodeContents(readout);
        const textFits = inside(range.getBoundingClientRect(), readout.getBoundingClientRect());
        const card = document.querySelector("#ticket").getBoundingClientRect();
        const ticketFits = ["#ticket-kind", "#ticket-title", "#ticket-sub"].every((selector) => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return !rect.height || inside(rect, card);
        });
        const viewport = { x: 0, y: 0, right: innerWidth, bottom: innerHeight };
        return {
          textFits,
          ticketFits,
          controlsFit: [...document.querySelectorAll("#controls button")].every((el) =>
            inside(el.getBoundingClientRect(), viewport),
          ),
          width: innerWidth,
          height: innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
        };
      });
      assert.ok(
        bounds.textFits &&
          bounds.ticketFits &&
          bounds.controlsFit &&
          bounds.scrollWidth <= width &&
          bounds.scrollHeight <= height,
        `130% ${state}: ${JSON.stringify(bounds)}`,
      );
    }
    await action(page, "next");
  }
}
async function geometry(page) {
  return page.evaluate(() => ({
    w: innerWidth,
    h: innerHeight,
    sw: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    sh: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
  }));
}
async function runCase(id, viewport, fn, initialSave = save()) {
  const context = await browser.newContext({
    viewport: { width: viewport[0], height: viewport[1] },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  context.setDefaultTimeout(6000);
  const page = await context.newPage();
  const external = [];
  const errors = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && url.origin !== new URL(base).origin)
      external.push(url.href);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(audioSpy);
  await page.addInitScript((initial) => {
    if (!sessionStorage.getItem("drive-e2e-seeded")) {
      localStorage.clear();
      localStorage.setItem("ijs_save_v3", JSON.stringify(initial));
      sessionStorage.setItem("drive-e2e-seeded", "1");
    }
  }, initialSave);
  const at = Date.now();
  try {
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator("#screen").waitFor();
    await fn({ page, context, external });
    assert.deepEqual(errors, [], "uncaught browser errors");
    results.push({
      id,
      viewport: viewport.join("x"),
      status: "PASS",
      milliseconds: Date.now() - at,
    });
    console.log(`PASS ${id} ${viewport.join("x")}`);
  } catch (error) {
    results.push({ id, viewport: viewport.join("x"), status: "FAIL", error: error.message });
    await page
      .screenshot({ path: `test-results/${id}-${viewport.join("x")}.png`, fullPage: true })
      .catch(() => undefined);
    console.error(`FAIL ${id} ${viewport.join("x")}: ${error.message}`);
  } finally {
    await context.close();
  }
}
const scenarios = {
  "E-01": async ({ page }) => {
    await start(page);
    const train = page.locator("#train");
    const rect = await train.boundingBox();
    const stage = await page.locator("#stage").boundingBox();
    assert.ok(
      rect && stage && rect.x >= stage.x - 1 && rect.x + rect.width <= stage.x + stage.width + 1,
      "train inside stage at departure",
    );
  },
  "E-02": async ({ page }) => {
    await start(page);
    await page.evaluate(() => {
      window.__stage = document.querySelector("#stage");
      window.__live = document.querySelector("#live");
      window.__nodes = [...window.__stage.querySelectorAll("*")];
    });
    const box = await page.locator("#stage").boundingBox();
    const pointer = {
      pointerId: 11,
      pointerType: "touch",
      isPrimary: true,
      clientX: box.x + box.width / 2,
      clientY: box.y + 30,
      buttons: 1,
    };
    await page.dispatchEvent("#stage", "pointerdown", pointer);
    await page.dispatchEvent("#stage", "pointermove", {
      ...pointer,
      clientX: pointer.clientX + 52,
    });
    await page.dispatchEvent("#stage", "pointerup", {
      ...pointer,
      clientX: pointer.clientX + 52,
      buttons: 0,
    });
    await waitFor(async () => (await readSave(page)).activeRun.pos !== 12);
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.evaluate(
        () =>
          window.__stage === document.querySelector("#stage") &&
          window.__live === document.querySelector("#live") &&
          window.__nodes.every(
            (node, index) => node === window.__stage.querySelectorAll("*")[index],
          ),
      ),
      true,
    );
    const g = await geometry(page);
    assert.ok(g.sw <= g.w && g.sh <= g.h, JSON.stringify(g));
  },
  "E-03": async ({ page }) => {
    await start(page);
    const t = await ticket(page);
    await moveToTarget(page, t);
    await page.evaluate(() => {
      window.__driveAudio = [];
    });
    await page.keyboard.press("Enter");
    await phase(page, "verify");
    const events = await waitFor(async () => {
      const all = await page.evaluate(() => window.__driveAudio);
      return all.length >= 4 ? all.slice(-4) : null;
    });
    assert.ok(Math.abs(events[0].frequency - hz(48 + t.start)) < 0.01);
    assert.ok(Math.abs(events[1].frequency - hz(48 + t.target)) < 0.01);
    assert.ok(Math.abs(events[1].time - events[0].time - 0.62) < 0.002);
    assert.ok(Math.abs(events[2].time - events[0].time - 1.42) < 0.002);
    assert.equal(events[2].time, events[3].time);
  },
  "E-04": async ({ page }) => {
    await start(page, "ear");
    await page.evaluate(() => {
      window.__driveAudio = [];
    });
    await action(page, "replay");
    const all = await page.evaluate(() => window.__driveAudio);
    assert.ok(all.length >= 2);
    assert.ok((await checkpoint(page)).replays >= 1);
  },
  "E-05": async ({ page }) => {
    await start(page, "ear");
    const t = await ticket(page);
    assert.equal(t.choices.length, 12);
    for (const label of t.choices) {
      const box = await page.getByRole("button", { name: label, exact: true }).boundingBox();
      assert.ok(
        box && box.y >= 0 && box.y + box.height <= (await geometry(page)).h,
        `${label} outside viewport`,
      );
      assert.ok(box.height >= 48);
    }
  },
  "E-06": async ({ page }) => {
    await action(page, "notebook");
    await action(page, "back");
    await start(page);
    await waitFor(() => page.evaluate(() => window.__driveAudio.length >= 1));
  },
  "E-07": async ({ page }) => {
    await start(page, "ear");
    await page.evaluate(() => {
      window.__driveAudio = [];
    });
    await action(page, "replay");
    await action(page, "replay");
    const all = await page.evaluate(() => window.__driveAudio);
    assert.ok(all.length >= 4);
    assert.ok(
      all.slice(0, 2).every((event) => event.stops.includes(null)),
      "previous audio group cancelled",
    );
  },
  "E-08": async ({ page }) => {
    await action(page, "resume");
    const t = await ticket(page);
    assert.equal(t.iv.quality, "m");
    assert.equal(t.iv.num, 3);
    assert.equal(t.targetNote.acc, -1);
    await solve(page);
    const bubble = await page.locator("#bubble").textContent();
    assert.match(bubble, /♭/);
    assert.match(await page.locator("#readout").textContent(), /단3도/);
  },
  "E-09": async ({ page }) => {
    for (const screen of ["title", "routes", "notebook", "settings", "run"]) {
      if (screen === "routes") await action(page, "routes");
      else if (["notebook", "settings"].includes(screen)) await action(page, screen);
      else if (screen === "run") await start(page);
      const problems = await page.evaluate(() =>
        [...document.querySelectorAll("#screen *")]
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            return (
              rect.width &&
              rect.height &&
              getComputedStyle(el).visibility !== "hidden" &&
              el.childNodes.length &&
              [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())
            );
          })
          .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12)
          .map((el) => el.outerHTML.slice(0, 120)),
      );
      assert.deepEqual(problems, [], `${screen} text below 12px`);
      if (screen === "notebook" || screen === "settings") await action(page, "back");
    }
    const buttons = await page
      .locator("#controls button")
      .evaluateAll((els) =>
        els
          .filter((el) => el.getBoundingClientRect().height)
          .map((el) => el.getBoundingClientRect().height),
      );
    assert.ok(buttons.every((height) => height >= 48));
    await action(page, "pause");
    await action(page, "settings");
    await page.locator("#muted").check();
    await action(page, "back");
    await expandedTextAudit(page);
    for (const route of ["full", "basic"]) {
      await action(page, "pause");
      await action(page, "routes");
      await action(page, `start-${route}`);
      await ticket(page);
      await expandedTextAudit(page);
    }
  },
  "E-10": async ({ page }) => {
    await start(page);
    for (const [width, height] of [
      [320, 568],
      [360, 600],
      [360, 640],
      [390, 664],
      [390, 844],
      [430, 932],
    ]) {
      await page.setViewportSize({ width, height });
      const g = await geometry(page);
      assert.ok(g.sw <= g.w && g.sh <= g.h, JSON.stringify(g));
    }
  },
  "E-11": async ({ page, context }) => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await waitFor(() => page.evaluate(async () => Boolean(await caches.match("/index.html"))));
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("#screen").getAttribute("data-screen"), "title");
    await action(page, "routes");
    assert.ok(await page.locator('[data-action="start-intro"]').isVisible());
  },
  "E-12": async ({ page }) => {
    await start(page);
    await page.keyboard.press("Enter");
    const before = await readSave(page);
    assert.equal(before.activeRun.checkpoint.mistakes, 1);
    await page.reload({ waitUntil: "networkidle" });
    await action(page, "resume");
    const after = await readSave(page);
    assert.equal(after.activeRun.pos, before.activeRun.pos);
    assert.equal(after.activeRun.checkpoint.mistakes, 1);
    assert.deepEqual(after.activeRun.results, before.activeRun.results);
    await page.locator("#controls button").nth(1).click();
    await solve(page);
    const mastered = await readSave(page);
    await page.reload({ waitUntil: "networkidle" });
    assert.deepEqual((await readSave(page)).mastery, mastered.mastery);
  },
  "E-13": async ({ page }) => {
    await keyAction(page, "routes");
    await keyAction(page, "start-intro");
    for (let i = 0; i < 7; i++) await solve(page, { keyboard: true });
    assert.equal(await page.locator("#screen").getAttribute("data-screen"), "terminus");
  },
  "E-14": async ({ page }) => {
    await start(page);
    const durations = await page
      .locator("#stage *")
      .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).transitionDuration));
    assert.ok(
      durations.every((duration) => duration.split(",").every((value) => parseFloat(value) === 0)),
      "reduced motion transitions must be zero",
    );
  },
  "E-15": async ({ page, external }) => {
    await start(page);
    await solve(page);
    assert.deepEqual(external, [], "no external requests");
  },
};

const routeLengths = { basic: 6, full: 12, ear: 6, mixed: 9 };
const extraScenarios = Object.fromEntries(
  Object.entries(routeLengths).map(([route, length]) => [
    `RUN-${route}`,
    async ({ page }) => {
      await start(page, route);
      for (let i = 0; i < length; i++) {
        await solve(page);
        await action(page, "next");
      }
      assert.equal(await page.locator("#screen").getAttribute("data-screen"), "terminus");
      const saved = await readSave(page);
      assert.equal(saved.stats.tickets, length);
      assert.ok(saved.routes[route].stars >= 2);
      assert.equal(saved.activeRun, null);
    },
  ]),
);
async function renderedBackgrounds(page, selector) {
  return page
    .locator(selector)
    .evaluate((root) =>
      [root, ...root.querySelectorAll("*")].flatMap((element) =>
        [null, "::before", "::after"].map(
          (pseudo) => getComputedStyle(element, pseudo).backgroundImage,
        ),
      ),
    );
}
const remasterScenarios = {
  "R-01": async ({ page }) => {
    await decodeArtwork(page);
  },
  "R-02": async ({ page }) => {
    assert.ok(
      (await renderedBackgrounds(page, "#pages")).some((image) =>
        image.includes("/art/title-hero.webp"),
      ),
      "title uses the approved hero artwork",
    );
    await action(page, "routes");
    assert.ok(
      (await renderedBackgrounds(page, "#pages")).some((image) =>
        image.includes("/art/route-map.webp"),
      ),
      "route selection uses the approved map artwork",
    );
    for (const route of routeIds) {
      const card = page.locator(`.route[data-route="${route}"]`);
      assert.equal(await card.count(), 1, `${route} route card`);
      assert.ok(
        (await card.locator(`[data-asset="route-${route}"] path`).count()) > 0,
        `${route} uses its imported route token`,
      );
    }
    for (const route of routeIds) {
      await action(page, `start-${route}`);
      await ticket(page);
      assert.equal(await page.locator("#stage").getAttribute("data-route"), route);
      assert.ok(
        (
          await page
            .locator("#stage")
            .evaluate((element) => getComputedStyle(element).backgroundImage)
        ).includes(routeArtwork[route]),
        `${route} uses its approved stage background`,
      );
      const locomotive = page.locator('#train [data-asset="locomotive-right"]');
      assert.equal(await locomotive.count(), 1);
      assert.ok((await locomotive.locator("path").count()) >= 15, "imported locomotive geometry");
      assert.equal(await locomotive.locator(".wheel").count(), 3, "three imported train wheels");
      assert.equal(
        await locomotive.locator('[id*="locomotive-right-hatch"]').count(),
        1,
        "imported locomotive definitions survive namespacing",
      );
      await action(page, "pause");
      await action(page, "routes");
    }
  },
  "R-03": async ({ page, context }) => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await waitFor(() => page.evaluate(() => !!navigator.serviceWorker.controller));
    await waitFor(() =>
      page.evaluate(async (paths) => {
        const entries = await Promise.all(paths.map((path) => caches.match(path)));
        return entries.every((response) => response?.ok);
      }, artworkPaths),
    );
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('#screen[data-screen="title"]').waitFor({ state: "visible" });
    await decodeArtwork(page);
    await start(page);
    assert.ok(
      (
        await page
          .locator("#stage")
          .evaluate((element) => getComputedStyle(element).backgroundImage)
      ).includes(routeArtwork.intro),
      "offline reload retains the meadow artwork",
    );
    assert.equal(await page.locator('#train [data-asset="locomotive-right"]').count(), 1);
  },
};
async function tutorial({ page }) {
  await action(page, "tutorial");
  await page.getByRole("dialog").waitFor({ state: "visible" });
  await action(page, "sound-yes");
  assert.equal(await page.locator("#ticket-title").textContent(), "위로 3도");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.locator("#next").waitFor({ state: "visible" });
  assert.match(await page.locator("#readout").textContent(), /정답/);
  await action(page, "next");
  assert.equal(await page.locator("#screen").getAttribute("data-screen"), "routes");
  const stored = await readSave(page);
  assert.deepEqual(stored.mastery, {});
  assert.equal(stored.stats.tickets, 0);
  assert.equal(stored.activeRun, null);
}
async function warmup({ page }) {
  await action(page, "routes");
  await action(page, "start-basic");
  for (let i = 0; i < 2; i++) {
    await waitFor(
      async () => (await page.locator("#ticket").getAttribute("data-kind")) === "semitone",
    );
    const label = await page.locator("#ticket-title").textContent();
    const count = Number(/(\d+)반음/.exec(label)?.[1]);
    assert.ok(count === 1 || count === 2);
    for (let step = 0; step < count; step++)
      await page.keyboard.press(label.startsWith("위로") ? "ArrowRight" : "ArrowLeft");
    await page.keyboard.press("Enter");
    await page.locator("#next").waitFor({ state: "visible" });
    const stored = await readSave(page);
    assert.deepEqual(stored.mastery, {});
    assert.equal(stored.stats.tickets, 0);
    assert.equal(stored.activeRun, null);
    await action(page, "next");
  }
  const t = await ticket(page);
  assert.equal(t.kind, "read");
  assert.equal((await readSave(page)).activeRun.plan.length, 6);
}
async function screenshots({ page }) {
  const viewport = page.viewportSize();
  const capture = (screen) =>
    page.screenshot({
      path: `test-results/screens/${screen}-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });
  await capture("title");
  await action(page, "settings");
  await capture("settings");
  await action(page, "back");
  await action(page, "notebook");
  await capture("notebook");
  await action(page, "back");
  await action(page, "routes");
  await capture("routes");
  await action(page, "start-intro");
  await ticket(page);
  await capture("run");
  for (let i = 0; i < 7; i++) {
    await solve(page);
    await action(page, "next");
  }
  await capture("terminus");
  const smallText = await page
    .locator("#screen *")
    .evaluateAll((els) =>
      els
        .filter(
          (el) =>
            el.getBoundingClientRect().height &&
            [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) &&
            parseFloat(getComputedStyle(el).fontSize) < 12,
        )
        .map((el) => el.outerHTML.slice(0, 100)),
    );
  assert.deepEqual(smallText, [], "terminus text below 12px");
  await action(page, "routes");
  await action(page, "start-basic");
  const reading = await ticket(page);
  await moveToTarget(page, reading);
  await page.keyboard.press("Enter");
  await phase(page, "judge");
  await capture("read-judge");
  await action(page, "pause");
  await action(page, "routes");
  await action(page, "start-ear");
  const t = await ticket(page);
  if (!(await checkpoint(page)).earDirectionAnswered)
    await action(page, t.dir > 0 ? "direction-up" : "direction-down");
  await capture("ear");
}
mkdirSync("test-results", { recursive: true });
mkdirSync("test-results/screens", { recursive: true });
try {
  if (!process.env.E2E_BASE_URL) {
    assert.notEqual(
      process.env.SITES_MANAGED_LINUX_CONTAINER,
      "1",
      "Set E2E_BASE_URL to the provisioned managed preview URL",
    );
    server = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4173"], {
      stdio: "ignore",
    });
    await waitFor(
      async () =>
        fetch(base)
          .then((res) => res.ok)
          .catch(() => false),
      15000,
    );
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {}),
    args: ["--no-sandbox"],
  });
  for (const viewport of viewports)
    for (const [id, fn] of Object.entries(scenarios)) {
      if (!wanted(id)) continue;
      const initial =
        id === "E-05"
          ? save({
              mastery: Object.fromEntries(
                ["M3", "P5", "P8", "m2", "M2", "m3", "P4"].map((key) => [
                  `ear:${key}`,
                  { box: 1, stamp: 2, seen: 1, clean: 1 },
                ]),
              ),
            })
          : id === "E-08"
            ? save({
                activeRun: {
                  route: "full",
                  seed: 3,
                  plan: ["make:m3"],
                  index: 0,
                  pos: 12,
                  keepNote: [0, 0, 4],
                  results: [],
                  assistOff: false,
                  melody: [60],
                  checkpoint: {
                    ticket: spellingFixture,
                    phase: "drive",
                    mistakes: 0,
                    rulerUsed: false,
                    hunt: false,
                    earDirectionAnswered: true,
                    replays: 0,
                    reveal: 0,
                    message: spellingFixture.sub,
                    fpos: 12,
                  },
                },
              })
            : save();
      await runCase(id, viewport, fn, initial);
    }
  for (const viewport of viewports) {
    for (const [id, fn] of Object.entries(extraScenarios))
      if (wanted(id)) await runCase(id, viewport, fn);
    for (const [id, fn] of Object.entries(remasterScenarios))
      if (wanted(id)) await runCase(id, viewport, fn);
    if (wanted("TUTORIAL")) await runCase("TUTORIAL", viewport, tutorial);
    if (wanted("WARMUP")) {
      const initial = save();
      initial.routes.basic.runs = 0;
      await runCase("WARMUP", viewport, warmup, initial);
    }
    if (wanted("SCREENSHOTS")) await runCase("SCREENSHOTS", viewport, screenshots);
  }
} catch (error) {
  results.push({ status: "NOT_RUN", error: error.message });
  console.error(error.message);
} finally {
  await browser?.close();
  server?.kill();
  writeFileSync(
    "test-results/drive-e2e.json",
    JSON.stringify({ date: new Date().toISOString(), base, results }, null, 2),
  );
}
const passed = results.filter((result) => result.status === "PASS").length;
const expected =
  viewports.length *
  [
    ...Object.keys(scenarios),
    ...Object.keys(extraScenarios),
    ...Object.keys(remasterScenarios),
    "TUTORIAL",
    "WARMUP",
    "SCREENSHOTS",
  ].filter(wanted).length;
console.log(
  `E2E: ${passed}/${expected} passed (45 core cases, 12 route completions, 9 artwork checks, 3 tutorial checks, 3 warmup checks, 3 screenshot audits)`,
);
if (passed !== expected) process.exitCode = 1;
