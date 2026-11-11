import {
  dstep,
  isSimple,
  isWhitePc,
  letterCells,
  midiOf,
  natural,
  noteKo,
  spellings,
} from "../theory";
import type { Ticket } from "../game/generator";
import type { Phase, Route } from "../game/types";
import { popoSvg } from "./assets";
import "./stage.css";

export type StageModel = {
  ticket: Ticket | null;
  pos: number;
  fpos: number;
  phase: Phase;
  assist: boolean;
  reveal: number;
  route: Route;
  face?: number;
  dragging?: boolean;
  tunnel?: boolean;
};
export type StageGeometry = {
  W: number;
  H: number;
  yR: number;
  padX: number;
  vis: number;
  lo: number;
};
const NS = "http://www.w3.org/2000/svg";
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
function attrs(node: SVGElement, values: Record<string, number | string>): void {
  Object.entries(values).forEach(([name, value]) => node.setAttribute(name, String(value)));
}
function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  values: Record<string, number | string>,
  parent: SVGElement,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  attrs(node, values);
  parent.append(node);
  return node;
}

const scenery: Record<Route, string> = {
  intro:
    '<rect width="1000" height="600" fill="#cdeeee"/><circle cx="760" cy="125" r="46" fill="#fff2b4"/><path d="M0 300Q130 170 280 280T590 255T1000 260V600H0Z" fill="#a8cfb2"/><path d="M0 350Q140 240 330 330T690 305T1000 320V600H0Z" fill="#7eb48b"/><path d="M0 410Q180 330 340 400T700 380T1000 390V600H0Z" fill="#d4dfaa"/><g fill="#fdf6e3" opacity=".85"><path d="M70 130q15-22 35-8 17-26 42-4 33-2 33 17H70Z"/><path d="M390 85q15-22 35-8 17-26 42-4 33-2 33 17H390Z"/></g><g stroke="#366f4f" stroke-width="5" fill="#5e9568"><path d="M70 335v-84m0 10-30 45h60zM900 335v-75m0 10-27 40h54z"/></g><g fill="#f9edb7"><circle cx="190" cy="405" r="3"/><circle cx="220" cy="422" r="3"/><circle cx="805" cy="413" r="3"/></g>',
  basic:
    '<rect width="1000" height="600" fill="#cdeeee"/><circle cx="800" cy="85" r="41" fill="#fff2ba"/><path d="M0 295Q170 170 370 270T750 240T1000 260V600H0Z" fill="#a7c9b5"/><path d="M0 355Q220 265 470 330T1000 295V600H0Z" fill="#90bca0"/><g stroke="#8b634b" stroke-width="3"><path d="M100 335v-92h96v92" fill="#efd4a1"/><path d="m89 247 60-53 60 53Z" fill="#b36f54"/><path d="M280 335V220h90v115" fill="#f6e7bd"/><path d="m269 225 56-43 56 43Z" fill="#d69268"/><path d="M700 330V224h106v106" fill="#efdfb5"/><path d="m687 229 66-52 66 52Z" fill="#9b6f59"/></g><g fill="#577c7b"><path d="M119 270h22v27h-22zM158 270h22v27h-22zM297 245h20v25h-20zM334 245h20v25h-20zM720 251h22v27h-22zM764 251h22v27h-22z"/></g><path d="M0 400Q280 320 500 380T1000 380V600H0Z" fill="#cee0b0"/>',
  full: '<rect width="1000" height="600" fill="#efd1b8"/><circle cx="765" cy="180" r="70" fill="#efad69"/><path d="m0 350 160-235 165 210 160-245 200 255 150-195 165 210V600H0Z" fill="#a2a8ab"/><path d="m0 405 220-250 190 218 150-210 190 225 140-235 110 212V600H0Z" fill="#7a9694"/><path d="M0 435Q160 330 350 400T740 380T1000 390V600H0Z" fill="#5f8372"/><g stroke="#50745f" stroke-width="5" fill="#60836b"><path d="M80 350V230m0 5-35 58h70zm0 35-42 65h84zM920 330V220m0 5-35 58h70zm0 35-42 65h84z"/></g><path d="M0 485Q250 390 480 445T1000 425V600H0Z" fill="#bbc59e"/>',
  ear: '<rect width="1000" height="600" fill="#24334e"/><circle cx="795" cy="105" r="35" fill="#f9e9b6"/><circle cx="808" cy="93" r="32" fill="#24334e"/><path d="m0 330 170-170 140 145 180-170 170 185 170-170 170 190V600H0Z" fill="#3b5361"/><path d="M0 390Q200 280 390 360T760 340T1000 360V600H0Z" fill="#45695f"/><path d="M0 440Q200 370 450 415T1000 395V600H0Z" fill="#759581"/><g fill="#fff0bd"><circle cx="120" cy="75" r="2"/><circle cx="230" cy="150" r="2.5"/><circle cx="410" cy="60" r="2"/><circle cx="550" cy="130" r="2"/><circle cx="670" cy="65" r="2.5"/><circle cx="930" cy="190" r="2"/></g>',
  mixed:
    '<rect width="1000" height="600" fill="#d0ddd9"/><circle cx="690" cy="195" r="57" fill="#f3d7ac"/><path d="M0 300Q200 180 370 285T750 260T1000 270V420H0Z" fill="#91afb0"/><path d="M0 345Q200 260 430 325T1000 300V460H0Z" fill="#739b9c"/><path d="M0 365h1000v235H0Z" fill="#a2c8c3"/><g fill="none" stroke="#e4eee0" stroke-width="3" opacity=".7"><path d="M30 430h170m85 35h220m110-45h180m-680 105h240m380 15h190"/></g><path d="M0 390h1000v20H0z" fill="#b3b8a4"/><g fill="none" stroke="#799383" stroke-width="10"><path d="M70 410v120m0-45q85-90 170 0m0-75v120m0-45q85-90 170 0m0-75v120m0-45q85-90 170 0m0-75v120m0-45q85-90 170 0m0-75v120m0-45q85-90 170 0m0-75v120"/></g>',
};

