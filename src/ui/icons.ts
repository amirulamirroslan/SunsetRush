import { html } from './dom';

/** Real SVG icons (stroke style, 24×24, inherit `currentColor`). No emoji anywhere in the interface. */
const P: Record<string, string> = {
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  car: '<path d="M5 16.5h14M3.2 13l1.5-4.1A2 2 0 0 1 6.6 7.6h10.8a2 2 0 0 1 1.9 1.3L20.8 13v3.3a1 1 0 0 1-1 1h-1M4.2 17.3h-1a1 1 0 0 1-1-1V13"/><circle cx="7.6" cy="16.8" r="1.9"/><circle cx="16.4" cy="16.8" r="1.9"/><path d="M5 13h14"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.1.9-1.1 1.7M12 17h.01"/>',
  pause: '<rect x="6.5" y="5" width="3.6" height="14" rx="1" fill="currentColor"/><rect x="13.9" y="5" width="3.6" height="14" rx="1" fill="currentColor"/>',
  restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4.5v4h4"/>',
  home: '<path d="M3.5 11 12 3.5 20.5 11M5.5 9.5V20h4.5v-5.5h4V20h4.5V9.5"/>',
  flag: '<path d="M5.5 21V4M5.5 4.5h11l-2.2 3.8 2.2 3.7h-11"/>',
  bolt: '<path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z" fill="currentColor" stroke="none"/>',
  coin: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.4"/><path d="M12 9.4v5.2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.2"/><path d="M8.2 11V8a3.8 3.8 0 0 1 7.6 0v3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  trophy: '<path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0zM7.5 6H4.5v1a3 3 0 0 0 3 3M16.5 6h3v1a3 3 0 0 1-3 3M12 13.5V17M8.5 20.5h7M10 17h4"/>',
  stopwatch: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.5M9.5 3h5M12 3v3M18 7l1.4-1.4"/>',
  chevL: '<path d="m14.5 6-6 6 6 6"/>',
  chevR: '<path d="m9.5 6 6 6-6 6"/>',
  sound: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4zM16 9.5l4.5 5M20.5 9.5l-4.5 5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  brake: '<circle cx="12" cy="12" r="8"/><path d="M8.5 12h7"/><path d="M5 5.5 3.5 4M19 5.5 20.5 4"/>',
  gas: '<path d="M8.5 3.5h7l1.2 13.5a2 2 0 0 1-2 2.2H9.3a2 2 0 0 1-2-2.2z"/><path d="M10 8h4M10.2 11.2h3.6M10.4 14.4h3.2"/>',
  drift: '<path d="M4.5 19.5c0-5.5 3.8-6.8 7-8.8s3.2-4.7 7.5-5.7"/><path d="M8.5 19.5c0-3.6 2.6-4.6 4.6-5.8"/><path d="m16 3.8 3.5 1.2-1.3 3.4"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4.6h-4.6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
  speed: '<path d="M4 17a8.5 8.5 0 1 1 16 0M12 17l4-5"/>',
  warn: '<path d="M12 3.5 21.5 20h-19zM12 10v4.5M12 17.2h.01"/>',
  reset: '<path d="M3.5 12h5M20.5 12h-5M12 3.5v5M12 20.5v-5"/><circle cx="12" cy="12" r="2.2"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z"/>',
  dot: '<circle cx="12" cy="12" r="4" fill="currentColor"/>',
  paint: '<path d="M12 3.5s6 6.3 6 10.5a6 6 0 0 1-12 0C6 9.800 12 3.500 12 3.500z"/><path d="M9 14.500a3 3 0 0 0 2.500 2.500"/>',
  finish: '<path d="m12 3 1.900 5.100L19 10l-5.100 1.900L12 17l-1.900-5.100L5 10l5.100-1.900zM18.500 15l.8 2.200 2.200.8-2.200.8-.8 2.200-.8-2.200-2.200-.8 2.200-.8z"/>',
  wheel: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="2.200"/><path d="M12 3.500v6.300M12 14.200v6.300M3.800 9l6.100 1.900M14.100 13.100 20.200 15M3.800 15l6.100-1.900M14.100 10.900 20.200 9"/>',
  spoiler: '<path d="M3 8.500h18l-1.500 3H4.500zM7 11.500V17M17 11.500V17M5 17h14"/>',
  decal: '<path d="M4 6.500h16M4 12h16M4 17.500h16" stroke-width="3.200"/>',
  rotate3d: '<path d="M3.5 12c0-2.2 3.8-4 8.5-4s8.5 1.8 8.5 4-3.8 4-8.5 4"/><path d="m8.5 16-2.2 1.2 1.6 2"/><path d="M12 5v3"/>',
};

export function icon(name: keyof typeof P | string, cls = 'ico'): HTMLElement {
  const body = P[name] ?? P.dot;
  return html(`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`);
}
export const ICON_NAMES = Object.keys(P);
