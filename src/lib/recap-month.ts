/** UTC month boundaries keep browser, server and downloads consistent. */
export function currentRecapMonth(now = new Date()): string { return now.toISOString().slice(0, 7); }
export function validRecapMonth(value: string | undefined, now = new Date()): string {
  return value && /^(20\d{2})-(0[1-9]|1[0-2])$/.test(value) && value <= currentRecapMonth(now) ? value : currentRecapMonth(now);
}
export function recapBounds(month: string): { start: string; end: string } {
  const [year, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(year, m - 1, 1)).toISOString(), end: new Date(Date.UTC(year, m, 1)).toISOString() };
}
export function recapLabel(month: string): string {
  return new Date(month + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
