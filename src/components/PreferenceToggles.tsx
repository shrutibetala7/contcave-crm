"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { celebrate, isSoundOn, setSoundOn } from "@/lib/celebrate";
import { isDark, subscribeTheme, toggleTheme } from "@/lib/theme";

const BUTTON =
  "rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 sm:p-1.5";

/** Day / night. */
export function ThemeToggle() {
  // The server can't know the theme; it renders the day state and the client corrects it.
  const dark = useSyncExternalStore(subscribeTheme, isDark, () => false);
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={BUTTON}
      aria-label={dark ? "Switch to day mode" : "Switch to night mode"}
      title={dark ? "Day mode" : "Night mode"}
    >
      <Icon name={dark ? "sun" : "moon"} className="size-4" />
    </button>
  );
}

const soundListeners = new Set<() => void>();
function subscribeSound(onChange: () => void) {
  soundListeners.add(onChange);
  return () => {
    soundListeners.delete(onChange);
  };
}

/** Mutes (or unmutes) the fanfare that plays with the confetti. */
export function SoundToggle() {
  const on = useSyncExternalStore(subscribeSound, isSoundOn, () => true);
  return (
    <button
      type="button"
      onClick={() => {
        setSoundOn(!on);
        soundListeners.forEach((l) => l());
        if (!on) celebrate(); // hear what it sounds like
      }}
      className={BUTTON}
      aria-label={on ? "Mute celebration sounds" : "Turn celebration sounds on"}
      title={on ? "Celebration sound on" : "Celebration sound off"}
    >
      <Icon name={on ? "volume" : "volume-off"} className="size-4" />
    </button>
  );
}
