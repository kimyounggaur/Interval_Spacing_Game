/** Approved illustrations are self-hosted so the HTML/JS/CSS shell stays small. */
export const ART = {
  hero: "/art/title-hero.webp",
  map: "/art/route-map.webp",
  intro: "/art/meadow.webp",
  basic: "/art/village.webp",
  full: "/art/mountains.webp",
  ear: "/art/night-tunnel.webp",
  mixed: "/art/sea-bridge.webp",
} as const;
export const OFFLINE_ART = Object.values(ART);
