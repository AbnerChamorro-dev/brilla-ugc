import type { CSSProperties } from "react";

// Inline SVG avoids platform-dependent Unicode/emoji fonts on iOS and Android.
const paths: Record<string, string> = {
  "✦": "M12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9Z",
  "✧": "M12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9Z",
  "✓": "m4 12 5 5L20 6",
  "＋": "M12 4v16M4 12h16",
  "+": "M12 4v16M4 12h16",
  "×": "m5 5 14 14M19 5 5 19",
  "−": "M4 12h16",
  "→": "M3 12h18m-7-7 7 7-7 7",
  "←": "M21 12H3m7-7-7 7 7 7",
  "↑": "M12 21V3m-7 7 7-7 7 7",
  "↓": "M12 3v18m-7-7 7 7 7-7",
  "↗": "M5 19 19 5M5 5h14v14",
  "↙": "M19 5 5 19M5 5v14h14",
  "↻": "M20 7a9 9 0 1 0 1 9M20 2v6h-6",
  "↺": "M4 7a9 9 0 1 1-1 9M4 2v6h6",
  "▶": "m8 4 12 8-12 8Z",
  "Ⅱ": "M8 4v16M16 4v16",
  "◉": "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  "◎": "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  "♡": "M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  "☆": "m12 2 3.1 6.3 7 .9-5.1 5 1.2 7L12 18l-6.2 3.2 1.2-7-5.1-5 7-.9Z",
  "⌂": "m3 10 9-8 9 8M5 9v12h14V9M9 21v-8h6v8",
  "⌖": "M12 2v4m0 12v4M2 12h4m12 0h4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  "✎": "m4 16 12-12 4 4L8 20H4Zm10-10 4 4",
  "❀": "M12 8C4-5 0 12 8 12c-13 8 4 12 4 4 8 13 12-4 4-4 13-8-4-12-4-4ZM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  "⌘": "M8 8H5a3 3 0 1 1 3-3v14a3 3 0 1 1-3-3h14a3 3 0 1 1-3 3V5a3 3 0 1 1 3 3H8",
  "●": "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
};

export function Icon({ glyph, style }: { glyph: string; style?: CSSProperties }) {
  const path = paths[glyph];
  if (!path) return <>{glyph}</>;
  return <svg className="brillaIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill={glyph === "▶" || glyph === "●" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ display: "inline-block", flexShrink: 0, verticalAlign: "-0.125em", ...style }}><path d={path} /></svg>;
}
