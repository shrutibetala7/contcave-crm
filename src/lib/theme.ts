/**
 * Day / night mode. The choice lives in localStorage; with no choice made it
 * follows the device. The class on <html> is what the palette in globals.css
 * keys off, and NO_FLASH_SCRIPT (run in <head> before first paint) sets it so
 * a night-mode user never sees a white flash. Client-safe.
 */
export const THEME_KEY = "theme";

export const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark")}catch(e){}})()`;

const listeners = new Set<() => void>();

export function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

function apply(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  listeners.forEach((l) => l());
}

/** For useSyncExternalStore. Also follows the device while no choice has been made. */
export function subscribeTheme(onChange: () => void): () => void {
  listeners.add(onChange);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onDevice = () => {
    try {
      if (localStorage.getItem(THEME_KEY)) return;
    } catch {
      // no storage — keep following the device
    }
    apply(media.matches);
  };
  media.addEventListener("change", onDevice);
  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", onDevice);
  };
}

export function toggleTheme(): void {
  const dark = !isDark();
  apply(dark);
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    // storage unavailable — the choice just won't persist
  }
}
