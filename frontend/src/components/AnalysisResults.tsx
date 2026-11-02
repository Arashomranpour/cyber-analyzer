'use client'

import { useMemo, useState } from 'react';
import { AnalysisResultsProps, Severity } from '@/types/security';
import {
  SEVERITIES,
  SEVERITY_STYLES,
  countBySeverity,
  downloadFile,
  riskLabel,
  riskScore,
  toMarkdown,
} from '@/lib/report';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn-ghost !px-2.5 !py-1 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  );
}

/**
 * Results: risk gauge, severity breakdown, filterable/searchable issue cards, report export.
 */
export default function AnalysisResults({
  analysisResults,
  isAnalyzing,
  error,
  fileName,
}: AnalysisResultsProps) {
  const [filter, setFilter] = useState<Severity | 'all'>('all');
  const [query, setQuery] = useState('');
  const [openIdx, setOpenIdx] = useState<Set<number>>(new Set([0]));

  const counts = useMemo(
    () => (analysisResults ? countBySeverity(analysisResults) : null),
    [analysisResults]
  );

  const visible = useMemo(() => {
    if (!analysisResults) return [];
    const q = query.trim().toLowerCase();
    return analysisResults.issues
      .map((issue, idx) => ({ issue, idx }))
      .filter(({ issue }) => filter === 'all' || issue.severity === filter)
      .filter(
        ({ issue }) =>
          !q ||
          `${issue.title} ${issue.description} ${issue.cwe ?? ''} ${issue.owasp ?? ''}`
            .toLowerCase()
            .includes(q)
      );
  }, [analysisResults, filter, query]);

  const toggle = (idx: number) =>
    setOpenIdx((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const base = (fileName || 'security-report').replace(/\.py$/, '');

  return (
    <div className="glass flex flex-col p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Results of analysis</h2>
        {analysisResults && (
          <div className="flex gap-2">
            <button
              className="btn-ghost"
              onClick={() => downloadFile(`${base}-report.md`, toMarkdown(analysisResults, fileName), 'text/markdown')}
            >
              Export Markdown
            </button>
            <button
              className="btn-ghost"
              onClick={() =>
                downloadFile(`${base}-report.json`, JSON.stringify(analysisResults, null, 2), 'application/json')
              }
            >
              Export JSON
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!analysisResults && !error && (
        <div className="glass-inner p-8 text-center text-sm text-accent">
          {isAnalyzing ? (
            <span className="inline-flex items-center gap-3">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-secondary" />
              Running Semgrep and AI analysis… this can take a minute.
            </span>
          ) : (
            'Paste or upload Python code and press “Analyze code” to see the security assessment here.'
          )}
        </div>
      )}

      {analysisResults && counts && (
        <div className="space-y-5">
          {/* Overview: risk gauge + severity breakdown */}
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="glass-inner flex flex-col items-center justify-center p-5">
              <div className="text-xs uppercase tracking-wider text-accent">Risk score</div>
              <div className="bg-gradient-to-r from-secondary to-primary bg-clip-text text-5xl font-bold text-transparent">
                {riskScore(analysisResults)}
                <span className="text-lg text-accent">/100</span>
              </div>
              <div className="mt-1 text-sm">{riskLabel(riskScore(analysisResults))}</div>
            </div>

            <div className="glass-inner space-y-2 p-5">
              {SEVERITIES.map((sev) => {
                const total = Math.max(analysisResults.issues.length, 1);
                return (
                  <div key={sev} className="flex items-center gap-3 text-sm">
                    <span className={`w-16 capitalize ${SEVERITY_STYLES[sev].text}`}>{sev}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${SEVERITY_STYLES[sev].bar}`}
                        style={{ width: `${(counts[sev] / total) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right font-mono">{counts[sev]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-inner p-4">
            <h3 className="mb-1 font-semibold">Summary</h3>
            <p className="text-sm text-slate-300">{analysisResults.summary}</p>
          </div>

          {analysisResults.issues.length > 0 && (
            <>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {(['all', ...SEVERITIES] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setFilter(sev)}
                    className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                      filter === sev
                        ? 'border-secondary bg-secondary/20 text-white'
                        : 'border-white/15 bg-white/5 text-accent hover:bg-white/10'
                    }`}
                  >
                    {sev === 'all' ? `All (${analysisResults.issues.length})` : `${sev} (${counts[sev]})`}
                  </button>
                ))}
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search issues, CWE, OWASP…"
                  className="field ml-auto w-full px-3 py-1.5 text-sm sm:w-64"
                />
              </div>

              {/* Issue cards */}
              <div className="space-y-3">
                {visible.length === 0 && (
                  <p className="text-center text-sm text-accent">No issues match your filters.</p>
                )}
                {visible.map(({ issue, idx }) => {
                  const open = openIdx.has(idx);
                  const style = SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.low;
                  return (
                    <div key={idx} className="glass-inner overflow-hidden">
                      <button
                        onClick={() => toggle(idx)}
                        className="flex w-full items-center gap-3 p-4 text-left hover:bg-white/5"
                        aria-expanded={open}
                      >
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${style.badge}`}>
                          {issue.severity}
                        </span>
                        <span className="flex-1 font-medium">{issue.title}</span>
                        {issue.cwe && (
                          <span className="hidden rounded bg-white/10 px-2 py-0.5 font-mono text-xs sm:inline">
                            {issue.cwe}
                          </span>
                        )}
                        <span className="font-mono text-sm text-accent">CVSS {issue.cvss_score.toFixed(1)}</span>
                        <span className={`text-accent transition ${open ? 'rotate-180' : ''}`}>▾</span>
                      </button>

                      {open && (
                        <div className="space-y-4 border-t border-white/10 p-4 text-sm">
                          {issue.owasp && <p className="text-xs text-accent">OWASP: {issue.owasp}</p>}
                          <p className="text-slate-300">{issue.description}</p>

                          <div>
                            <div className="mb-1 text-xs uppercase tracking-wider text-red-300">Vulnerable code</div>
                            <pre className="overflow-x-auto rounded-lg border border-red-400/20 bg-red-500/10 p-3 font-mono text-xs text-red-200">
                              {issue.code}
                            </pre>
                          </div>

                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-xs uppercase tracking-wider text-emerald-300">Recommended fix</span>
                              <CopyButton text={issue.fix} />
                            </div>
                            <pre className="overflow-x-auto rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 font-mono text-xs text-emerald-200">
                              {issue.fix}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
