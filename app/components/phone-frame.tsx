"use client";

/* The shell is a static asset shipped in /public. */
/* eslint-disable @next/next/no-img-element */

import type { ReactNode } from "react";
import "./phone-frame.css";

/* Realistic iPhone shell: the screen cut-out matches the transparent area of /phone-frame.png. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return <div className="deviceShell">
    <div className="deviceShellScreen">{children}</div>
    <img className="deviceShellImg" src="/phone-frame.png" alt="" aria-hidden draggable={false} />
  </div>;
}
