const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

// This follows CrazyGames' documented hostname check. It intentionally checks
// the game document's own host, never document.referrer or a parent frame.
export function isCrazyGames() {
  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  const idx = parts.indexOf("crazygames");
  return idx !== -1 && idx >= parts.length - 3;
}

export function isCrazyGamesLaunchAllowed() {
  const hostname = window.location.hostname;
  return LOCAL_HOSTNAMES.has(hostname) || isCrazyGames();
}
