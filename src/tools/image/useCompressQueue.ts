'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  reducer,
  initialState,
  decideConcurrency,
  nextRunnable,
  queueStats,
  type Job,
  type DeviceHints,
} from './queue-reducer';
import { CompressRunner } from './runner';
import {
  outputFilename,
  presetQuality,
  safeMaxArea,
  type FormatChoice,
  type Preset,
  type ResizeSettings,
} from './compress-math';
import { zipStore, uniqueName } from './zip-store';
import { withTimeout } from './async-util';

// A single image that hasn't finished in this long is treated as a hang → visible failure, not an
// infinite spinner. Generous so even a huge image on a slow device finishes well under it.
const JOB_TIMEOUT_MS = 45_000;

export type Settings = {
  preset: Preset;
  quality: number; // slider value used when preset === 'custom'
  format: FormatChoice;
  resize: ResizeSettings;
};

// Render data lives entirely in the reducer Job (incl. the object URLs), so the view is just the jobs.
export type ViewJob = Job;

// A big decode holds ~W×H×4 bytes live; true pixel area is only known post-decode, so for the
// concurrency gate we estimate it from the compressed file size (a JPEG is ~10× smaller than its RGBA
// buffer, so pixels ≈ bytes×2.5). Rough but enough to keep iOS Safari off the memory cliff.
const BYTES_TO_PIXELS = 2.5;

function detectDeviceHints(): DeviceHints {
  if (typeof navigator === 'undefined') return {};
  const ua = navigator.userAgent || '';
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const mobile = /Android|iPhone|iPad|iPod/i.test(ua) || (coarse && /Mobile|Tablet/i.test(ua));
  return {
    mobile,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  };
}

