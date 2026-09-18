import type { SyntheticEvent } from "react";

type FullscreenVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

const mobileViewport = "(max-width: 700px), ((pointer: coarse) and (max-width: 1024px))";

/* On phones, playing a portfolio video opens the native fullscreen player; leaving it pauses the clip. */
export function enterMobileFullscreen(event: SyntheticEvent<HTMLVideoElement>) {
  const video = event.currentTarget as FullscreenVideo;
  if (typeof window === "undefined" || !window.matchMedia(mobileViewport).matches) return;
  if (document.fullscreenElement === video || video.webkitDisplayingFullscreen) return;
  /* The play gesture is user-initiated, so browsers allow turning the sound on here. */
  video.muted = false;
  video.volume = 1;

  if (typeof video.webkitEnterFullscreen === "function") {
    video.addEventListener("webkitendfullscreen", () => video.pause(), { once: true });
    try { video.webkitEnterFullscreen(); } catch { /* iOS refuses before metadata loads; keep inline playback. */ }
    return;
  }

  if (typeof video.requestFullscreen !== "function") return;
  const onChange = () => {
    if (document.fullscreenElement) return;
    document.removeEventListener("fullscreenchange", onChange);
    video.pause();
  };
  video.requestFullscreen().then(() => document.addEventListener("fullscreenchange", onChange)).catch(() => undefined);
}
