import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Clipboard,
  Eye,
  FileCode2,
  GitPullRequest,
  Layers3,
  ListFilter,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TestTube2,
  Wifi,
} from 'lucide-react';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const RECENT_REVIEW_IDS = (import.meta.env.VITE_RECENT_REVIEW_IDS || '142,28994,1,17351,5212')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const DEMO_REVIEWS = [
  {
    repo: 'yashpitrod/Agentic_AI',
    pr_number: 142,
    pr_title: 'feat(auth): add database user authentication',
    author: 'yashpitrod',
    reviewed_at: '2026-05-23T18:45:00Z',
    state: {
      diff: '+ admin_password = "admin123"\n+ query = "SELECT * FROM users WHERE username = " + username\n+ def send_email_and_save_user_to_db(user):\n+     db.save(user)\n+     mail.send_welcome(user.email)',
      security_findings: [
        {
          issue_type: 'Hardcoded Secret',
          severity: 'critical',
          file: 'backend/auth.py',
          description: 'A plaintext administrative password is committed in the diff.',
          line_hint: '+ admin_password = "admin123"',
        },
        {
          issue_type: 'SQL Injection',
          severity: 'critical',
          file: 'backend/auth.py',
          description: 'The query is built with raw string concatenation from user input.',
          line_hint: '+ query = "SELECT * FROM users WHERE username = " + username',
        },
      ],
      architecture_findings: [
        {
          violation_type: 'Single Responsibility Violation',
          severity: 'warning',
          description: 'The new function persists data and sends email in the same code path.',
          refactor_suggestion: 'Split persistence and notification behavior into separate services.',
        },
      ],
      test_gaps: [
        {
          function: 'send_email_and_save_user_to_db',
          file: 'backend/auth.py',
          severity: 'warning',
          missing_test: 'No success, failure, or email side-effect coverage was included.',
        },
      ],
      context_findings: [
        {
          issue: 'Function name is much longer than the established project style.',
          severity: 'info',
          location: 'backend/auth.py',
        },
      ],
    },
  },
  {
    repo: 'facebook/react',
    pr_number: 28994,
    pr_title: 'refactor(hooks): introduce nested context resolver',
    author: 'star-coder',
    reviewed_at: '2026-05-22T14:20:00Z',
    state: {
      diff: '+ class HookContextResolverGodObject {\n+   resolveEverything() {}\n+ }',
      security_findings: [],
      architecture_findings: [
        {
          violation_type: 'God Object',
          severity: 'warning',
          description: 'The resolver class combines storage, validation, and orchestration responsibilities.',
          refactor_suggestion: 'Extract store, resolver, and validator classes.',
        },
      ],
      test_gaps: [],
      context_findings: [
        {
          issue: 'The new resolver naming pattern does not match the surrounding hook utilities.',
          severity: 'info',
          location: 'packages/react-reconciler',
        },
      ],
    },
  },
  {
    repo: 'demo/repo',
    pr_number: 1,
    pr_title: 'feat: add user login and registration controllers',
    author: 'partner-contrib',
    reviewed_at: '2026-05-21T09:12:00Z',
    state: {
      diff: '+ password = "admin123"\n+ query = "SELECT * FROM users WHERE id = " + user_id',
      security_findings: [
        {
          issue_type: 'Hardcoded Secret',
          severity: 'critical',
          file: 'main.py',
          description: 'A committed password value was detected in the controller code.',
          line_hint: '+ password = "admin123"',
        },
      ],
      architecture_findings: [],
      test_gaps: [
        {
          function: 'register_user',
          file: 'main.py',
          severity: 'warning',
          missing_test: 'Missing failure-path coverage for invalid credentials.',
        },
      ],
      context_findings: [],
    },
  },
  {
    repo: 'django/django',
    pr_number: 17351,
    pr_title: 'fix(views): validate query parameters in list view',
    author: 'clean-coder',
    reviewed_at: '2026-05-20T11:05:00Z',
    state: {
      diff: '+ if user_id and user_id.isdigit():\n+     return self.model.objects.filter(id=int(user_id))',
      security_findings: [],
      architecture_findings: [],
      test_gaps: [],
      context_findings: [],
    },
  },
  {
    repo: 'pallets/flask',
    pr_number: 5212,
    pr_title: 'feat(blueprints): support custom middleware resolution',
    author: 'app-architect',
    reviewed_at: '2026-05-19T16:30:00Z',
    state: {
      diff: '+ def add_middleware(self, middleware_callable):\n+     self.before_request(middleware_callable)',
      security_findings: [],
      architecture_findings: [],
      test_gaps: [],
      context_findings: [
        {
          issue: 'Manual middleware registration differs from the decorator style used elsewhere.',
          severity: 'info',
          location: 'blueprints.py',
        },
      ],
    },
  },
];

