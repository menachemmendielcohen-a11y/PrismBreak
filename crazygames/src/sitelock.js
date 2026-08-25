const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isCrazyGamesHostname(value) {
  const hostname = value.toLowerCase().replace(/\.$/, "");
  const parts = hostname.split(".");
  const crazyGamesIndex = parts.indexOf("crazygames");
  return crazyGamesIndex !== -1 && crazyGamesIndex >= parts.length - 3;
}

export function isCrazyGamesLaunchAllowed(hostname, isProduction) {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/, "");
  return !isProduction
    || LOCAL_HOSTNAMES.has(normalizedHostname)
    || isCrazyGamesHostname(normalizedHostname);
}
