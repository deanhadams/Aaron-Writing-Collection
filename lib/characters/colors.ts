/** Six dark and six bright. Text always goes through readableColor. */
export const CHARACTER_COLORS = [
  "#B4237A", "#0F766E", "#B45309", "#4338CA", "#0369A1", "#7E22CE",
  "#FF4FA3", "#00C2A8", "#FFB020", "#7C5CFF", "#00D9FF", "#FF5A5F",
];

const HEX = /^#[0-9a-f]{6}$/i;
// Above the 4.5 of AA, because names and chips sit on a light tint of this color.
const TEXT_CONTRAST = 5.5;

export const isHexColor = (value: string) => HEX.test(value);

const channels = (hex: string) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

function luminance(rgb: number[]) {
  const [r, g, b] = rgb
    .map((value) => value / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrastOnWhite = (rgb: number[]) => 1.05 / (luminance(rgb) + 0.05);

const toHex = (rgb: number[]) =>
  `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;

/** The same hue, darkened only as far as it takes to pass AA as text. */
export function readableColor(hex: string | null) {
  if (!hex || !isHexColor(hex)) return null;

  const rgb = channels(hex);
  if (contrastOnWhite(rgb) >= TEXT_CONTRAST) return hex;

  for (let scale = 0.95; scale > 0; scale -= 0.05) {
    const darker = rgb.map((value) => value * scale);
    if (contrastOnWhite(darker) >= TEXT_CONTRAST) return toHex(darker);
  }
  return "#000000";
}

/** White or ink, whichever reads better on the color: bright picks need ink. */
export function textOnColor(hex: string | null) {
  if (!hex || !isHexColor(hex)) return "#ffffff";

  const light = luminance(channels(hex));
  const onWhite = 1.05 / (light + 0.05);
  const onInk = (light + 0.05) / (luminance(channels("#0b1b3a")) + 0.05);
  return onWhite >= onInk ? "#ffffff" : "#0b1b3a";
}
