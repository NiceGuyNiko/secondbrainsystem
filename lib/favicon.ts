// Theme-aware browser-tab icon. Draws the emblem masks in the active theme's logo colours on a small
// rounded backing (needed for legibility at 16–32px on any tab-bar colour) and points the page's
// icon links at the result. If anything fails, the static /icon.png declared in app/layout.tsx stays.
// Some browsers (notably Safari) ignore icon changes after load and keep the static icon.
const masks = new Map<string, Promise<HTMLImageElement>>();
const loadMask = (src: string) => {
  if (!masks.has(src))
    masks.set(src, new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    }));
  return masks.get(src)!;
};

const concrete = (value: string | undefined, fallback: string) => (value && /^#[\da-f]{6}$/i.test(value) ? value : fallback);

export async function updateFavicon(tokens: Record<string, string>) {
  try {
    const [ring, glyph] = await Promise.all([loadMask("/brand/aaa-mark-ring.png"), loadMask("/brand/aaa-mark-glyph.png")]);
    const size = 64, inset = 6;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = concrete(tokens.canvas, "#000000");
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 14);
    ctx.fill();
    const tint = (image: HTMLImageElement, colour: string) => {
      const layer = document.createElement("canvas");
      layer.width = layer.height = size;
      const l = layer.getContext("2d")!;
      l.drawImage(image, inset, inset, size - inset * 2, size - inset * 2);
      l.globalCompositeOperation = "source-in";
      l.fillStyle = colour;
      l.fillRect(0, 0, size, size);
      ctx.drawImage(layer, 0, 0);
    };
    tint(ring, concrete(tokens["logo-border"], "#C6A15C"));
    tint(glyph, concrete(tokens["logo-glyph"], "#E8D39A"));
    const href = canvas.toDataURL("image/png");
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')];
    if (!links.length) {
      const link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
      links.push(link);
    }
    for (const link of links) {
      link.type = "image/png";
      link.href = href;
    }
  } catch {
    // Keep the static icon.
  }
}
