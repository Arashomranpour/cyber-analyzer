/**
 * Type definitions for security analysis components
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityIssue {
  title: string;
  description: string;
  code: string;
  fix: string;
  cvss_score: number;
  severity: Severity;
  cwe?: string;
  owasp?: string;
}

export interface AnalysisResponse {
  summary: string;
  issues: SecurityIssue[];
}

export interface HistoryEntry {
  id: number;
  fileName: string;
  timestamp: string;
  results: AnalysisResponse;
}

export interface ApiKeyPanelProps {
  isConnected: boolean;
  onConnect: (key: string) => Promise<string | null>;
  onForget: () => void;
}

export interface CodeInputProps {
  codeContent: string;
  fileName: string;
  onCodeChange: (code: string) => void;
  onFileSelected: (file: File) => void;
  onLoadSample: () => void;
  onClear: () => void;
  onAnalyzeCode: () => void;
  isAnalyzing: boolean;
}

export interface AnalysisResultsProps {
  analysisResults: AnalysisResponse | null;
  isAnalyzing: boolean;
  error: string | null;
  fileName: string;
}