const SECTION_CONFIG = [
  {
    id: 'security',
    title: 'Security',
    icon: ShieldAlert,
    accent: 'border-red-200 bg-red-50 text-red-900',
    empty: 'No security issues detected.',
    defaultSeverity: 'critical',
  },
  {
    id: 'architecture',
    title: 'Architecture',
    icon: Layers3,
    accent: 'border-amber-200 bg-amber-50 text-amber-950',
    empty: 'No architecture issues detected.',
    defaultSeverity: 'warning',
  },
  {
    id: 'testGaps',
    title: 'Test Gaps',
    icon: TestTube2,
    accent: 'border-sky-200 bg-sky-50 text-sky-950',
    empty: 'No test coverage gaps found.',
    defaultSeverity: 'warning',
  },
  {
    id: 'consistency',
    title: 'Consistency',
    icon: RefreshCw,
    accent: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    empty: 'No consistency issues detected.',
    defaultSeverity: 'info',
  },
];

const SEVERITY_META = {
  critical: {
    label: 'Critical',
    dot: 'bg-red-500',
    badge: 'border-red-200 bg-red-50 text-red-700',
    row: 'border-l-red-500',
  },
  warning: {
    label: 'Warning',
    dot: 'bg-amber-400',
    badge: 'border-amber-200 bg-amber-50 text-amber-800',
    row: 'border-l-amber-400',
  },
  info: {
    label: 'Info',
    dot: 'bg-emerald-500',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    row: 'border-l-emerald-500',
  },
  clean: {
    label: 'Clean',
    dot: 'bg-emerald-500',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    row: 'border-l-emerald-500',
  },
};

function normalizeFindingSeverity(value, fallback = 'info') {
  const severity = String(value || fallback).toLowerCase();
  if (severity === 'critical' || severity === 'high') return 'critical';
  if (severity === 'warning' || severity === 'medium') return 'warning';
  if (severity === 'clean' || severity === 'none') return 'clean';
  return 'info';
}

