/** Public assets share Vite's base, including GitHub Pages project subdirectories. */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path}`;
}
