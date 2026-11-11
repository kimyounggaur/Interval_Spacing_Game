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
import { ART } from "../assets/railway/art";
import locomotiveArt from "../assets/railway/vector/locomotive-right.svg?raw";
import naturalArt from "../assets/railway/vector/station-natural.svg?raw";
import centralArt from "../assets/railway/vector/station-central.svg?raw";
import tunnelArt from "../assets/railway/vector/tunnel-black.svg?raw";
import flagArt from "../assets/railway/vector/destination-flag.svg?raw";
import leftBufferArt from "../assets/railway/vector/buffer-left.svg?raw";
import rightBufferArt from "../assets/railway/vector/buffer-right.svg?raw";
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

// Mount the supplied artwork once. IDs stay local to the stage, and repeated
// stations reuse symbols instead of duplicating hundreds of drawing nodes.
function mountArtwork(raw: string, parent: SVGElement, prefix: string): void {
  parent.innerHTML = raw
    .slice(raw.indexOf(">") + 1, raw.lastIndexOf("</svg>"))
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/g, "")
    .replace(/id="([^"]+)"/g, `id="${prefix}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`);
}
function artSymbol(raw: string, defs: SVGDefsElement, id: string): string {
  const node = el(
    "symbol",
    {
      id,
      viewBox: raw.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 64 80",
      preserveAspectRatio: "none",
    },
    defs,
  );
  mountArtwork(raw, node, id);
  return `#${id}`;
}

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
  const defs = el("defs", {}, svg);
  const stationSymbols = {
    natural: artSymbol(naturalArt, defs, "stage-station-natural"),
    central: artSymbol(centralArt, defs, "stage-station-central"),
    tunnel: artSymbol(tunnelArt, defs, "stage-tunnel-black"),
  };
  const legend = el("text", { x: 12, y: 22, class: "stage-legend" }, svg);
  const world = el("g", { id: "stage-world", class: "stage-world" }, svg);
  const railG = el("g", {}, world);
  const tileG = el("g", {}, world);
  const hopG = el("g", {}, world);
  const badgeG = el("g", {}, world);
  const rails = [el("rect", { fill: "#6b5138" }, railG), el("rect", { fill: "#a28c6c" }, railG)];
  const tiles: SVGRectElement[] = [];
  const names: SVGTextElement[] = [];
  const stationArt: SVGUseElement[] = [];
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
    stationArt.push(
      el(
        "use",
        {
          href:
            i === 12
              ? stationSymbols.central
              : white
                ? stationSymbols.natural
                : stationSymbols.tunnel,
          "data-asset": i === 12 ? "station-central" : white ? "station-natural" : "tunnel-black",
          class: "station-art",
        },
        tileG,
      ),
    );
    const name = el("text", { class: "station-name" }, tileG);
    const naturalName = spellings(48 + i, 0)[0];
    name.textContent = white && naturalName ? noteKo(naturalName) : "";
    names.push(name);
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
    el("g", { "data-asset": "buffer-left" }, world),
    el("g", { "data-asset": "buffer-right" }, world),
  ];
  mountArtwork(leftBufferArt, buffers[0]!, "stage-buffer-left");
  mountArtwork(rightBufferArt, buffers[1]!, "stage-buffer-right");
  const flag = el(
    "g",
    { class: "stage-flag", id: "stage-flag", "data-asset": "destination-flag" },
    world,
  );
  const flagDrawing = el("g", { transform: "translate(-4 -51) scale(.64)" }, flag);
  mountArtwork(flagArt, flagDrawing, "stage-destination-flag");
  const train = el("g", { id: "train", class: "stage-train", "data-testid": "train" }, world);
  const body = el("g", { id: "train-body", "data-asset": "locomotive-right" }, train);
  const locomotive = el("g", { transform: "translate(-33 -35) scale(.26)" }, body);
  mountArtwork(locomotiveArt, locomotive, "stage-locomotive");
  const wheels = Array.from(locomotive.querySelectorAll<SVGGElement>("g.wheel")).map((wheel) => ({
    node: wheel,
    base: wheel.getAttribute("transform") ?? "",
  }));
  function rotateWheels(angle: number): void {
    wheels.forEach(({ node, base }) => node.setAttribute("transform", `${base} rotate(${angle})`));
  }
  const puffs = [
    el("circle", { class: "stage-puff", cx: 15, cy: -32, r: 4, fill: "#fff7e6", opacity: 0 }, body),
    el(
      "circle",
      { class: "stage-puff", cx: 9, cy: -39, r: 3.5, fill: "#fff7e6", opacity: 0 },
      body,
    ),
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
    rails.forEach((rail, k) => attrs(rail, { x: -W, y: yR + k * 5, width: 27 * W, height: 3 - k }));
    for (let i = 0; i < 25; i++) {
      const x = i * W;
      attrs(sleepers[i]!, { x: x + W / 2 - 2.5, y: yR - 2, width: 5, height: 11 });
      attrs(tiles[i]!, {
        x: x + 1.5,
        y: yR + 11,
        width: W - 3,
        height: 35,
      });
      attrs(names[i]!, {
        x: x + W / 2,
        y: yR + 29,
        "font-size": clamp(Math.round(W * 0.5), 12, 16),
      });
      attrs(stationArt[i]!, {
        x: x + 1.5,
        y: yR + (i === 12 ? 3 : 12),
        width: W - 3,
        height: i === 12 ? 44 : 33,
      });
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
    attrs(buffers[0]!, { transform: `translate(-7 ${yR - 13}) scale(.23)` });
    attrs(buffers[1]!, { transform: `translate(${25 * W - 9} ${yR - 13}) scale(.23)` });
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
    host.dataset.poster = String(!t);
    host.style.backgroundImage = `url("${t ? ART[next.route] : ART.hero}")`;
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
    rotateWheels(next.fpos * 70);
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
    rotateWheels(cell * 70);
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
