'use client'

import { useState } from 'react';
import { AnalysisResponse, HistoryEntry } from '@/types/security';
import { SAMPLE_CODE } from '@/lib/sample';
import { riskScore } from '@/lib/report';
import ApiKeyPanel from '@/components/ApiKeyPanel';
import CodeInput from '@/components/CodeInput';
import AnalysisResults from '@/components/AnalysisResults';

// Force relative URLs in production builds
// Only use localhost when explicitly running in development mode
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'development' && typeof window !== 'undefined' && window.location?.hostname === 'localhost'
    ? 'http://localhost:8000'
    : '');

/** Pull the backend's friendly `detail` message out of an error response. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') return body.detail;
  } catch {
    /* not JSON */
  }
  return `Request failed (HTTP ${response.status}).`;
}

/**
 * Main application page for cybersecurity code analysis.
 * Bring-your-own-key: the Groq key lives in React state only (no storage, no URL).
 */
export default function Home() {
  const [groqKey, setGroqKey] = useState<string | null>(null);
  const [codeContent, setCodeContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [analysisResults, setAnalysisResults] = useState<AnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Session-only history (lost on refresh by design)
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const resetResults = () => {
    setAnalysisResults(null);
    setError(null);
  };

  const connectKey = async (key: string): Promise<string | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/validate-key`, {
        method: 'POST',
        headers: { 'X-Groq-Api-Key': key },
      });
      if (!response.ok) return await errorMessage(response);
      setGroqKey(key);
      return null;
    } catch {
      return "Couldn't reach the server to check the key.";
    }
  };

  const forgetKey = () => {
    setGroqKey(null);
    resetResults();
    setHistory([]);
  };

  const handleFileSelected = (file: File) => {
    if (!file.name.endsWith('.py')) {
      setError('Please select a Python (.py) file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setCodeContent(e.target?.result as string);
      setFileName(file.name);
      resetResults();
    };
    reader.readAsText(file);
  };

  const handleCodeChange = (code: string) => {
    setCodeContent(code);
    if (!code) setFileName('');
  };

  const handleAnalyzeCode = async () => {
    if (!codeContent.trim() || !groqKey) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Groq-Api-Key': groqKey,
        },
        body: JSON.stringify({ code: codeContent }),
      });

      if (!response.ok) {
        if (response.status === 401) setGroqKey(null); // key rejected: ask again
        throw new Error(await errorMessage(response));
      }

      const results: AnalysisResponse = await response.json();
      setAnalysisResults(results);
      setHistory((prev) =>
        [
          {
            id: Date.now(),
            fileName: fileName || 'pasted code',
            timestamp: new Date().toLocaleTimeString(),
            results,
          },
          ...prev,
        ].slice(0, 10)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="pt-4">
          <h1 className="bg-gradient-to-r from-white via-violet-200 to-cyan-200 bg-clip-text text-4xl font-bold text-transparent">
            Cybersecurity Analyst
          </h1>
          <p className="mt-2 text-accent">
            AI-powered Python security review, combining Semgrep static analysis with Groq.
          </p>
        </header>

        <ApiKeyPanel isConnected={!!groqKey} onConnect={connectKey} onForget={forgetKey} />

        {groqKey ? (
          <>
            <CodeInput
              codeContent={codeContent}
              fileName={fileName}
              onCodeChange={handleCodeChange}
              onFileSelected={handleFileSelected}
              onLoadSample={() => {
                setCodeContent(SAMPLE_CODE);
                setFileName('sample_vulnerable_app.py');
                resetResults();
              }}
              onClear={() => {
                setCodeContent('');
                setFileName('');
                resetResults();
              }}
              onAnalyzeCode={handleAnalyzeCode}
              isAnalyzing={isAnalyzing}
            />

            <AnalysisResults
              analysisResults={analysisResults}
              isAnalyzing={isAnalyzing}
              error={error}
              fileName={fileName}
            />

            {history.length > 0 && (
              <div className="glass p-6">
                <h2 className="mb-3 text-lg font-semibold">Recent analyses (this session)</h2>
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li key={h.id}>
                      <button
                        onClick={() => {
                          setAnalysisResults(h.results);
                          setError(null);
                        }}
                        className="glass-inner flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/10"
                      >
                        <span className="truncate">{h.fileName}</span>
                        <span className="flex items-center gap-3 text-accent">
                          <span>{h.results.issues.length} issues</span>
                          <span className="font-mono">risk {riskScore(h.results)}</span>
                          <span>{h.timestamp}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          error && (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )
        )}

        <footer className="pb-6 text-center text-xs text-accent">
          Bring-your-own-key: your Groq key is used only for your requests and is never stored.
        </footer>
      </div>
    </div>
  );
}
