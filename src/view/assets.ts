/** Original Brass Railway component assets, created for Interval Station. */
export type PopoExpression = "default" | "happy" | "curious" | "counting";
export type IconName =
  | "sound"
  | "pause"
  | "notebook"
  | "settings"
  | "help"
  | "replay"
  | "back"
  | "play"
  | "close"
  | "train"
  | "star";
const sources = import.meta.glob<string>("../assets/railway/vector/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
});
let instance = 0;
const dataUrls = new Map<string, string>();
function source(name: string): string {
  const raw = sources[`../assets/railway/vector/${name}.svg`];
  if (!raw) throw new Error(`철도 에셋을 찾을 수 없어요: ${name}`);
  return raw;
}
function decorative(raw: string, name: string, prefix: string): string {
  const ids = [...raw.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]!);
  let svg = raw
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/g, "")
    .replace(/\srole="[^"]*"/g, "")
    .replace(/\saria-labelledby="[^"]*"/g, "");
  for (const id of ids) svg = svg.split(id).join(prefix + id);
  return svg.replace("<svg ", `<svg aria-hidden="true" focusable="false" data-asset="${name}" `);
}
/** Inline, namespaced decoration. All musical labels stay in the theory-driven UI. */
export function railSvg(name: string): string {
  return decorative(source(name), name, `rail-${instance++}-`);
}
/** Encoded SVG skin for CSS; stretch is reserved for resizable ticket/button frames. */
export function railAssetUrl(name: string, stretch = false): string {
  const key = `${name}:${stretch}`;
  let url = dataUrls.get(key);
  if (!url) {
    const svg = decorative(source(name), name, `skin-${name}-`).replace(
      "<svg ",
      stretch ? '<svg preserveAspectRatio="none" ' : "<svg ",
    );
    url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    dataUrls.set(key, url);
  }
  return url;
}
const ICONS: Record<IconName, string> = {
  sound: "icon-sound",
  pause: "icon-pause",
  notebook: "icon-notebook",
  settings: "icon-settings",
  help: "icon-ruler",
  replay: "icon-replay",
  back: "icon-back",
  play: "icon-play",
  close: "icon-close",
  train: "locomotive-right",
  star: "star-filled",
};
export function svgIcon(name: IconName, size = 22): string {
  return railSvg(ICONS[name])
    .replace(/\bwidth="[^"]+"/, `width="${size}"`)
    .replace(/\bheight="[^"]+"/, `height="${size}"`);
}
export function popoSvg(expression: PopoExpression = "default"): string {
  return railSvg(`popo-${expression}`);
}
