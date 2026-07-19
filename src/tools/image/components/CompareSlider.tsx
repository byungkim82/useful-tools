// Before/after compare slider: the original and the compressed image are stacked and a draggable
// divider reveals more of the "before" the further left it sits. Pointer-drag anywhere on the image,
// or focus the range input and use the arrow keys. No 'use client' — imported by the client boundary.
import { useRef, useState } from 'react';
import type { LabelSet } from '../labels';
import { clampPercent } from '../compress-math';

export default function CompareSlider({
  beforeUrl,
  afterUrl,
  labels,
}: {
  beforeUrl: string; // original preview
  afterUrl: string; // compressed output
  labels: LabelSet;
}) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0) setPos(clampPercent(((clientX - r.left) / r.width) * 100));
  };

  return (
    <div className="max-w-md">
      <div
        ref={ref}
        className="relative w-full cursor-ew-resize select-none overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          updateFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) updateFromClientX(e.clientX);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
      >
        {/* eslint-disable @next/next/no-img-element -- client-generated blob URLs, static export */}
        <img src={afterUrl} alt="" className="block w-full" draggable={false} />
        <img
          src={beforeUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        {/* eslint-enable @next/next/no-img-element */}

        {/* Divider + handle */}
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
          <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow" />
          <div className="absolute top-1/2 -ml-3 -mt-3 h-6 w-6 -translate-y-0 rounded-full border border-neutral-300 bg-white/90 text-[10px] leading-6 text-neutral-600 shadow">
            ↔
          </div>
        </div>

        <span className="absolute left-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {labels.before}
        </span>
        <span className="absolute right-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {labels.after}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(clampPercent(Number(e.target.value)))}
        aria-label={labels.compare}
        className="mt-2 w-full"
      />
    </div>
  );
}
