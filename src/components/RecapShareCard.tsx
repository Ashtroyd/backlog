"use client";
import { useEffect, useRef, useState } from "react";

export type RecapCardData = {
  month: string;
  count: number;
  countLabel: string;
  detail: string;
  highlights: { title: string; detail: string }[];
  extra?: string[];
};
export function RecapShareCard({ data, variant }: { data: RecapCardData; variant: "backlog" | "album" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const album = variant === "album";
    const bg = album ? "#faf7f0" : "#ffffff", ink = "#272622", muted = "#77756d", accent = album ? "#b65a39" : "#c94a17";
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1350);
    const text = (value: string, x: number, y: number, size: number, color: string, bold = false, max = 896) => {
      ctx.font = `${bold ? "600" : "400"} ${size}px ${album && size >= 80 ? "Georgia" : "sans-serif"}`;
      ctx.fillStyle = color;
      let line = value.replace(/[\r\n\t]/g, " ").slice(0, 300);
      if (ctx.measureText(line).width > max) {
        while (line.length && ctx.measureText(line + "…").width > max) line = line.slice(0, -1);
        line += "…";
      }
      ctx.fillText(line, x, y);
    };
    text(album ? "ALBUM ARCHIVE" : "Backlog.", 88, 115, 32, accent, true);
    const split = data.month.lastIndexOf(" ");
    text(data.month.slice(split + 1) + " · MONTHLY RECAP", 88, 182, 24, muted);
    text(data.month.slice(0, split), 88, 293, 100, ink, true);
    text(String(data.count), 88, 438, 112, accent, true, 250);
    text(data.countLabel, 88 + Math.min(ctx.measureText(String(data.count)).width + 35, 270), 432, 34, ink, false, 590);
    text(data.detail, 88, 494, 28, muted);
    ctx.strokeStyle = "#dedbd3"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(88, 542); ctx.lineTo(992, 542); ctx.stroke();
    text("THE HIGHLIGHTS", 88, 605, 24, accent, true);
    if (!data.highlights.length) text("A quieter month. There’s more ahead.", 88, 700, 34, ink);
    data.highlights.slice(0, 3).forEach((line, index) => {
      const y = 694 + index * 128;
      text(line.title, 88, y, 44, ink, true);
      text(line.detail, 88, y + 44, 28, muted);
    });
    (data.extra ?? []).slice(0, 2).forEach((line, index) => text(line, 88, 1100 + index * 42, 27, muted));
    ctx.fillStyle = accent; ctx.fillRect(88, 1210, 904, 5);
    text(album ? "Rated or revisited · latest saved scores" : "Recorded completions · private titles excluded", 88, 1270, 24, muted);
  }, [data, variant]);

  async function download() {
    setError(null); setPending(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("No card");
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("No image")), "image/png"));
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `${variant}-recap-${data.month.replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("The card couldn’t download. Try again."); }
    finally { setPending(false); }
  }

  return <section aria-label="Shareable recap card" className="space-y-3">
    <canvas ref={canvasRef} width={1080} height={1350} role="img" aria-label={`${data.month}: ${data.count} ${data.countLabel}. ${data.detail}. ${data.highlights.map(line => line.title + ", " + line.detail).join(". ")}`} className="h-auto w-full rounded-2xl border border-line" />
    <button type="button" disabled={pending} onClick={download} className={variant === "album" ? "btn btn-primary w-full" : "min-h-11 w-full rounded-full bg-accent px-5 py-2.5 text-subhead font-medium text-white disabled:opacity-60"}>{pending ? "Preparing card…" : "Download card"}</button>
    <p className="text-xs text-muted">Save the PNG to share wherever you like. Notes and friends’ names are never included{variant === "backlog" ? "; private titles are excluded too." : "."}</p>
    {error && <p role="status" className="text-sm text-accent">{error}</p>}
  </section>;
}