function getOverallSeverity(groups, explicitValue) {
  const explicit = normalizeFindingSeverity(explicitValue, '');
  if (explicit === 'critical' || explicit === 'warning' || explicit === 'clean') {
    return explicit;
  }

  const severities = [
    ...groups.security.map((finding) => normalizeFindingSeverity(finding.severity, 'critical')),
    ...groups.architecture.map((finding) => normalizeFindingSeverity(finding.severity, 'warning')),
    ...groups.testGaps.map((finding) => normalizeFindingSeverity(finding.severity, 'warning')),
    ...groups.consistency.map((finding) => normalizeFindingSeverity(finding.severity, 'info')),
  ];

  if (severities.includes('critical')) {
    return 'critical';
  }
  if (severities.includes('warning')) {
    return 'warning';
  }
  return 'clean';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function getReviewKey(review) {
  return `${review?.repo || 'repo'}#${review?.prNumber || review?.pr_number || '0'}`;
}

function getFindingTitle(finding, fallback) {
  return firstDefined(
    finding.issue_type,
    finding.violation_type,
    finding.title,
    finding.function,
    finding.type,
    finding.issue,
    fallback,
  );
}

function getFindingDescription(finding) {
  return firstDefined(
    finding.description,
    finding.details,
    finding.missing_test,
    finding.message,
    finding.summary,
    finding.issue,
    'No additional detail was returned by the reviewer.',
  );
}

function getFindingFile(finding) {
  return firstDefined(finding.file, finding.location, '');
}

function getFindingLine(finding) {
  return firstDefined(finding.line_hint, finding.line, finding.code, '');
}

function getFindingSuggestion(finding) {
  return firstDefined(finding.suggestion, finding.recommendation, finding.refactor_suggestion, '');
}

function getRepoName(raw, state, fallback) {
  return firstDefined(
    raw.repo,
    raw.repo_name,
    raw.repository?.full_name,
    typeof raw.repository === 'string' ? raw.repository : '',
    state.repo,
    fallback.repo,
    'demo/repo',
  );
}

function formatDate(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getShieldColor(severity) {
  const key = normalizeFindingSeverity(severity);
  if (key === 'critical') return 'red';
  if (key === 'warning') return 'orange';
  if (key === 'clean') return 'brightgreen';
  return 'blue';
}

function getShieldLabel(severity) {
  return (SEVERITY_META[normalizeFindingSeverity(severity)]?.label || 'Info').replaceAll(' ', '%20');
}

function getShieldUrl(severity) {
  return `https://img.shields.io/badge/Overall%20Severity-${getShieldLabel(severity)}-${getShieldColor(severity)}?style=for-the-badge`;
}

function getMarkdownSections(review) {
  return [
    { id: 'security', title: 'Security', items: review.sections.security, fallbackSeverity: 'critical' },
    { id: 'architecture', title: 'Architecture', items: review.sections.architecture, fallbackSeverity: 'warning' },
    { id: 'testGaps', title: 'Test Gaps', items: review.sections.testGaps, fallbackSeverity: 'warning' },
    { id: 'consistency', title: 'Context', items: review.sections.consistency, fallbackSeverity: 'info' },
  ];
}

function buildMarkdown(review) {
  const severity = SEVERITY_META[review.overallSeverity]?.label || 'Clean';
  const lines = [
    '## SilentReviewer Analysis',
    '',
    `![Overall Severity: ${severity}](${getShieldUrl(review.overallSeverity)})`,
    '',
  ];

  getMarkdownSections(review).forEach(({ title, items, fallbackSeverity }) => {
    const issueWord = items.length === 1 ? 'issue' : 'issues';
    lines.push('<details>');
    lines.push(`<summary>${title} (${items.length} ${issueWord})</summary>`);
    lines.push('');

    if (!items.length) {
      lines.push('- No findings.');
      lines.push('', '</details>', '');
      return;
    }

    items.forEach((finding) => {
      const severityLabel = SEVERITY_META[normalizeFindingSeverity(finding.severity, fallbackSeverity)]?.label || 'Info';
      const file = getFindingFile(finding);
      const line = getFindingLine(finding);
      const suggestion = getFindingSuggestion(finding);
      const parts = [`**Severity:** ${severityLabel.toLowerCase()}`];

      if (file) {
        parts.push(`**Location:** \`${file}\``);
      }
      parts.push(getFindingDescription(finding));
      if (line) {
        parts.push(`**Hint:** \`${line}\``);
      }
      if (suggestion) {
        parts.push(`**Suggestion:** ${suggestion}`);
      }

      lines.push(`- ${parts.join(' - ')}`);
    });

    lines.push('', '</details>', '');
  });

  return `${lines.join('\n').trim()}\n`;
}

function normalizeReview(rawReview, fallback = {}) {
  const raw = rawReview || {};
  const state = raw.state || {};
  const synthesis = raw.synthesis_output || raw.synthesis || raw.final_review || raw.review || {};
  const groupedFindings =
    (raw.findings && !Array.isArray(raw.findings) ? raw.findings : null) ||
    (synthesis.findings && !Array.isArray(synthesis.findings) ? synthesis.findings : null) ||
    raw.findings_by_category ||
    {};
  const flatFindings = asArray(Array.isArray(raw.findings) ? raw.findings : raw.flat_findings);

  const fromFlat = (agentName) =>
    flatFindings.filter((finding) => String(finding.agent || '').toLowerCase().includes(agentName));

  const sections = {
    security: asArray(firstDefined(state.security_findings, state.security, raw.security_findings, raw.security, groupedFindings.security, fromFlat('security'))),
    architecture: asArray(firstDefined(state.architecture_findings, state.architecture, raw.architecture_findings, raw.architecture, groupedFindings.architecture, fromFlat('architecture'))),
    testGaps: asArray(firstDefined(state.test_gaps, state.test_gap_findings, raw.test_gaps, raw.test_gap_findings, groupedFindings.test_gaps, groupedFindings.testGaps, fromFlat('test'))),
    consistency: asArray(firstDefined(state.context_findings, state.consistency_findings, state.context, raw.context_findings, raw.consistency_findings, groupedFindings.context, groupedFindings.consistency, fromFlat('context'), fromFlat('consistency'))),
  };

  const overallSeverity = getOverallSeverity(
    sections,
    firstDefined(raw.summary?.highest_severity, raw.overall_severity, synthesis.overall_severity, raw.severity),
  );

  const findingCount = firstDefined(
    raw.summary?.finding_count,
    raw.finding_count,
    sections.security.length + sections.architecture.length + sections.testGaps.length + sections.consistency.length,
  );

  const normalized = {
    reviewId: firstDefined(raw.review_id, raw.id, raw.pr_id, fallback.reviewId, raw.pr_number, fallback.prNumber, 0),
    repo: getRepoName(raw, state, fallback),
    prNumber: Number(firstDefined(raw.pr_number, raw.pr_id, raw.number, state.pr_number, fallback.prNumber, 0)),
    title: firstDefined(raw.pr_title, raw.title, fallback.title, 'Manual diff review'),
    author: firstDefined(raw.author, raw.user?.login, fallback.author, 'SilentReviewer'),
    reviewedAt: firstDefined(raw.reviewed_at, raw.created_at, raw.date, fallback.reviewedAt, new Date().toISOString()),
    diff: firstDefined(state.diff, raw.diff, raw.pr_diff, raw.diff_text, fallback.diff, ''),
    summaryText: firstDefined(raw.summary?.text, raw.summary_text, synthesis.summary_text, raw.description, ''),
    commentUrl: firstDefined(raw.comment_url, raw.github_comment_url, raw.comment?.html_url, raw.html_url, ''),
    sections,
    findingCount: Number(findingCount) || 0,
    overallSeverity,
    source: fallback.source || raw.source || 'api',
  };

  normalized.markdown = firstDefined(raw.markdown, raw.comment_markdown, raw.github_comment, raw.comment_body, buildMarkdown(normalized));
  return normalized;
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function checkApiHealth() {
  try {
    await fetchJson('/health');
    return true;
  } catch {
    return false;
  }
}

function extractReviewList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const candidates = [
    payload.reviews,
    payload.items,
    payload.results,
    payload.data,
    payload.history,
    payload.recent,
  ];

  const list = candidates.find(Array.isArray);
  return list || [];
}

async function fetchReviewCollection() {
  const endpoints = ['/reviews?limit=5', '/reviews/recent?limit=5', '/reviews'];

  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson(endpoint);
      const list = extractReviewList(payload);
      if (list.length) {
        return {
          endpoint,
          reviews: list.map((item) => normalizeReview(item, { source: 'api' })),
        };
      }
    } catch {
      // Try the next likely collection route.
    }
  }

  return { endpoint: '', reviews: [] };
}

