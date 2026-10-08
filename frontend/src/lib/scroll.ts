/** React Router's ScrollRestoration keeps positions here (sessionStorage), keyed by history entry. */
export const SCROLL_POSITIONS_KEY = 'react-router-scroll-positions'

/**
 * A full page load should start at the top (or at the URL's #anchor), not where the tab last was:
 * ScrollRestoration would otherwise restore the position saved for this history entry. Positions saved
 * while navigating inside the app are kept from here on, so Back still returns to where you were.
 */
export function startAtTopOnPageLoad(): void {
  try {
    sessionStorage.removeItem(SCROLL_POSITIONS_KEY)
  } catch {
    // Storage blocked: nothing was saved either.
  }
}
