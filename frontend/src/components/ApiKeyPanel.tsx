'use client'

import { useState } from 'react';
import { ApiKeyPanelProps } from '@/types/security';

/**
 * Bring-your-own-key gate. The key is validated by the backend, held in React state
 * by the parent only (never in browser storage) and the input is cleared on submit.
 */
export default function ApiKeyPanel({ isConnected, onConnect, onForget }: ApiKeyPanelProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = value.trim();
    if (!key) return;
    setValue('');
    setBusy(true);
    setError(await onConnect(key));
    setBusy(false);
  };

  if (isConnected) {
    return (
      <div className="glass flex items-center justify-between gap-3 px-5 py-3">
        <span className="flex items-center gap-2 text-sm text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
          Groq key connected for this session
        </span>
        <button onClick={onForget} className="btn-ghost">Forget key</button>
      </div>
    );
  }

  return (
    <div className="glass mx-auto max-w-xl p-8 text-center">
      <div className="mb-3 text-4xl">🔑</div>
      <h2 className="text-xl font-semibold">Connect your Groq API key</h2>
      <p className="mt-2 text-sm text-accent">
        Get a free key at{' '}
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-secondary underline"
        >
          console.groq.com/keys
        </a>
        . It stays in this browser tab only and is never saved.
      </p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="gsk_…"
          aria-label="Groq API key"
          className="field flex-1 px-4 py-2.5 font-mono text-sm"
        />
        <button type="submit" disabled={!value.trim() || busy} className="btn-primary">
          {busy ? 'Checking…' : 'Connect'}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}
