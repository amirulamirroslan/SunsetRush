/** Tiny DOM helpers so screens read declaratively without a framework. */
export type Child = Node | string | null | undefined | false;
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | number | boolean | null | undefined | ((e: Event) => void)> = {}, children: Child[] = []): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') e.className = String(v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
}
/** Creates an element from trusted, static SVG/HTML markup (icons only — never user text). */
export function html(markup: string): HTMLElement {
  const t = document.createElement('template'); t.innerHTML = markup.trim(); return t.content.firstElementChild as HTMLElement;
}
export const clear = (n: Node): void => { while (n.firstChild) n.removeChild(n.firstChild); };
