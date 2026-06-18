/**
 * The original web app rendered a faux iOS status bar that was only visible
 * inside the desktop phone-frame mockup. On a real device the OS draws the
 * status bar, so this is intentionally a no-op kept for import compatibility.
 */
export function StatusBar() {
  return null
}
