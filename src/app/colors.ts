// Series color assignment and the ramps used by the field views.
// Series slots follow the solver identity in fixed order (registry solvers
// first, then any loaded solver ids alphabetically); a filter or rerun
// never repaints a surviving series.

import { SOLVERS } from "../solvers";

const SERIES_VARS = [
  "--series-1",
  "--series-2",
  "--series-3",
  "--series-4",
  "--series-5",
];

export function solverColorVar(solverId: string, extraIds: string[]): string {
  const known = SOLVERS.map((s) => s.id);
  const extras = [...new Set(extraIds.filter((id) => !known.includes(id)))].sort();
  const order = [...known, ...extras];
  const idx = order.indexOf(solverId);
  return `var(${SERIES_VARS[Math.max(0, idx) % SERIES_VARS.length]})`;
}

// Ramps for canvas rendering (canvas cannot read CSS variables per pixel).
// Values are the reference palette's sequential blue steps and diverging
// blue/red pair, in light- and dark-mode steppings.

const SEQ_LIGHT = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
const SEQ_DARK = ["#0d366b", "#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4", "#cde2fb"];

const DIV_LIGHT = { neg: "#2a78d6", mid: "#f0efec", pos: "#e34948" };
const DIV_DARK = { neg: "#3987e5", mid: "#383835", pos: "#e66767" };

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpStops(stops: string[], t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const c0 = hexToRgb(stops[i]);
  const c1 = hexToRgb(stops[i + 1]);
  return [lerp(c0[0], c1[0], f), lerp(c0[1], c1[1], f), lerp(c0[2], c1[2], f)];
}

export function isDarkMode(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Sequential ramp (magnitude), t in [0, 1], light means small. */
export function sequentialColor(t: number, dark: boolean): [number, number, number] {
  return interpStops(dark ? SEQ_DARK : SEQ_LIGHT, t);
}

/** Diverging ramp (polarity), t in [-1, 1], gray at 0. */
export function divergingColor(t: number, dark: boolean): [number, number, number] {
  const d = dark ? DIV_DARK : DIV_LIGHT;
  const tt = Math.min(1, Math.max(-1, t));
  if (tt < 0) return interpStops([d.neg, d.mid], 1 + tt);
  return interpStops([d.mid, d.pos], tt);
}

export function cssColor(rgb: [number, number, number]): string {
  return `rgb(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])})`;
}
