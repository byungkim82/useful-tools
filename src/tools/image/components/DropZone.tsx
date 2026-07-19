// No 'use client' here: this presentational component is only ever imported by ImageCompressorClient
// (which is the client boundary), so it's already in the client bundle. Omitting the directive keeps it
// from being treated as a client entry, which would otherwise flag its function props as non-serializable.
import { useEffect, useRef, useState } from 'react';
import type { LabelSet } from '../labels';

// Drag-and-drop + file-picker + folder-picker input. The `name="img-source"` on the input is the
// DOM-only ssr:false marker verified absent from the static HTML (a dict prop string would be a false
// positive). Clipboard paste (Ctrl/Cmd+V) is wired at the document level in ImageCompressorClient.
export default function DropZone({
  labels,
  onFiles,
  hasJobs,
}: {
  labels: LabelSet;
  onFiles: (files: File[]) => void;
  hasJobs: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  // webkitdirectory / directory aren't in the React input prop types, so set them imperatively.
  useEffect(() => {
    const el = folderRef.current;
    if (el) {
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    }
  }, []);

  const pick = (list: FileList | null) => {
    if (list && list.length) onFiles(Array.from(list));
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-10 text-center transition ${
          over
            ? 'border-neutral-500 bg-neutral-50 dark:bg-neutral-900'
            : 'border-neutral-300 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-600'
        }`}
      >
        <span className="text-2xl" aria-hidden="true">
          🖼️
        </span>
        <span className="text-sm font-medium">{hasJobs ? labels.addMore : labels.dropTitle}</span>
        <span className="text-xs text-neutral-500">{labels.dropHint}</span>
        <span className="text-xs text-neutral-400">{labels.pasteHint}</span>
      </button>

      <div className="mt-2 flex justify-center">
        <button
          type="button"
          onClick={() => folderRef.current?.click()}
          className="text-xs text-neutral-500 underline underline-offset-2 transition hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          📁 {labels.selectFolder}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        name="img-source"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = ''; // allow re-selecting the same file
        }}
      />
      <input
        ref={folderRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
