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

const iconPaths: Record<IconName, string> = {
  sound: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  notebook: '<path d="M5 3h14v18H5zM3 7h4M3 12h4M3 17h4M10 8h5m-5 4h5m-5 4h3"/>',
  settings:
    '<path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3z"/><circle cx="12" cy="12" r="3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1.5-1.5 3m0 3v.1"/>',
  replay: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  back: '<path d="m14 5-7 7 7 7M7 12h14"/>',
  play: '<path d="m8 4 13 8-13 8z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  train:
    '<path d="M5 4h10v11H5zM15 8h5v7H3m3 5 2-3m8 3-2-3M8 8h4"/><circle cx="7" cy="16" r="2"/><circle cx="17" cy="16" r="2"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',
};

export function svgIcon(name: IconName, size = 22): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
}

export function popoSvg(expression: PopoExpression = "default"): string {
  const eyes =
    expression === "happy"
      ? '<path d="M31 39q4-6 8 0m14 0q4-6 8 0" fill="none" stroke="#302d31" stroke-width="2.5" stroke-linecap="round"/>'
      : '<ellipse cx="35" cy="38" rx="2.3" ry="3" fill="#302d31"/><ellipse cx="57" cy="38" rx="2.3" ry="3" fill="#302d31"/>';
  const mouth =
    expression === "curious"
      ? '<ellipse cx="46" cy="52" rx="3" ry="4" fill="#493526"/>'
      : '<path d="M40 50q6 8 12 0" fill="none" stroke="#493526" stroke-width="2" stroke-linecap="round"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 108" role="img" aria-label="곰 차장 포포"><g${expression === "curious" ? ' transform="rotate(-8 48 55)"' : ""}><ellipse cx="47" cy="103" rx="29" ry="4" fill="#1d4d3a" opacity=".12"/><path d="M24 76q0-21 23-21t23 21v22H24z" fill="#2b3a5c"/><path d="m37 60 10 12 10-12" fill="#fdf6e3"/><path d="m47 70-5 13 5 8 5-8z" fill="#e77b43"/><circle cx="24" cy="27" r="12" fill="#a86c43"/><circle cx="69" cy="27" r="12" fill="#a86c43"/><circle cx="24" cy="27" r="6" fill="#d7a273"/><circle cx="69" cy="27" r="6" fill="#d7a273"/><rect x="20" y="22" width="53" height="40" rx="21" fill="#c58b58"/><ellipse cx="46" cy="48" rx="14" ry="11" fill="#f0ce9d"/>${eyes}<ellipse cx="46" cy="44" rx="4" ry="3" fill="#493526"/>${mouth}<ellipse cx="27" cy="46" rx="5" ry="2.5" fill="#df9b80"/><ellipse cx="65" cy="46" rx="5" ry="2.5" fill="#df9b80"/><path d="M21 23q23-24 50 0v7H21z" fill="#1d4d3a"/><path d="M17 28h58q0 7-29 7-29 0-29-7" fill="#143a2b"/><path d="m46 14 5 5-2 7h-6l-2-7z" fill="#f0c040"/><circle cx="62" cy="78" r="3" fill="#f0c040"/><path d="m24 72-10 13 7 6 11-12m38-7 9 10-7 7-10-11" fill="#2b3a5c" stroke="#2b3a5c" stroke-width="7" stroke-linecap="round"/><circle cx="18" cy="88" r="6" fill="#c58b58"/><circle cx="76" cy="85" r="6" fill="#c58b58"/>${expression === "counting" ? '<path d="m76 85 15-42" stroke="#6b5138" stroke-width="3" stroke-linecap="round"/><circle cx="91" cy="43" r="3" fill="#e77b43"/>' : ""}</g></svg>`;
}