export function useCompressQueue() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Refs are for side-effect bookkeeping only — read in handlers/effects, NEVER during render (render
  // derives from `state`). filesRef/blobsRef hold the non-serializable File/Blob; urlsRef tracks every
  // object URL for revocation; jobsRef mirrors the latest jobs so handlers avoid stale closures.
  const filesRef = useRef(new Map<string, File>());
  const blobsRef = useRef(new Map<string, Blob>());
  const urlsRef = useRef(new Set<string>());
  const jobsRef = useRef<Job[]>([]);
  const startedRef = useRef(new Set<string>());
  const settingsRef = useRef<Settings | null>(null);
  const runnerRef = useRef<CompressRunner | null>(null);
  const hintsRef = useRef<DeviceHints>({});
  const seqRef = useRef(0);

  // Mirror the latest jobs into a ref (via an effect, not during render) so event handlers read fresh
  // state without stale closures.
  useEffect(() => {
    jobsRef.current = state.jobs;
  }, [state.jobs]);

  useEffect(() => {
    hintsRef.current = detectDeviceHints();
    const urls = urlsRef.current; // stable Set identity → correct to revoke its live contents at unmount
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
      urls.clear();
      runnerRef.current?.dispose();
      runnerRef.current = null;
    };
  }, []);

  const getRunner = () => {
    if (!runnerRef.current) runnerRef.current = new CompressRunner();
    return runnerRef.current;
  };

  const track = (url: string) => {
    urlsRef.current.add(url);
    return url;
  };
  const drop = (url?: string) => {
    if (url) {
      URL.revokeObjectURL(url);
      urlsRef.current.delete(url);
    }
  };

  const startJob = useCallback((id: string) => {
    if (startedRef.current.has(id)) return;
    const file = filesRef.current.get(id);
    const settings = settingsRef.current;
    if (!file || !settings) return;
    startedRef.current.add(id);
    dispatch({ type: 'start', id });
    const req = {
      quality: presetQuality(settings.preset, settings.quality),
      format: settings.format,
      resize: settings.resize,
      maxArea: safeMaxArea(hintsRef.current), // device-safe output area cap (iOS/low-memory guard)
    };
    withTimeout(getRunner().compress(file, req), JOB_TIMEOUT_MS)
      .then((r) => {
        startedRef.current.delete(id);
        if (!filesRef.current.has(id)) return; // canceled/removed while encoding
        blobsRef.current.set(id, r.blob);
        const url = track(URL.createObjectURL(r.blob));
        dispatch({
          type: 'succeed',
          id,
          result: {
            outSize: r.blob.size,
            outWidth: r.width,
            outHeight: r.height,
            outFormat: r.outFormat,
            downscaled: r.downscaled,
            outputUrl: url,
            outputName: outputFilename(file.name, r.outFormat),
          },
        });
      })
      .catch((e: unknown) => {
        startedRef.current.delete(id);
        if (!filesRef.current.has(id)) return;
        dispatch({ type: 'fail', id, error: e instanceof Error ? e.message : String(e) });
      });
  }, []);

  // Scheduler: whenever the queue changes, fill open concurrency slots from the queue head.
  useEffect(() => {
    const queued = state.jobs.filter((j) => j.status === 'queued');
    if (queued.length === 0) return;
    const largestBytes = Math.max(0, ...queued.map((j) => j.size));
    const concurrency = decideConcurrency(largestBytes * BYTES_TO_PIXELS, hintsRef.current);
    for (const id of nextRunnable(state, concurrency)) startJob(id);
  }, [state, startJob]);

  const addFiles = useCallback((files: File[], settings: Settings) => {
    settingsRef.current = settings;
    const accepted = files.filter((f) => f.type.startsWith('image/'));
    if (accepted.length === 0) return { rejected: files.length };
    const newFiles = accepted.map((file) => {
      const id = `f${seqRef.current++}`;
      filesRef.current.set(id, file);
      return { id, name: file.name, size: file.size, type: file.type, previewUrl: track(URL.createObjectURL(file)) };
    });
    dispatch({ type: 'add', files: newFiles });
    return { rejected: files.length - accepted.length };
  }, []);

  // Submit all pending jobs for compression with the current settings (the "Compress" button).
  const compressAll = useCallback((settings: Settings) => {
    settingsRef.current = settings;
    dispatch({ type: 'startAll' });
  }, []);

  const recompressAll = useCallback((settings: Settings) => {
    settingsRef.current = settings;
    const ids = jobsRef.current.filter((j) => j.status !== 'queued').map((j) => j.id);
    if (ids.length === 0) return;
    for (const id of ids) {
      startedRef.current.delete(id);
      blobsRef.current.delete(id);
      drop(jobsRef.current.find((j) => j.id === id)?.outputUrl);
    }
    dispatch({ type: 'requeue', ids });
  }, []);

  const remove = useCallback((id: string) => {
    const job = jobsRef.current.find((j) => j.id === id);
    drop(job?.previewUrl);
    drop(job?.outputUrl);
    filesRef.current.delete(id);
    blobsRef.current.delete(id);
    startedRef.current.delete(id);
    dispatch({ type: 'remove', id });
  }, []);

  const clear = useCallback(() => {
    for (const u of urlsRef.current) URL.revokeObjectURL(u);
    urlsRef.current.clear();
    filesRef.current.clear();
    blobsRef.current.clear();
    startedRef.current.clear();
    dispatch({ type: 'clear' });
  }, []);

  const downloadZip = useCallback(async () => {
    const done = jobsRef.current.filter((j) => j.status === 'done');
    if (done.length === 0) return;
    const used = new Set<string>();
    // Assign unique names synchronously (deterministic order), then read the blobs in parallel.
    const named = done
      .map((j) => ({ blob: blobsRef.current.get(j.id), name: j.outputName ?? `${j.id}.img` }))
      .filter((x): x is { blob: Blob; name: string } => x.blob !== undefined)
      .map((x) => ({ blob: x.blob, name: uniqueName(x.name, used) }));
    const buffers = await Promise.all(named.map(({ blob }) => blob.arrayBuffer()));
    const zip = zipStore(named.map(({ name }, i) => ({ name, data: new Uint8Array(buffers[i]) })));
    const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
    triggerDownload(url, 'compressed-images.zip');
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, []);

  const downloadOne = useCallback((id: string) => {
    const job = jobsRef.current.find((j) => j.id === id);
    if (job?.outputUrl) triggerDownload(job.outputUrl, job.outputName ?? 'image');
  }, []);

  const cancelAll = useCallback(() => dispatch({ type: 'cancelAll' }), []);

  const jobs: ViewJob[] = state.jobs;
  const stats = queueStats(state);

  return { jobs, stats, addFiles, compressAll, recompressAll, remove, clear, cancelAll, downloadZip, downloadOne };
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
