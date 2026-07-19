// Pure batch-queue state machine + adaptive-concurrency decision for the image compressor. This is the
// riskiest logic in the tool (transitions, cancel, concurrency), so it lives here — DOM/React-free and
// unit-tested with fake results — while useCompressQueue.ts is a thin shell wiring it to the worker.

import type { OutputFormat } from './compress-math';

// 'pending' = added but NOT yet submitted for compression (waiting for the user to press Compress).
// 'queued'  = submitted, waiting for a free concurrency slot. The scheduler only runs 'queued'.
export type JobStatus = 'pending' | 'queued' | 'processing' | 'done' | 'error' | 'canceled';

export type Job = {
  id: string;
  name: string;
  size: number; // original bytes
  type: string; // original MIME
  status: JobStatus;
  previewUrl?: string; // object URL of the original (thumbnail) — set at add time
  // Populated on success:
  outSize?: number;
  outWidth?: number;
  outHeight?: number;
  outFormat?: OutputFormat;
  downscaled?: boolean; // canvas-edge clamp kicked in (badge)
  approximated?: boolean; // target size was requested but couldn't be reached (badge)
  outputUrl?: string; // object URL of the compressed blob (download/preview)
  outputName?: string; // suggested download filename, e.g. photo-min.webp
  error?: string;
};

export type QueueState = { jobs: Job[] };

export type NewFile = { id: string; name: string; size: number; type: string; previewUrl?: string };
export type JobResult = {
  outSize: number;
  outWidth: number;
  outHeight: number;
  outFormat: OutputFormat;
  downscaled: boolean;
  approximated?: boolean;
  outputUrl?: string;
  outputName?: string;
};

export type Action =
  | { type: 'add'; files: NewFile[] }
  | { type: 'startAll' }
  | { type: 'start'; id: string }
  | { type: 'succeed'; id: string; result: JobResult }
  | { type: 'fail'; id: string; error: string }
  | { type: 'cancel'; id: string }
  | { type: 'cancelAll' }
  | { type: 'requeue'; ids: string[] }
  | { type: 'remove'; id: string }
  | { type: 'clear' };

export const initialState: QueueState = { jobs: [] };

const ACTIVE = (s: JobStatus) => s === 'pending' || s === 'queued' || s === 'processing';

export function reducer(state: QueueState, action: Action): QueueState {
  switch (action.type) {
    case 'add':
      // Newly added files wait as 'pending' — the user presses Compress to submit them.
      return {
        jobs: [...state.jobs, ...action.files.map((f) => ({ ...f, status: 'pending' as const }))],
      };
    case 'startAll':
      // Submit every pending job for compression (the "Compress" button).
      return { jobs: state.jobs.map((j) => (j.status === 'pending' ? { ...j, status: 'queued' } : j)) };
    case 'start':
      return mapJob(state, action.id, (j) => (j.status === 'queued' ? { ...j, status: 'processing' } : j));
    case 'succeed':
      return mapJob(state, action.id, (j) =>
        j.status === 'processing' ? { ...j, status: 'done', ...action.result } : j,
      );
    case 'fail':
      return mapJob(state, action.id, (j) =>
        j.status === 'processing' ? { ...j, status: 'error', error: action.error } : j,
      );
    case 'cancel':
      return mapJob(state, action.id, (j) => (ACTIVE(j.status) ? { ...j, status: 'canceled' } : j));
    case 'cancelAll':
      return { jobs: state.jobs.map((j) => (ACTIVE(j.status) ? { ...j, status: 'canceled' } : j)) };
    case 'requeue': {
      // Reset the given jobs to a clean queued state (drops previous output) so they re-run with new
      // settings. Keeps id/name/size/type; the hook keeps the original File keyed by id.
      const ids = new Set(action.ids);
      return {
        jobs: state.jobs.map((j) =>
          ids.has(j.id)
            ? { id: j.id, name: j.name, size: j.size, type: j.type, status: 'queued', previewUrl: j.previewUrl }
            : j,
        ),
      };
    }
    case 'remove':
      return { jobs: state.jobs.filter((j) => j.id !== action.id) };
    case 'clear':
      return { jobs: [] };
    default:
      return state;
  }
}

function mapJob(state: QueueState, id: string, fn: (j: Job) => Job): QueueState {
  return { jobs: state.jobs.map((j) => (j.id === id ? fn(j) : j)) };
}

export type DeviceHints = { deviceMemory?: number; hardwareConcurrency?: number; mobile?: boolean };

/**
 * How many images to encode at once. Primary signal is the LARGEST pending image's pixel area — a big
 * decode holds ~W×H×4 bytes live, and iOS Safari kills the tab around 200–400 MB. `deviceMemory` is a
 * Chromium-only bonus (Safari/Firefox never send it, so it can't be the main signal). Mobile is capped
 * hard at 1. Result is clamped to leave one core free.
 */
export function decideConcurrency(largestPixelArea: number, hints: DeviceHints = {}): number {
  if (hints.mobile) return 1;
  let base: number;
  if (largestPixelArea > 8_000_000) base = 1;
  else if (largestPixelArea > 2_000_000) base = 2;
  else base = 3;
  if (hints.deviceMemory !== undefined && hints.deviceMemory <= 4 && base > 2) base = 2;
  if (hints.hardwareConcurrency !== undefined) {
    base = Math.min(base, Math.max(1, hints.hardwareConcurrency - 1));
  }
  return Math.max(1, base);
}

/** Ids to start next: fill up to `concurrency` active (processing) jobs from the queue head, in order. */
export function nextRunnable(state: QueueState, concurrency: number): string[] {
  const active = state.jobs.filter((j) => j.status === 'processing').length;
  const slots = Math.max(0, concurrency - active);
  if (slots === 0) return [];
  return state.jobs
    .filter((j) => j.status === 'queued')
    .slice(0, slots)
    .map((j) => j.id);
}

export type QueueStats = {
  total: number;
  pending: number; // added, not yet submitted
  done: number;
  processing: number;
  active: number; // queued + processing (a compression run is in flight)
  originalBytes: number; // summed over DONE jobs only
  outputBytes: number;
};

/** Aggregate counters for the action bar / progress line. Byte totals cover successfully-done jobs. */
export function queueStats(state: QueueState): QueueStats {
  let originalBytes = 0;
  let outputBytes = 0;
  let pending = 0;
  let done = 0;
  let processing = 0;
  let active = 0;
  for (const j of state.jobs) {
    if (j.status === 'done') {
      done++;
      originalBytes += j.size;
      outputBytes += j.outSize ?? 0;
    } else if (j.status === 'processing') {
      processing++;
      active++;
    } else if (j.status === 'queued') {
      active++;
    } else if (j.status === 'pending') {
      pending++;
    }
  }
  return { total: state.jobs.length, pending, done, processing, active, originalBytes, outputBytes };
}