function mergeReviews(...reviewLists) {
  const map = new Map();

  reviewLists.flat().forEach((review) => {
    if (!review) return;
    const key = getReviewKey(review);
    if (!map.has(key)) {
      map.set(key, review);
    }
  });

  return Array.from(map.values())
    .sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime())
    .slice(0, 5);
}

function readSavedReviews() {
  try {
    const parsed = JSON.parse(localStorage.getItem('silentreviewer.recent') || '[]');
    return asArray(parsed).map((item) => normalizeReview(item, { source: 'saved' }));
  } catch {
    return [];
  }
}

function saveRecentReviews(reviews) {
  localStorage.setItem('silentreviewer.recent', JSON.stringify(reviews.slice(0, 5)));
}

function SeverityBadge({ severity, compact = false }) {
  const key = normalizeFindingSeverity(severity);
  const meta = SEVERITY_META[key] || SEVERITY_META.info;

  return (
    <span className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-bold uppercase tracking-wide ${meta.badge}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
      {!compact && meta.label}
    </span>
  );
}

function StatusPill({ status }) {
  const styles = {
    live: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    partial: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    loading: 'border-sky-200 bg-sky-50 text-sky-700',
    demo: 'border-amber-200 bg-amber-50 text-amber-800',
    error: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <span className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-bold ${styles[status.kind] || styles.demo}`}>
      {status.kind === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status.kind === 'partial' ? <Wifi className="h-3.5 w-3.5" /> : <CircleDot className="h-3.5 w-3.5" />}
      {status.label}
    </span>
  );
}

function ReviewRow({ review, isSelected, onSelect }) {
  const severity = SEVERITY_META[review.overallSeverity] || SEVERITY_META.clean;

  return (
    <button
      type="button"
      onClick={() => onSelect(review)}
      className={`grid w-full grid-cols-1 gap-4 border-l-4 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:grid-cols-[1.4fr_2fr_120px_90px] md:items-center ${severity.row} ${
        isSelected ? 'ring-2 ring-slate-950' : 'ring-1 ring-slate-200'
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
          <GitPullRequest className="h-4 w-4 text-slate-500" />
          <span className="truncate">{review.repo}</span>
        </div>
        <div className="mt-1 text-xs font-semibold text-slate-500">PR #{review.prNumber}</div>
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-slate-950">{review.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{review.author}</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>{formatDate(review.reviewedAt)}</span>
        </div>
      </div>

      <SeverityBadge severity={review.overallSeverity} />

      <div className="text-sm font-bold text-slate-700">
        {review.findingCount}
        <span className="ml-1 text-xs font-semibold text-slate-500">findings</span>
      </div>
    </button>
  );
}

function FindingCard({ finding, fallbackSeverity }) {
  const severity = normalizeFindingSeverity(finding.severity, fallbackSeverity);
  const file = getFindingFile(finding);
  const line = getFindingLine(finding);
  const suggestion = getFindingSuggestion(finding);

  return (
    <article className="border-l-4 border-slate-300 bg-white p-4 ring-1 ring-slate-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-950">{getFindingTitle(finding, 'Finding')}</h4>
          {file && <div className="mt-1 font-mono text-xs text-slate-500">{file}</div>}
        </div>
        <SeverityBadge severity={severity} />
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-700">{getFindingDescription(finding)}</p>

      {suggestion && (
        <div className="mt-3 border-l-2 border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span className="font-bold">Suggestion:</span> {suggestion}
        </div>
      )}

      {line && (
        <pre className="mt-3 overflow-x-auto bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100">
          <code>{line}</code>
        </pre>
      )}
    </article>
  );
}

function FindingSection({ config, findings, isOpen, onToggle }) {
  const Icon = config.icon;

  return (
    <section className="overflow-hidden bg-white ring-1 ring-slate-200">
      <button
        type="button"
        onClick={onToggle}
        className={`flex min-h-16 w-full items-center justify-between gap-4 border-l-4 px-4 py-3 text-left ${config.accent}`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Icon className="h-5 w-5 shrink-0" />
          <span className="truncate text-base font-black">{config.title}</span>
          <span className="rounded-full bg-white/75 px-2 py-1 text-xs font-bold">{findings.length}</span>
        </span>
        {isOpen ? <ChevronUp className="h-5 w-5 shrink-0" /> : <ChevronDown className="h-5 w-5 shrink-0" />}
      </button>

      {isOpen && (
        <div className="space-y-3 bg-slate-50 p-4">
          {findings.length ? (
            findings.map((finding, index) => (
              <FindingCard
                key={`${getFindingTitle(finding, config.title)}-${index}`}
                finding={finding}
                fallbackSeverity={config.defaultSeverity}
              />
            ))
          ) : (
            <div className="flex items-center gap-3 bg-white p-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              {config.empty}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function RenderedGitHubComment({ review }) {
  const sections = getMarkdownSections(review);

  return (
    <div className="max-h-[680px] overflow-auto bg-white p-4 text-sm text-slate-800">
      <div className="border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-black text-slate-950">SilentReviewer Analysis</h3>

        <div className="mt-3">
          <img
            src={getShieldUrl(review.overallSeverity)}
            alt={`Overall Severity: ${SEVERITY_META[review.overallSeverity]?.label || 'Info'}`}
            className="h-7 w-auto"
          />
        </div>

        {review.summaryText && (
          <p className="mt-4 border-l-4 border-slate-300 bg-slate-50 px-3 py-2 leading-6 text-slate-700">
            {review.summaryText}
          </p>
        )}

        <div className="mt-4 space-y-3">
          {sections.map((section) => {
            const config = SECTION_CONFIG.find((item) => item.id === section.id);
            const Icon = config?.icon || CheckCircle2;
            const issueWord = section.items.length === 1 ? 'issue' : 'issues';

            return (
              <details key={section.id} open className="rounded-md border border-slate-200 bg-slate-50">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-black text-slate-900">
                  <Icon className="h-4 w-4 text-slate-500" />
                  <span>{section.title}</span>
                  <span className="ml-auto rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-500">
                    {section.items.length} {issueWord}
                  </span>
                </summary>

                <div className="space-y-2 border-t border-slate-200 p-3">
                  {section.items.length ? (
                    section.items.map((finding, index) => {
                      const severity = normalizeFindingSeverity(finding.severity, section.fallbackSeverity);
                      const file = getFindingFile(finding);
                      const line = getFindingLine(finding);
                      const suggestion = getFindingSuggestion(finding);

                      return (
                        <div key={`${section.id}-${index}`} className="rounded-md bg-white p-3 ring-1 ring-slate-200">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 text-sm font-bold text-slate-950">
                              {getFindingTitle(finding, 'Finding')}
                            </div>
                            <SeverityBadge severity={severity} />
                          </div>
                          {file && <div className="mt-1 font-mono text-xs text-slate-500">{file}</div>}
                          <p className="mt-2 leading-6 text-slate-700">{getFindingDescription(finding)}</p>
                          {line && (
                            <code className="mt-2 block overflow-x-auto rounded bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100">
                              {line}
                            </code>
                          )}
                          {suggestion && <p className="mt-2 text-sm text-amber-900"><strong>Suggestion:</strong> {suggestion}</p>}
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex items-center gap-2 rounded-md bg-white p-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
                      <CheckCircle2 className="h-4 w-4" />
                      No findings.
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GitHubPreview({ review }) {
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState('rendered');

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(review.markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <aside className="bg-white ring-1 ring-slate-200 lg:sticky lg:top-6">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-black text-slate-950">
          <Eye className="h-4 w-4 text-slate-500" />
          GitHub Comment Preview
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md bg-slate-100 p-1">
            {[
              ['rendered', Eye, 'Rendered'],
              ['raw', FileCode2, 'Raw'],
            ].map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`inline-flex h-8 items-center gap-1.5 rounded px-2 text-xs font-black transition ${
                  mode === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={copyMarkdown}
            title="Copy markdown"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            <Clipboard className="h-4 w-4" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {mode === 'rendered' ? (
        <RenderedGitHubComment review={review} />
      ) : (
        <pre className="max-h-[680px] overflow-auto whitespace-pre-wrap bg-[#0f172a] p-4 font-mono text-xs leading-6 text-slate-100">
          {review.markdown}
        </pre>
      )}

      {review.commentUrl && (
        <a
          href={review.commentUrl}
          target="_blank"
          rel="noreferrer"
          className="block border-t border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
        >
          Open posted GitHub comment
        </a>
      )}
    </aside>
  );
}

function Dashboard({ reviews, selectedReview, onSelect, onRefresh, status, isRefreshing, onManualReview }) {
  const [query, setQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [form, setForm] = useState({
    repo: 'manual/demo',
    prNumber: '0',
    diff: '+ password = "admin123"\n+ def send_email_and_save_user_to_db(user):\n+     pass',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      const matchesQuery = [review.repo, review.title, review.author, String(review.prNumber)]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesSeverity = severityFilter === 'all' || review.overallSeverity === severityFilter;
      return matchesQuery && matchesSeverity;
    });
  }, [query, reviews, severityFilter]);

  const counts = useMemo(() => {
    return reviews.reduce(
      (acc, review) => {
        acc[review.overallSeverity] = (acc[review.overallSeverity] || 0) + 1;
        return acc;
      },
      { critical: 0, warning: 0, clean: 0 },
    );
  }, [reviews]);

  const submitManualReview = async (event) => {
    event.preventDefault();
    if (!form.diff.trim()) {
      setFormError('Diff is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await onManualReview({
        repo: form.repo.trim() || 'manual/demo',
        pr_number: Number(form.prNumber) || 0,
        diff: form.diff,
      });
    } catch (error) {
      setFormError(error.message || 'Review request failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white">
              <GitPullRequest className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-normal text-slate-950">SilentReviewer</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">Reviewed pull requests dashboard</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <StatusPill status={status} />
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh reviews"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-400"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['Critical', counts.critical, 'critical'],
          ['Warning', counts.warning, 'warning'],
          ['Clean', counts.clean, 'clean'],
        ].map(([label, count, severity]) => (
          <div key={label} className="bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-500">{label}</span>
              <SeverityBadge severity={severity} compact />
            </div>
            <div className="mt-3 text-3xl font-black text-slate-950">{count}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200 md:flex-row md:items-center">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search repo, PR, author"
                className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </label>

            <div className="flex items-center gap-2 overflow-x-auto">
              <ListFilter className="h-4 w-4 shrink-0 text-slate-400" />
              {['all', 'critical', 'warning', 'clean'].map((severity) => (
                <button
                  type="button"
                  key={severity}
                  onClick={() => setSeverityFilter(severity)}
                  className={`h-10 rounded-md px-3 text-xs font-black uppercase transition ${
                    severityFilter === severity
                      ? 'bg-slate-950 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {severity}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Last 5 PRs Reviewed</h2>
            <span className="text-xs font-bold text-slate-400">{filteredReviews.length} visible</span>
          </div>

          <div className="space-y-3">
            {filteredReviews.length ? (
              filteredReviews.map((review) => (
                <ReviewRow
                  key={getReviewKey(review)}
                  review={review}
                  isSelected={getReviewKey(review) === getReviewKey(selectedReview)}
                  onSelect={onSelect}
                />
              ))
            ) : (
              <div className="bg-white p-8 text-center ring-1 ring-slate-200">
                <AlertTriangle className="mx-auto h-6 w-6 text-amber-500" />
                <p className="mt-3 text-sm font-bold text-slate-600">No matching reviews found.</p>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Sparkles className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">Run Live Review</h2>
          </div>

          <form onSubmit={submitManualReview} className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Repository</span>
              <input
                value={form.repo}
                onChange={(event) => setForm((current) => ({ ...current, repo: event.target.value }))}
                className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">PR Number</span>
              <input
                value={form.prNumber}
                onChange={(event) => setForm((current) => ({ ...current, prNumber: event.target.value }))}
                className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Diff</span>
              <textarea
                value={form.diff}
                onChange={(event) => setForm((current) => ({ ...current, diff: event.target.value }))}
                rows={9}
                className="w-full resize-y rounded-md border border-slate-200 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 outline-none transition focus:border-slate-500"
              />
            </label>

            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitPullRequest className="h-4 w-4" />}
              Review Diff
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function DetailView({ review, onBack, onRefreshDetail, isLoadingDetail }) {
  const [openSections, setOpenSections] = useState({
    security: true,
    architecture: true,
    testGaps: true,
    consistency: true,
  });

  const toggleSection = (section) => {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }));
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 w-max items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </button>

        <button
          type="button"
          onClick={() => onRefreshDetail(review)}
          title="Fetch latest detail"
          className="inline-flex h-10 w-max items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-400"
        >
          <RefreshCw className={`h-4 w-4 ${isLoadingDetail ? 'animate-spin' : ''}`} />
          Fetch Detail
        </button>
      </div>

      <section className="bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500">
              <span>{review.repo}</span>
              <span>PR #{review.prNumber}</span>
            </div>
            <h1 className="mt-2 max-w-4xl text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
              {review.title}
            </h1>
          </div>
          <SeverityBadge severity={review.overallSeverity} />
        </div>

        <div className="mt-5 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Author', review.author],
            ['Reviewed', formatDate(review.reviewedAt)],
            ['Findings', review.findingCount],
            ['Comment', `${review.markdown.length.toLocaleString()} chars`],
          ].map(([label, value]) => (
            <div key={label} className="bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
              <div className="mt-1 truncate text-sm font-black text-slate-800">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
        <div className="space-y-4">
          {SECTION_CONFIG.map((config) => (
            <FindingSection
              key={config.id}
              config={config}
              findings={review.sections[config.id]}
              isOpen={openSections[config.id]}
              onToggle={() => toggleSection(config.id)}
            />
          ))}
        </div>

        <GitHubPreview review={review} />
      </div>
    </main>
  );
}

export default function App() {
  const [reviews, setReviews] = useState(() => mergeReviews(readSavedReviews(), DEMO_REVIEWS.map((review) => normalizeReview(review, { source: 'demo' }))));
  const [selectedReview, setSelectedReview] = useState(null);
  const [status, setStatus] = useState({ kind: 'loading', label: 'Checking API' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchReviewById = useCallback(async (reviewId) => {
    const rawReview = await fetchJson(`/reviews/${reviewId}`);
    return normalizeReview(rawReview, { source: 'api', reviewId, prNumber: reviewId });
  }, []);

  const loadReviews = useCallback(async () => {
    setIsRefreshing(true);
    setStatus({ kind: 'loading', label: 'Checking API' });

    const savedReviews = readSavedReviews();
    const demoReviews = DEMO_REVIEWS.map((review) => normalizeReview(review, { source: 'demo' }));
    const apiOnline = await checkApiHealth();

    try {
      const collection = await fetchReviewCollection();
      if (collection.reviews.length) {
        const merged = mergeReviews(collection.reviews, savedReviews, demoReviews);
        setReviews(merged);
        saveRecentReviews(merged);
        setStatus({ kind: 'live', label: `Live ${collection.endpoint}` });
        return;
      }

      const fetchedReviews = await Promise.allSettled(
        RECENT_REVIEW_IDS.map((reviewId) => fetchReviewById(reviewId)),
      );
      const liveReviews = fetchedReviews
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);

      if (liveReviews.length) {
        const merged = mergeReviews(liveReviews, savedReviews, demoReviews);
        setReviews(merged);
        saveRecentReviews(merged);
        setStatus({ kind: 'live', label: `${liveReviews.length} live details` });
        return;
      }

      const merged = mergeReviews(savedReviews, demoReviews);
      setReviews(merged);
      setStatus(apiOnline ? { kind: 'partial', label: 'API online, demo recent' } : { kind: 'demo', label: 'Demo fallback' });
    } catch {
      const merged = mergeReviews(savedReviews, demoReviews);
      setReviews(merged);
      setStatus(apiOnline ? { kind: 'partial', label: 'API online, demo recent' } : { kind: 'demo', label: 'Demo fallback' });
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchReviewById]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadReviews();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadReviews]);

  const selectReview = async (review) => {
    setSelectedReview(review);
    const detailId = review.reviewId || review.prNumber;
    if (!detailId) return;

    setIsLoadingDetail(true);
    try {
      const freshReview = await fetchReviewById(detailId);
      setSelectedReview(freshReview);
      setReviews((current) => {
        const merged = mergeReviews([freshReview], current);
        saveRecentReviews(merged);
        return merged;
      });
      setStatus({ kind: 'live', label: 'Detail from API' });
    } catch {
      setStatus((current) => (current.kind === 'live' ? current : { kind: 'demo', label: 'Demo fallback' }));
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const refreshDetail = async (review) => {
    const detailId = review?.reviewId || review?.prNumber;
    if (!detailId) return;
    setIsLoadingDetail(true);
    try {
      const freshReview = await fetchReviewById(detailId);
      setSelectedReview(freshReview);
      setReviews((current) => {
        const merged = mergeReviews([freshReview], current);
        saveRecentReviews(merged);
        return merged;
      });
      setStatus({ kind: 'live', label: 'Detail from API' });
    } catch (error) {
      setStatus({ kind: 'error', label: error.message || 'Detail unavailable' });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const runManualReview = async (payload) => {
    const rawReview = await fetchJson('/review', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const review = normalizeReview(rawReview, {
      source: 'api',
      repo: payload.repo,
      prNumber: payload.pr_number,
      title: `Manual review for ${payload.repo}#${payload.pr_number}`,
      diff: payload.diff,
      author: 'Live API',
      reviewedAt: new Date().toISOString(),
    });

    setReviews((current) => {
      const merged = mergeReviews([review], current);
      saveRecentReviews(merged);
      return merged;
    });
    setSelectedReview(review);
    setStatus({ kind: 'live', label: 'Manual review saved' });
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-950">
      {selectedReview ? (
        <DetailView
          review={selectedReview}
          onBack={() => setSelectedReview(null)}
          onRefreshDetail={refreshDetail}
          isLoadingDetail={isLoadingDetail}
        />
      ) : (
        <Dashboard
          reviews={reviews}
          selectedReview={selectedReview}
          onSelect={selectReview}
          onRefresh={loadReviews}
          status={status}
          isRefreshing={isRefreshing}
          onManualReview={runManualReview}
        />
      )}
    </div>
  );
}