export function buildStage(host: HTMLElement): {
  element: HTMLElement;
  readonly geometry: StageGeometry;
  readonly builtNodes: number;
  render(model: StageModel): void;
  destroy(): void;
} {
  host.classList.add("drive-stage");
  host.setAttribute("aria-label", "기차 운전 무대. 좌우로 밀거나 아래 단추로 움직여요.");
  const svg = document.createElementNS(NS, "svg");
  attrs(svg, { "aria-hidden": "true", focusable: "false", id: "stage-svg" });
  host.append(svg);
  const background = el("g", { class: "stage-scenery" }, svg);
  const backgrounds = (Object.keys(scenery) as Route[]).map((route) => {
    const g = el("g", { "data-scenery": route }, background);
    g.innerHTML = scenery[route];
    return { route, node: g };
  });
  const legend = el("text", { x: 12, y: 22, class: "stage-legend" }, svg);
  const world = el("g", { id: "stage-world", class: "stage-world" }, svg);
  const railG = el("g", {}, world);
  const tileG = el("g", {}, world);
  const hopG = el("g", {}, world);
  const badgeG = el("g", {}, world);
  const rails = [el("rect", { fill: "#6b5138" }, railG), el("rect", { fill: "#a28c6c" }, railG)];
  const tiles: SVGRectElement[] = [];
  const names: SVGTextElement[] = [];
  const arches: SVGPathElement[] = [];
  const badges: SVGGElement[] = [];
  const hops: SVGGElement[] = [];
  const sleepers: SVGRectElement[] = [];
  for (let i = 0; i < 25; i++) {
    sleepers.push(el("rect", { fill: "#a28a6b", rx: 1 }, railG));
    const white = isWhitePc(48 + i);
    tiles.push(
      el(
        "rect",
        {
          class: `${white ? "station-platform" : "station-tunnel"}${i === 12 ? " station-center" : ""}`,
          rx: white ? 5 : 10,
          "data-cell": i,
        },
        tileG,
      ),
    );
    const name = el("text", { class: "station-name" }, tileG);
    const naturalName = spellings(48 + i, 0)[0];
    name.textContent = white && naturalName ? noteKo(naturalName) : "";
    names.push(name);
    arches.push(
      el(
        "path",
        { fill: "none", stroke: "#a1adbf", "stroke-width": 1, opacity: white ? 0 : 0.7 },
        tileG,
      ),
    );
    const badge = el("g", { class: "stage-badge" }, badgeG);
    el("circle", { r: 9.3 }, badge);
    el("text", {}, badge);
    badges.push(badge);
    if (i < 24) {
      const hop = el("g", { class: "stage-hop" }, hopG);
      el("path", {}, hop);
      el("circle", { r: 7.7 }, hop);
      el("text", {}, hop);
      hops.push(hop);
    }
  }
  const buffers = [
    el(
      "path",
      { stroke: "#6b5138", "stroke-width": 4, fill: "none", "stroke-linecap": "round" },
      world,
    ),
    el(
      "path",
      { stroke: "#6b5138", "stroke-width": 4, fill: "none", "stroke-linecap": "round" },
      world,
    ),
  ];
  const flag = el("g", { class: "stage-flag", id: "stage-flag" }, world);
  el("line", { x1: 0, y1: -3, x2: 0, y2: -51, stroke: "#6b5138", "stroke-width": 2.5 }, flag);
  el("path", { d: "M0-51 19-44 0-37Z", fill: "#b33c38" }, flag);
  const train = el("g", { id: "train", class: "stage-train", "data-testid": "train" }, world);
  const body = el("g", { id: "train-body" }, train);
  el("path", { d: "M-25-4h49l5 5h-58Z", fill: "#26384b" }, body);
  el("rect", { x: -24, y: -30, width: 19, height: 26, rx: 3, fill: "#bb5d37" }, body);
  el("path", { d: "M-27-31q13-7 25 0v3h-25Z", fill: "#24354a" }, body);
  el("rect", { x: -20, y: -26, width: 11, height: 11, rx: 2, fill: "#fff3ca" }, body);
  el("path", { d: "M-15-26v11m-5-5h11", stroke: "#c39261", "stroke-width": 1 }, body);
  el("rect", { x: -7, y: -22, width: 31, height: 17, rx: 7, fill: "#e77b43" }, body);
  el(
    "path",
    { d: "M-1-18h18", stroke: "#f4ae67", "stroke-width": 3, "stroke-linecap": "round" },
    body,
  );
  el("rect", { x: 12, y: -34, width: 7, height: 14, rx: 2, fill: "#29394d" }, body);
  el("rect", { x: 10, y: -36, width: 11, height: 4, rx: 1.5, fill: "#29394d" }, body);
  el(
    "circle",
    { cx: 24, cy: -13, r: 4, fill: "#f1ca62", stroke: "#976133", "stroke-width": 1.5 },
    body,
  );
  el("path", { d: "m25-6 6 6H21Z", fill: "#ab5033" }, body);
  const wheels = [-17, -2, 14].map((cx) => {
    const g = el("g", { transform: `translate(${cx} -3)` }, body);
    el("circle", { r: 6, fill: "#25374b", stroke: "#fdf6e3", "stroke-width": 1 }, g);
    const spokes = el("g", {}, g);
    el("path", { d: "M-4 0h8M0-4v8", stroke: "#8d9b94", "stroke-width": 1.3 }, spokes);
    el("circle", { r: 1.7, fill: "#e9bd59" }, spokes);
    return spokes;
  });
  el("path", { d: "M-17-3h31", stroke: "#f0d1a5", "stroke-width": 1.7 }, body);
  const puffs = [
    el("circle", { class: "stage-puff", cx: 15, cy: -42, r: 5, fill: "#fffdf1", opacity: 0 }, body),
    el("circle", { class: "stage-puff", cx: 9, cy: -49, r: 4, fill: "#fffdf1", opacity: 0 }, body),
  ];
  const bubble = el("g", { class: "stage-bubble", id: "bubble" }, world);
  const bubbleRect = el("rect", { y: -14, height: 28, rx: 10 }, bubble);
  const bubbleText = el("text", { y: 0 }, bubble);
  const veil = el("g", { class: "stage-night-veil" }, svg);
  const veilRect = el("rect", { x: 0, y: 0, fill: "#17243e" }, veil);
  const tunnelRim = el(
    "path",
    { fill: "none", stroke: "#56657c", "stroke-width": 15, opacity: 0.45 },
    veil,
  );
  const popo = document.createElement("div");
  popo.className = "stage-popover";
  popo.setAttribute("aria-hidden", "true");
  const expressions = (["default", "happy", "curious", "counting"] as const).map((expression) => {
    const variant = document.createElement("div");
    variant.innerHTML = popoSvg(expression);
    popo.append(variant);
    return { expression, node: variant };
  });
  host.append(popo);
  let geo: StageGeometry = { W: 28, H: 240, yR: 140, padX: 8, vis: 13, lo: 0 };
  let model: StageModel | null = null;
  let oldPos = 12;
  let oldFace = 1;
  let oldTicket: Ticket | null = null;
  let idleRaf: number | null = null;
  let idleStarted = 0;
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0;
  let height = 0;
  const builtNodes = host.querySelectorAll("*").length;

  function frame(start: number, dir: number, pos: number): number {
    if (geo.vis === 25) return 0;
    let lo = clamp(dir > 0 ? start : start - (geo.vis - 1), 0, 25 - geo.vis);
    if (pos < lo) lo = pos;
    if (pos > lo + geo.vis - 1) lo = pos - (geo.vis - 1);
    return clamp(lo, 0, 25 - geo.vis);
  }

  function layout(): void {
    const r = host.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (width === r.width && height === r.height) return;
    width = r.width;
    height = r.height;
    const vis = width >= 666 ? 25 : 13;
    const W = Math.min(44, Math.floor((width - 12) / vis));
    const yR = clamp(Math.round(height * 0.52), 110, Math.round(height - 98));
    geo = { ...geo, W, H: height, yR, padX: (width - vis * W) / 2, vis };
    attrs(svg, { viewBox: `0 0 ${width} ${height}` });
    attrs(background, { transform: `scale(${width / 1000} ${height / 600})` });
    rails.forEach((rail, k) => attrs(rail, { x: -W, y: yR + k * 5, width: 27 * W, height: 3 - k }));
    for (let i = 0; i < 25; i++) {
      const x = i * W;
      const white = isWhitePc(48 + i);
      attrs(sleepers[i]!, { x: x + W / 2 - 2.5, y: yR - 2, width: 5, height: 11 });
      attrs(tiles[i]!, {
        x: x + 1.5,
        y: yR + (white ? 12 : 17),
        width: W - 3,
        height: white ? 33 : 24,
      });
      attrs(names[i]!, {
        x: x + W / 2,
        y: yR + 29,
        "font-size": clamp(Math.round(W * 0.5), 12, 16),
      });
      attrs(arches[i]!, { d: `M${x + 5} ${yR + 37}v-8q${W / 2 - 5} -15 ${W - 10} 0v8` });
      attrs(badges[i]!, { transform: `translate(${x + W / 2} ${yR + 58})` });
      if (i < 24) {
        const h = hops[i]!;
        const x0 = x + W / 2;
        const x1 = x0 + W;
        attrs(h.children[0] as SVGElement, {
          d: `M${x0 + 2} ${yR + 92}Q${(x0 + x1) / 2} ${yR + 75} ${x1 - 2} ${yR + 92}`,
        });
        attrs(h.children[1] as SVGElement, { cx: (x0 + x1) / 2, cy: yR + 78 });
        attrs(h.children[2] as SVGElement, { x: (x0 + x1) / 2, y: yR + 78 });
      }
    }
    attrs(buffers[0]!, { d: `M1 ${yR - 7}v17m-5-13h10` });
    attrs(buffers[1]!, { d: `M${25 * W - 1} ${yR - 7}v17m-5-13h10` });
    attrs(veilRect, { width, height });
    attrs(tunnelRim, {
      d: `M-10 ${height}V${height * 0.8}Q-10 -${height * 0.35} ${width / 2} 5Q${width + 10} -${height * 0.35} ${width + 10} ${height * 0.8}V${height}`,
    });
  }

  function render(next: StageModel): void {
    model = next;
    layout();
    const t = next.ticket;
    const start = t?.start ?? 12;
    const dir = t?.dir ?? 1;
    geo.lo = frame(start, dir, next.pos);
    host.dataset.route = next.route;
    host.dataset.tunnel = String(next.tunnel ?? false);
    host.classList.toggle("dragging", !!next.dragging);
    host.dataset.phase = next.phase;
    backgrounds.forEach(({ route, node }) =>
      node.setAttribute("display", route === next.route ? "inline" : "none"),
    );
    const expression =
      next.phase === "show"
        ? "counting"
        : next.phase === "verify"
          ? "happy"
          : next.phase === "fix"
            ? "curious"
            : "default";
    expressions.forEach(({ expression: key, node }) => {
      node.hidden = key !== expression;
    });
    legend.textContent = next.tunnel
      ? "터널 안 · 두 음을 들어 보세요"
      : next.phase === "show"
        ? "포포가 하나씩 세어 줄게요"
        : "흰 역은 글자 · 한 칸은 반음";
    world.style.transform = `translateX(${geo.padX - geo.lo * geo.W}px)`;
    const tx = (next.fpos + 0.5) * geo.W;
    positionTrain(tx);
    const face =
      next.face ??
      (next.pos !== oldPos ? Math.sign(next.pos - oldPos) : t !== oldTicket ? dir : oldFace);
    body.setAttribute("transform", `scale(${(face || 1) * 0.88} 0.88)`);
    oldFace = face || 1;
    wheels.forEach((wheel) => wheel.setAttribute("transform", `rotate(${next.fpos * 70})`));
    if (next.pos !== oldPos) {
      puffs.forEach((puff, i) => {
        puff.classList.remove("go");
        void puff.getBoundingClientRect();
        puff.classList.add("go");
        puff.style.animationDelay = `${i * 75}ms`;
      });
    }
    let label = spellings(48 + next.pos, 1)
      .filter(isSimple)
      .map(noteKo)
      .join(" / ");
    if (t && next.pos === t.start) label = noteKo(t.startNote);
    if (
      t &&
      next.pos === t.target &&
      (next.phase === "verify" || next.phase === "judge" || t.kind === "read")
    )
      label = noteKo(t.targetNote);
    bubbleText.textContent = label;
    const bw = Math.max(38, label.length * 13 + 16);
    const bx = clamp(
      tx,
      geo.lo * geo.W - geo.padX + bw / 2 + 4,
      (geo.lo + geo.vis) * geo.W + geo.padX - bw / 2 - 4,
    );
    bubble.style.transform = `translate(${bx}px, ${geo.yR - 61}px)`;
    attrs(bubbleRect, { x: -bw / 2, width: bw });
    tiles.forEach((tile, i) => tile.classList.toggle("station-origin", i === start));
    flag.setAttribute("class", `stage-flag${t?.kind === "read" ? " on" : ""}`);
    if (t) attrs(flag, { transform: `translate(${(t.target + 0.5) * geo.W} ${geo.yR})` });
    badges.forEach((b) => b.setAttribute("class", "stage-badge"));
    hops.forEach((h) => h.setAttribute("class", "stage-hop"));
    if (t) {
      const checking = next.phase === "verify" || next.phase === "show" || next.phase === "judge";
      const to = checking ? t.start + t.dir * Math.max(0, next.reveal) : next.pos;
      const marks = checking || next.assist || next.phase === "fix";
      const atTarget = checking && to === t.target;
      let lc = letterCells(t.startNote, t.dir, t.start, to);
      if (atTarget) {
        lc = lc.filter((x) => x.n < t.num);
        lc.push({ cell: t.target, n: t.num });
      }
      if (marks) {
        lc.forEach(({ cell, n }) => {
          const badge = badges[cell];
          if (!badge) return;
          badge.setAttribute("class", "stage-badge on");
          badge.children[1]!.textContent = String(n);
        });
        if (t.kind !== "degree" && t.kind !== "semitone" && next.assist && !checking) {
          const nat = midiOf(natural(dstep(t.startNote) + t.dir * (t.num - 1))) - 48;
          const badge = badges[nat];
          if (badge && !lc.some(({ cell }) => cell === nat)) {
            badge.setAttribute("class", "stage-badge ghost on");
            badge.children[1]!.textContent = String(t.num);
          }
        }
        if (t.kind !== "degree") {
          for (let k = 0; k < Math.abs(to - t.start); k++) {
            const seg = to >= t.start ? t.start + k : t.start - k - 1;
            const hop = hops[seg];
            if (hop) {
              hop.setAttribute("class", "stage-hop on");
              hop.children[2]!.textContent = String(k + 1);
            }
          }
        }
      }
    }
    oldPos = next.pos;
    oldTicket = t;
    syncIdle();
  }

  // The locomotive slightly overhangs a narrow station. Keep its artwork inside
  // the window while the numbered station and bubble retain the exact pitch.
  function positionTrain(tx: number): void {
    const left = geo.lo * geo.W - geo.padX;
    const right = left + width;
    const visualX = clamp(tx, left + 30, right - 30);
    train.style.transform = `translate(${visualX}px, ${geo.yR}px)`;
  }
  function reducedMotion(): boolean {
    const setting = document.documentElement.dataset.motion;
    return setting === "reduced" || (setting !== "full" && motionPreference.matches);
  }
  function stopIdle(): void {
    if (idleRaf !== null) cancelAnimationFrame(idleRaf);
    idleRaf = null;
    host.dataset.idle = "false";
  }
  function syncIdle(): void {
    const visible = host.isConnected && !host.closest("[hidden]") && width > 0;
    if (model?.ticket || !visible || reducedMotion() || document.hidden) {
      stopIdle();
      return;
    }
    if (idleRaf !== null) return;
    host.dataset.idle = "true";
    idleStarted = performance.now();
    idleRaf = requestAnimationFrame(idleFrame);
  }
  function idleFrame(now: number): void {
    if (model?.ticket || host.closest("[hidden]") || reducedMotion() || document.hidden) {
      stopIdle();
      return;
    }
    const phase = ((now - idleStarted) / 9000) % 2;
    const fraction = (1 - Math.cos(phase * Math.PI)) / 2;
    const cell = geo.lo + 1 + fraction * (geo.vis - 3);
    const tx = (cell + 0.5) * geo.W;
    positionTrain(tx);
    body.setAttribute("transform", `scale(${phase < 1 ? 0.88 : -0.88} 0.88)`);
    wheels.forEach((wheel) => wheel.setAttribute("transform", `rotate(${cell * 70})`));
    const label = spellings(48 + Math.round(cell), 1)
      .filter(isSimple)
      .map(noteKo)
      .join(" / ");
    if (bubbleText.textContent !== label) bubbleText.textContent = label;
    const bw = Math.max(38, label.length * 13 + 16);
    const bx = clamp(
      tx,
      geo.lo * geo.W - geo.padX + bw / 2 + 4,
      (geo.lo + geo.vis) * geo.W + geo.padX - bw / 2 - 4,
    );
    bubble.style.transform = `translate(${bx}px, ${geo.yR - 61}px)`;
    attrs(bubbleRect, { x: -bw / 2, width: bw });
    idleRaf = requestAnimationFrame(idleFrame);
  }
  motionPreference.addEventListener("change", syncIdle);
  document.addEventListener("visibilitychange", syncIdle);
  const observer = new ResizeObserver(() => {
    if (model) render(model);
  });
  observer.observe(host);
  return {
    element: host,
    get geometry() {
      return { ...geo };
    },
    builtNodes,
    render,
    destroy() {
      stopIdle();
      observer.disconnect();
      motionPreference.removeEventListener("change", syncIdle);
      document.removeEventListener("visibilitychange", syncIdle);
    },
  };
}
