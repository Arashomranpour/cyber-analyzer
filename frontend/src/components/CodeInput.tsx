'use client'

import { useState } from 'react';
import { CodeInputProps } from '@/types/security';

/**
 * Code input: paste, drag & drop or pick a .py file, or load a vulnerable sample.
 */
export default function CodeInput({
  codeContent,
  fileName,
  onCodeChange,
  onFileSelected,
  onLoadSample,
  onClear,
  onAnalyzeCode,
  isAnalyzing,
}: CodeInputProps) {
  const [dragging, setDragging] = useState(false);
  const lines = codeContent ? codeContent.split('\n').length : 0;

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <div className="glass flex flex-col p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label htmlFor="code-input" className="text-lg font-semibold">
            Code to analyze
          </label>
          {fileName && (
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-0.5 text-xs text-accent">
              {fileName}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".py"
            id="file-upload"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileSelected(f);
              e.target.value = '';
            }}
          />
          <label htmlFor="file-upload" className="btn-ghost">Open .py file</label>
          <button onClick={onLoadSample} className="btn-ghost">Try a sample</button>
          <button onClick={onClear} disabled={!codeContent} className="btn-ghost">Clear</button>
          <button
            onClick={onAnalyzeCode}
            disabled={!codeContent.trim() || isAnalyzing}
            className="btn-primary"
          >
            {isAnalyzing ? 'Analyzing…' : 'Analyze code'}
          </button>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative rounded-xl transition ${dragging ? 'ring-2 ring-secondary' : ''}`}
      >
        <textarea
          id="code-input"
          value={codeContent}
          onChange={(e) => onCodeChange(e.target.value)}
          spellCheck={false}
          placeholder="Paste Python code here, drop a .py file, or try a sample…"
          className="field h-72 w-full resize-y p-4 font-mono text-sm"
        />
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 text-lg font-medium">
            Drop your .py file
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-accent">
        {lines} lines · {codeContent.length.toLocaleString()} characters
      </p>
    </div>
  );
}
