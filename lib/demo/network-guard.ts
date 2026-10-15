// Defence in depth for Demo Mode. Demo Mode never creates a Supabase client; this guard additionally
// blocks, at the browser level, any request to a Supabase host that some code path might still try
// (fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon), and counts the attempts so the
// Settings page can show that the preview is isolated.
export const isSupabaseHost = (url: string | URL, base = "http://localhost") => {
  try {
    const host = new URL(String(url), base).hostname.toLowerCase();
    return host === "supabase.co" || host.endsWith(".supabase.co") || host === "supabase.in" || host.endsWith(".supabase.in");
  } catch {
    return false;
  }
};

export const networkGuard = { installed: false, blocked: 0, lastBlocked: "" };

export function installDemoNetworkGuard(w: Window & typeof globalThis = window) {
  if (networkGuard.installed) return;
  networkGuard.installed = true;
  const block = (url: string | URL) => {
    networkGuard.blocked += 1;
    networkGuard.lastBlocked = new URL(String(url), w.location.href).hostname;
    return new Error(`Blocked in Demo Mode: requests to ${networkGuard.lastBlocked} are not allowed.`);
  };
  const urlOf = (input: RequestInfo | URL) => (typeof input === "string" || input instanceof URL ? input : input.url);

  const fetch = w.fetch.bind(w);
  w.fetch = (input, init) => (isSupabaseHost(urlOf(input), w.location.href) ? Promise.reject(block(urlOf(input))) : fetch(input, init));

  const open = w.XMLHttpRequest.prototype.open;
  w.XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    if (isSupabaseHost(url, w.location.href)) throw block(url);
    return (open as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof open;

  for (const name of ["WebSocket", "EventSource"] as const) {
    const Original = w[name] as unknown as new (url: string | URL, ...rest: unknown[]) => object;
    if (!Original) continue;
    const Guarded = function (url: string | URL, ...rest: unknown[]) {
      if (isSupabaseHost(url, w.location.href)) throw block(url);
      return new Original(url, ...rest);
    } as unknown as typeof Original;
    Guarded.prototype = Original.prototype;
    Object.assign(Guarded, Original);
    (w as unknown as Record<string, unknown>)[name] = Guarded;
  }

  if (w.navigator.sendBeacon) {
    const beacon = w.navigator.sendBeacon.bind(w.navigator);
    w.navigator.sendBeacon = (url, data) => {
      if (isSupabaseHost(url, w.location.href)) {
        block(url);
        return false;
      }
      return beacon(url, data);
    };
  }
}
