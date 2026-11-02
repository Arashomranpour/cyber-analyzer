import { AnalysisResponse, Severity } from '@/types/security';

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];

/** Tailwind classes per severity (dark glass theme) */
export const SEVERITY_STYLES: Record<Severity, { badge: string; bar: string; text: string }> = {
  critical: { badge: 'bg-red-500/20 text-red-300 border-red-400/40', bar: 'bg-red-500', text: 'text-red-300' },
  high: { badge: 'bg-orange-500/20 text-orange-300 border-orange-400/40', bar: 'bg-orange-500', text: 'text-orange-300' },
  medium: { badge: 'bg-yellow-500/20 text-yellow-200 border-yellow-400/40', bar: 'bg-yellow-400', text: 'text-yellow-200' },
  low: { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40', bar: 'bg-emerald-500', text: 'text-emerald-300' },
};

export function countBySeverity(results: AnalysisResponse): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of results.issues) {
    if (issue.severity in counts) counts[issue.severity] += 1;
  }
  return counts;
}

/** 0-100 risk score: the worst finding dominates, with a small bump per extra issue. */
export function riskScore(results: AnalysisResponse): number {
  if (results.issues.length === 0) return 0;
  const worst = Math.max(...results.issues.map((i) => i.cvss_score));
  return Math.min(100, Math.round(worst * 9 + Math.min(results.issues.length - 1, 10)));
}

export function riskLabel(score: number): string {
  if (score >= 80) return 'Critical risk';
  if (score >= 60) return 'High risk';
  if (score >= 35) return 'Moderate risk';
  if (score > 0) return 'Low risk';
  return 'No issues found';
}

export function toMarkdown(results: AnalysisResponse, fileName: string): string {
  const lines = [
    `# Security report${fileName ? `: ${fileName}` : ''}`,
    '',
    results.summary,
    '',
    `Risk score: ${riskScore(results)}/100 (${riskLabel(riskScore(results))})`,
    '',
  ];
  results.issues.forEach((issue, i) => {
    lines.push(`## ${i + 1}. ${issue.title}`);
    lines.push(
      `**Severity:** ${issue.severity} | **CVSS:** ${issue.cvss_score}` +
        (issue.cwe ? ` | **${issue.cwe}**` : '') +
        (issue.owasp ? ` | ${issue.owasp}` : '')
    );
    lines.push('', issue.description, '', '**Vulnerable code**', '```python', issue.code, '```', '');
    lines.push('**Recommended fix**', '```python', issue.fix, '```', '');
  });
  return lines.join('\n');
}

export function downloadFile(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
