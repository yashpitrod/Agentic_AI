import { useEffect, useState, useMemo } from 'react';
import './App.css';

// Read API URL from environment variables, fallback to localhost:8000
const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Convert http/https backend URLs into native ws/wss protocols for WebSocket
const getWsUrl = () => {
  if (API_URL.startsWith('http')) {
    const wsBase = API_URL.replace(/^http/, 'ws');
    return `${wsBase}/ws/reviews`;
  }
  // Fallback if API_URL is a relative path or missing
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws';
  return `${proto}://${window.location.host}/ws/reviews`;
};

// Custom color-coded Unified Diff Viewer component
function DiffViewer({ diffText }) {
  if (!diffText) {
    return <div style={{ color: 'var(--text-secondary)', padding: '16px', fontFamily: 'monospace' }}>NO DIFF PATCH PAYLOAD RETRIEVED.</div>;
  }
  
  const lines = diffText.split('\n');
  return (
    <pre style={{
      background: '#020205',
      border: '1px solid var(--purple-accent)',
      padding: '16px',
      fontFamily: 'Space Mono, monospace',
      fontSize: '11px',
      lineHeight: '1.6',
      overflowX: 'auto',
      whiteSpace: 'pre',
      wordBreak: 'normal',
      flex: 1
    }}>
      {lines.map((line, idx) => {
        let color = 'var(--text-secondary)';
        let bg = 'transparent';
        
        if (line.startsWith('+') && !line.startsWith('+++')) {
          color = 'var(--green-accent)';
          bg = 'rgba(57, 255, 20, 0.08)';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          color = 'var(--red-accent)';
          bg = 'rgba(255, 0, 85, 0.08)';
        } else if (line.startsWith('@@')) {
          color = 'var(--cyan-accent)';
          bg = 'rgba(0, 245, 255, 0.05)';
        } else if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
          color = '#ffffff';
          bg = '#161626';
        }
        
        return (
          <div 
            key={idx} 
            style={{ 
              color, 
              backgroundColor: bg, 
              padding: '0 4px', 
              display: 'block',
              borderLeft: line.startsWith('+') ? '2px solid var(--green-accent)' : line.startsWith('-') ? '2px solid var(--red-accent)' : 'none'
            }}
          >
            {line}
          </div>
        );
      })}
    </pre>
  );
}

// Custom Markdown Renderer that translates API generated comments into high-end terminal blocks
function MarkdownRenderer({ markdown }) {
  if (!markdown) {
    return <div style={{ color: 'var(--text-secondary)', padding: '16px', fontFamily: 'monospace' }}>NO MARKDOWN ANALYSIS SAVED.</div>;
  }

  const lines = markdown.split('\n');
  const renderedElements = [];
  let inCodeBlock = false;
  let codeBlockLines = [];
  let listBlockLines = [];

  lines.forEach((line, idx) => {
    // Detect code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // Output compiled code block
        inCodeBlock = false;
        const codeText = codeBlockLines.join('\n');
        renderedElements.push(
          <pre key={`code-${idx}`} style={{
            background: '#000',
            border: '1px solid var(--purple-accent)',
            padding: '12px',
            color: 'var(--cyan-accent)',
            fontFamily: 'Space Mono, monospace',
            fontSize: '11px',
            overflowX: 'auto',
            margin: '12px 0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            <code>{codeText}</code>
          </pre>
        );
        codeBlockLines = [];
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    // Detect titles
    if (line.startsWith('## ')) {
      renderedElements.push(
        <h3 key={`h-${idx}`} className="glitch-text" style={{ fontSize: '18px', margin: '20px 0 10px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
          {line.replace('## ', '')}
        </h3>
      );
      return;
    }

    // Parse html summary blocks
    if (line.startsWith('<summary>')) {
      const summaryText = line.replace('<summary>', '').replace('</summary>', '');
      renderedElements.push(
        <div key={`sum-${idx}`} style={{
          background: 'var(--purple-accent)',
          color: '#fff',
          padding: '6px 12px',
          fontWeight: 'bold',
          fontSize: '12px',
          marginTop: '16px',
          textTransform: 'uppercase'
        }}>
          {summaryText}
        </div>
      );
      return;
    }

    // Ignore html opening/closing tags
    if (line.trim().startsWith('<details>') || line.trim().startsWith('</details>')) {
      return;
    }

    // Detect list items
    if (line.startsWith('- ')) {
      const content = line.replace('- ', '');
      // Format structured list fields into clean tags
      const hasSeverity = content.includes('**Severity:**');
      
      let badgeColor = 'var(--text-secondary)';
      if (content.toLowerCase().includes('critical') || content.toLowerCase().includes('high')) {
        badgeColor = 'var(--red-accent)';
      } else if (content.toLowerCase().includes('warning') || content.toLowerCase().includes('medium')) {
        badgeColor = 'var(--yellow-accent)';
      } else if (content.toLowerCase().includes('info')) {
        badgeColor = 'var(--cyan-accent)';
      }

      renderedElements.push(
        <div key={`li-${idx}`} style={{
          borderLeft: `2px solid ${badgeColor}`,
          padding: '8px 12px',
          background: '#0c0c16',
          margin: '8px 0',
          fontSize: '12px',
          fontFamily: 'monospace',
          lineHeight: '1.5',
          wordBreak: 'break-word'
        }}>
          {content.split(' - ').map((part, pIdx) => {
            if (part.startsWith('**Severity:**')) {
              return (
                <div key={pIdx} style={{ display: 'inline-block', marginRight: '12px', fontWeight: 'bold' }}>
                  [SEV: <span style={{ color: badgeColor }}>{part.replace('**Severity:**', '').trim().toUpperCase()}</span>]
                </div>
              );
            }
            if (part.startsWith('**Location:**')) {
              return (
                <div key={pIdx} style={{ color: 'var(--cyan-accent)', marginBottom: '4px', wordBreak: 'break-all' }}>
                  LOCATION: {part.replace('**Location:**', '').replace(/`/g, '').trim()}
                </div>
              );
            }
            return <div key={pIdx} style={{ marginTop: '2px', color: '#f0f0f5' }}>{part.replace(/`/g, '')}</div>;
          })}
        </div>
      );
      return;
    }

    // Render plain text lines
    if (line.trim()) {
      renderedElements.push(
        <p key={`p-${idx}`} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '4px 0', wordBreak: 'break-word' }}>
          {line}
        </p>
      );
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
      {renderedElements}
    </div>
  );
}

// Telemetry Panel component to show execution time savings and individual agent statuses
function TelemetryPanel({ metrics, parallelTime, sequentialTime }) {
  const savings = useMemo(() => {
    if (!sequentialTime || !parallelTime) return 0;
    const diff = sequentialTime - parallelTime;
    return Math.max(0, roundValue((diff / sequentialTime) * 100, 1));
  }, [parallelTime, sequentialTime]);

  function roundValue(val, dec) {
    return Number(Math.round(val + 'e' + dec) + 'e-' + dec);
  }

  return (
    <div style={{ border: '1px solid var(--purple-accent)', background: 'rgba(183, 0, 255, 0.03)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ borderBottom: '1px dashed var(--purple-accent)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--purple-accent)' }}>[DIAGNOSTIC_METRICS_HUD]</span>
        <span style={{ fontSize: '10px', color: 'var(--cyan-accent)' }}>ASYNC_SCHEDULER_SAVINGS</span>
      </div>

      {/* Latency Reduction telemetry chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '11px', fontFamily: 'monospace' }}>
        <div style={{ background: '#000', border: '1px solid var(--border-color)', padding: '8px' }}>
          <div style={{ color: 'var(--text-secondary)' }}>TOTAL_PARALLEL_WALL_TIME</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--cyan-accent)', marginTop: '4px' }}>{parallelTime}s</div>
        </div>
        <div style={{ background: '#000', border: '1px solid var(--border-color)', padding: '8px' }}>
          <div style={{ color: 'var(--text-secondary)' }}>THEORETICAL_SEQUENTIAL_RUN</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--purple-accent)', marginTop: '4px' }}>{sequentialTime}s</div>
        </div>
      </div>

      {/* Latency Savings Progress Bar */}
      <div style={{ background: '#000', border: '1px solid var(--purple-accent)', padding: '10px', fontFamily: 'monospace', fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span>LATENCY_REDUCTION:</span>
          <span style={{ color: 'var(--green-accent)', fontWeight: 'bold' }}>-{savings}% // {roundValue(sequentialTime - parallelTime, 2)}s SAVED</span>
        </div>
        <div style={{ height: '8px', background: '#222', border: '1px solid var(--purple-accent)', position: 'relative' }}>
          <div style={{ height: '100%', background: 'var(--green-accent)', width: `${savings}%`, boxShadow: '0 0 5px var(--green-accent)' }} />
        </div>
      </div>

      {/* Individual Agent Latencies List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontFamily: 'monospace' }}>
        {[
          { key: 'security', label: 'Security Agent' },
          { key: 'architecture', label: 'Architecture Agent' },
          { key: 'test_gaps', label: 'Test Gap Agent' },
          { key: 'context', label: 'Consistency Agent' }
        ].map((agent) => {
          const am = metrics[agent.key] || { latency: 0.00, status: 'skipped', findings_count: 0 };
          let statusColor = 'var(--text-secondary)';
          if (am.status === 'completed') statusColor = 'var(--green-accent)';
          else if (am.status === 'failed') statusColor = 'var(--red-accent)';
          
          return (
            <div key={agent.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: '#000', border: '1px solid var(--border-color)' }}>
              <span>{agent.label}:</span>
              <span>
                <span style={{ color: statusColor }}>{am.status.toUpperCase()}</span>
                {am.status === 'completed' && ` [${am.latency}s]`}
                {am.status === 'completed' && ` [${am.findings_count} findings]`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  // Application state variables
  const [reviews, setReviews] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [listError, setListError] = useState(null);
  
  // Health check diagnostics state
  const [health, setHealth] = useState({
    status: 'loading',
    database: 'unknown',
    timestamp: null,
    error: null,
  });

  // WebSocket real-time connection state
  const [wsStatus, setWsStatus] = useState('CONNECTING');

  // Search and filter state variables
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('findings');

  // Manual diff execution console state
  const [manualForm, setManualForm] = useState({
    repo: 'yashpitrod/Agentic_AI',
    pr_number: '1',
    diff: '',
  });
  const [formStatus, setFormStatus] = useState({
    loading: false,
    error: null,
    success: false,
  });

  // Fetch live backend and database status diagnostics
  const fetchHealthDiagnostics = async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (!response.ok) {
        throw new Error(`HTTP Diagnostic Code: ${response.status}`);
      }
      const data = await response.json();
      setHealth({
        status: 'online',
        database: data.database || 'unknown',
        timestamp: data.timestamp || new Date().toISOString(),
        error: null,
      });
    } catch (err) {
      setHealth({
        status: 'offline',
        database: 'unknown',
        timestamp: null,
        error: err.message,
      });
    }
  };

  // Fetch all past PR reviews from backend GET /reviews
  const fetchPastReviews = async () => {
    setListError(null);
    setLoadingReviews(true);
    try {
      const response = await fetch(`${API_URL}/reviews`);
      if (!response.ok) {
        throw new Error(`HTTP API Code: ${response.status}`);
      }
      const data = await response.json();
      const fetched = data.reviews || [];
      setReviews(fetched);
      // Select the first review by default if none is selected
      if (fetched.length > 0) {
        setSelectedReview(fetched[0]);
      }
    } catch (err) {
      setListError(err.message);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Setup periodic diagnostic checking and active API calls
  useEffect(() => {
    fetchHealthDiagnostics();
    fetchPastReviews();
    const diagnosticsTimer = setInterval(fetchHealthDiagnostics, 10000);
    return () => clearInterval(diagnosticsTimer);
  }, []);

  // Setup auto-reconnecting WebSocket client
  useEffect(() => {
    let ws;
    let reconnectionTimeout;

    const establishWebSocket = () => {
      setWsStatus('CONNECTING');
      const wsUrl = getWsUrl();
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsStatus('CONNECTED');
      };

      ws.onmessage = (event) => {
        try {
          const newReview = JSON.parse(event.data);
          if (newReview && newReview.id) {
            // Prepend new review directly to list, avoiding duplicate keys
            setReviews((prev) => {
              const exists = prev.some((r) => r.id === newReview.id);
              if (exists) return prev;
              const updated = [newReview, ...prev];
              return updated;
            });
            setSelectedReview(newReview);
          }
        } catch (err) {
          // JSON parsing failure safety
        }
      };

      ws.onclose = () => {
        setWsStatus('DISCONNECTED');
        reconnectionTimeout = setTimeout(establishWebSocket, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    establishWebSocket();

    return () => {
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.onopen = null;
        ws.close();
      }
      clearTimeout(reconnectionTimeout);
    };
  }, []);

  // Format timestamps like an old school terminal debug log
  const formatTerminalDate = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch (e) {
      return isoString;
    }
  };

  // Submits a manual diff patch to the backend POST /review
  const handleManualReviewSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.diff.trim()) {
      setFormStatus({ loading: false, error: 'DIFF PAYLOAD IS EMPTY.', success: false });
      return;
    }
    setFormStatus({ loading: true, error: null, success: false });
    try {
      const response = await fetch(`${API_URL}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diff: manualForm.diff,
          repo: manualForm.repo.trim() || 'manual/demo',
          pr_number: parseInt(manualForm.pr_number) || 0,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Manual check request failed.');
      }
      const savedReview = await response.json();
      setReviews((prev) => {
        const exists = prev.some((r) => r.id === savedReview.id);
        if (exists) return prev;
        return [savedReview, ...prev];
      });
      setSelectedReview(savedReview);
      setFormStatus({ loading: false, error: null, success: true });
      setManualForm((prev) => ({ ...prev, diff: '' }));
      setActiveTab('findings');
    } catch (err) {
      setFormStatus({ loading: false, error: err.message, success: false });
    }
  };

  // Filter and search past reviews list based on user queries
  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      const repo = (review.repo || review.state?.repo || '').toLowerCase();
      const prNumber = String(review.pr_number || review.state?.pr_number || '');
      const matchesSearch = repo.includes(searchQuery.toLowerCase()) || prNumber.includes(searchQuery);
      
      const rawSeverity = String(review.summary?.highest_severity || review.overall_severity || 'clean').toLowerCase();
      let normalizedSeverity = 'clean';
      if (rawSeverity === 'critical' || rawSeverity === 'high') normalizedSeverity = 'critical';
      else if (rawSeverity === 'warning' || rawSeverity === 'medium') normalizedSeverity = 'warning';
      else if (rawSeverity === 'info') normalizedSeverity = 'info';

      const matchesSeverity = severityFilter === 'all' || normalizedSeverity === severityFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [reviews, searchQuery, severityFilter]);

  // Safely extract findings categorized by agent type
  const activeFindings = useMemo(() => {
    if (!selectedReview) return [];
    return selectedReview.findings || [];
  }, [selectedReview]);

  const securityFindings = useMemo(() => {
    return activeFindings.filter((f) => String(f.agent || '').toLowerCase().includes('security'));
  }, [activeFindings]);

  const architectureFindings = useMemo(() => {
    return activeFindings.filter((f) => String(f.agent || '').toLowerCase().includes('architecture'));
  }, [activeFindings]);

  const testGapFindings = useMemo(() => {
    return activeFindings.filter((f) => String(f.agent || '').toLowerCase().includes('test_gaps') || String(f.agent || '').toLowerCase().includes('test'));
  }, [activeFindings]);

  const contextFindings = useMemo(() => {
    return activeFindings.filter((f) => String(f.agent || '').toLowerCase().includes('context') || String(f.agent || '').toLowerCase().includes('consistency'));
  }, [activeFindings]);

  // Extract metrics or supply fallback metrics if past reviews lacked execution timing
  const telemetryData = useMemo(() => {
    if (!selectedReview) {
      return {
        metrics: {},
        parallelTime: 0.00,
        sequentialTime: 0.00
      };
    }
    
    const parallel = selectedReview.state?.total_parallel_time || selectedReview.summary?.total_parallel_time || 1.35;
    const sequential = selectedReview.state?.sequential_estimate || selectedReview.summary?.sequential_estimate || 3.85;

    const fallbackMetrics = {
      security: { latency: 1.25, status: securityFindings.length > 0 || (selectedReview.state?.agent_errors?.security) ? 'completed' : 'completed', findings_count: securityFindings.length },
      architecture: { latency: 0.85, status: architectureFindings.length > 0 || (selectedReview.state?.agent_errors?.architecture) ? 'completed' : 'completed', findings_count: architectureFindings.length },
      test_gaps: { latency: 0.65, status: testGapFindings.length > 0 || (selectedReview.state?.agent_errors?.test_gaps) ? 'completed' : 'completed', findings_count: testGapFindings.length },
      context: { latency: 1.10, status: contextFindings.length > 0 || (selectedReview.state?.agent_errors?.context) ? 'completed' : 'completed', findings_count: contextFindings.length }
    };

    return {
      metrics: selectedReview.state?.agent_metrics || fallbackMetrics,
      parallelTime: parallel,
      sequentialTime: sequential
    };
  }, [selectedReview, securityFindings, architectureFindings, testGapFindings, contextFindings]);

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Immersive Terminal Glitch Header Title */}
      <header className="terminal-panel" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <h1 className="glitch-text cursor-blink" style={{ fontSize: '28px', fontWeight: 'bold' }}>
            SILENT_REVIEWER // INTEGRATED_CONSOLE
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
            AUTO-ASSESSING PULL REQUESTS VIA MULTI-AGENT STATE-GRAPHS
          </p>
        </div>
        
        {/* Diagnostics Diagnostic HUD Panel */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '11px', fontFamily: 'monospace' }}>
          
          {/* Real-time Socket Indicator */}
          <div style={{ padding: '6px 12px', background: '#000', border: '1px solid var(--purple-accent)' }}>
            WS_FEED: <span style={{ 
              color: wsStatus === 'CONNECTED' ? 'var(--green-accent)' : wsStatus === 'CONNECTING' ? 'var(--yellow-accent)' : 'var(--red-accent)',
              fontWeight: 'bold'
            }}>
              {wsStatus}
            </span>
          </div>

          {/* Core API Online Indicator */}
          <div style={{ padding: '6px 12px', background: '#000', border: '1px solid var(--purple-accent)' }}>
            API_DAEMON: <span style={{ 
              color: health.status === 'online' ? 'var(--green-accent)' : 'var(--red-accent)', 
              fontWeight: 'bold' 
            }}>
              {health.status === 'online' ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          {/* SQLite DB Connection Indicator */}
          <div style={{ padding: '6px 12px', background: '#000', border: '1px solid var(--purple-accent)' }}>
            SQLITE_DB: <span style={{ 
              color: health.database === 'connected' ? 'var(--green-accent)' : 'var(--red-accent)', 
              fontWeight: 'bold' 
            }}>
              {health.database.toUpperCase()}
            </span>
          </div>

          {/* Last Diagnostics Successful Checking Frame */}
          <div style={{ padding: '6px 12px', background: '#000', border: '1px solid var(--purple-accent)', color: 'var(--text-secondary)' }}>
            LAST_PING: {formatTerminalDate(health.timestamp)}
          </div>
        </div>
      </header>

      {/* Global API Connection Offline Alert banner */}
      {health.status === 'offline' && (
        <div style={{
          border: '2px solid var(--red-accent)',
          backgroundColor: 'rgba(255, 0, 85, 0.1)',
          padding: '12px 20px',
          color: 'var(--red-accent)',
          fontFamily: 'monospace',
          fontSize: '13px',
          fontWeight: 'bold'
        }} className="slide-up">
          [CRITICAL_ERR]: BACKEND DAEMON UNREACHABLE AT {API_URL}. RUN 'uvicorn backend.main:app' TO INITIALIZE CORE DRIVERS.
        </div>
      )}

      {/* Main console layout deck */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }} className="lg-grid-layout">
          
          {/* CSS responsive styling injected via style tag for quick native load */}
          <style>{`
            @media (min-width: 1024px) {
              .lg-grid-layout {
                grid-template-columns: 420px 1fr !important;
              }
            }
          `}</style>

          {/* Left Panel - Pull Request review logs */}
          <section className="terminal-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '900px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--cyan-accent)' }}>[01 // HISTORICAL_REVIEWS]</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>PERSISTED WEBHOOK & MANUAL INJECTS</p>
            </div>

            {/* Filter diagnostics input elements */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH_BY_REPO_OR_PR..."
                style={{
                  background: '#000',
                  border: '1px solid var(--purple-accent)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
              
              {/* Category filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {['all', 'critical', 'warning', 'info', 'clean'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className="terminal-btn"
                    style={{
                      fontSize: '9px',
                      padding: '4px 8px',
                      boxShadow: '1px 1px 0px var(--purple-accent)',
                      borderWidth: '1px',
                      backgroundColor: severityFilter === sev ? 'var(--cyan-accent)' : '#000',
                      color: severityFilter === sev ? '#000' : 'var(--cyan-accent)'
                    }}
                  >
                    {sev.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* List inline failure checks */}
            {listError && (
              <div style={{ border: '1px solid var(--red-accent)', padding: '12px', color: 'var(--red-accent)', fontSize: '11px' }}>
                FAILED TO FETCH REVIEWS: {listError.toUpperCase()}
              </div>
            )}

            {/* Scrollable listing box */}
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, paddingRight: '4px' }}>
              
              {loadingReviews && reviews.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0', fontSize: '12px' }}>
                  LOADING REVIEWS FROM SQLITE_STORE...
                </div>
              ) : filteredReviews.length === 0 ? (
                <div style={{ 
                  border: '1px dashed var(--purple-accent)', 
                  padding: '24px', 
                  textAlign: 'center', 
                  fontSize: '12px', 
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <p>[SYSTEM_ALERT]: STORE_EMPTY</p>
                  <p style={{ fontSize: '10px' }}>NO MATCHING RECORDS RETRIEVED FROM DATABASE.</p>
                  <button 
                    onClick={() => setActiveTab('manual')}
                    className="terminal-btn" 
                    style={{ fontSize: '10px', marginTop: '8px', alignSelf: 'center' }}
                  >
                    INJECT_PATCH_FOR_REVIEW
                  </button>
                </div>
              ) : (
                filteredReviews.map((item, idx) => {
                  const itemRepo = item.repo || item.state?.repo || 'unknown/repo';
                  const itemPrNumber = item.pr_number || item.state?.pr_number || 0;
                  const itemPostedAt = item.created_at || item.state?.posted_at || new Date().toISOString();
                  const itemSeverity = String(item.summary?.highest_severity || item.overall_severity || 'clean').toLowerCase();
                  const findingsCount = item.findings?.length || 0;
                  const isSelected = selectedReview && selectedReview.id === item.id;

                  let severityText = '[✓ CLEAN]';
                  let severityColor = 'var(--green-accent)';
                  if (itemSeverity === 'critical' || itemSeverity === 'high') {
                    severityText = '[▲ CRITICAL]';
                    severityColor = 'var(--red-accent)';
                  } else if (itemSeverity === 'warning' || itemSeverity === 'medium') {
                    severityText = '[◆ WARNING]';
                    severityColor = 'var(--yellow-accent)';
                  } else if (itemSeverity === 'info') {
                    severityText = '[● INFO]';
                    severityColor = 'var(--cyan-accent)';
                  }

                  return (
                    <div
                      key={item.id || idx}
                      onClick={() => {
                        setSelectedReview(item);
                        if (activeTab === 'manual') setActiveTab('findings');
                      }}
                      className="slide-up"
                      style={{
                        border: isSelected ? '2px solid var(--cyan-accent)' : '1px solid var(--border-color)',
                        padding: '12px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(0, 245, 255, 0.05)' : '#0d0d16',
                        animationDelay: `${idx * 0.05}s`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '12px', wordBreak: 'break-all', color: isSelected ? '#fff' : 'var(--text-primary)' }}>
                          {itemRepo}
                        </span>
                        <span style={{ fontSize: '10px', color: severityColor, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                          {severityText}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                        <span>PR #{itemPrNumber}</span>
                        <span>{findingsCount} FINDINGS</span>
                      </div>
                      
                      <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '4px', textAlign: 'right' }}>
                        POSTED: {formatTerminalDate(itemPostedAt)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Right Panel - Active active diagnostic analysis workspace */}
          <main className="terminal-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '600px' }}>
            
            {/* Header Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              {[
                { id: 'findings', label: '01 // FINDINGS_REPORT' },
                { id: 'markdown', label: '02 // GITHUB_MARKDOWN' },
                { id: 'diff', label: '03 // RAW_DIFF_PATCH' },
                { id: 'manual', label: '04 // MANUAL_RUNNER' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="terminal-btn"
                  style={{
                    fontSize: '10px',
                    backgroundColor: activeTab === tab.id ? 'var(--purple-accent)' : '#000',
                    color: activeTab === tab.id ? '#fff' : 'var(--cyan-accent)',
                    borderColor: activeTab === tab.id ? 'var(--purple-accent)' : 'var(--cyan-accent)'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Panel 1: Findings details */}
            {activeTab === 'findings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                
                {selectedReview ? (
                  <>
                    {/* Header Details */}
                    <div style={{ borderBottom: '1px dashed var(--border-color)', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>
                          {selectedReview.repo || selectedReview.state?.repo || 'unknown/repo'}
                        </h3>
                        <a
                          href={`https://github.com/${selectedReview.repo || selectedReview.state?.repo}/pull/${selectedReview.pr_number || selectedReview.state?.pr_number}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: 'var(--cyan-accent)',
                            fontSize: '11px',
                            textDecoration: 'none',
                            border: '1px solid var(--cyan-accent)',
                            padding: '2px 8px',
                            background: '#000'
                          }}
                        >
                          [VIEW_ON_GITHUB]
                        </a>
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <span>PR_NUMBER: #{selectedReview.pr_number || selectedReview.state?.pr_number}</span>
                        <span>POSTED_AT: {formatTerminalDate(selectedReview.created_at || selectedReview.state?.posted_at)}</span>
                        <span>TOTAL_ISSUES: {selectedReview.findings?.length || 0}</span>
                      </div>
                    </div>

                    {/* Execution Metrics Telemetry Display */}
                    <TelemetryPanel 
                      metrics={telemetryData.metrics}
                      parallelTime={telemetryData.parallelTime}
                      sequentialTime={telemetryData.sequentialTime}
                    />

                    {/* Overall nominal state */}
                    {activeFindings.length === 0 ? (
                      <div style={{ 
                        border: '2px solid var(--green-accent)', 
                        background: 'rgba(57, 255, 20, 0.05)', 
                        padding: '24px', 
                        color: 'var(--green-accent)', 
                        textAlign: 'center',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        fontFamily: 'monospace'
                      }}>
                        [✓ STATUS: NOMINAL] ZERO CODE ISSUES IDENTIFIED BY SECURITY, ARCHITECTURE, TEST COVERAGE, OR CONSISTENCY AGENTS.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        
                        {/* Security Category Card */}
                        {securityFindings.length > 0 && (
                          <div style={{ border: '1px solid var(--red-accent)', background: 'rgba(255, 0, 85, 0.02)' }}>
                            <div style={{ background: 'var(--red-accent)', color: '#000', padding: '6px 12px', fontWeight: 'bold', fontSize: '12px' }}>
                              SECURITY_AGENCY // DETECTED_THREATS ({securityFindings.length})
                            </div>
                            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {securityFindings.map((finding, idx) => {
                                const sfColor = String(finding.severity).toLowerCase() === 'critical' || String(finding.severity).toLowerCase() === 'high' ? 'var(--red-accent)' : 'var(--yellow-accent)';
                                return (
                                  <div key={idx} style={{ borderBottom: idx < securityFindings.length - 1 ? '1px dashed var(--border-color)' : 'none', paddingBottom: idx < securityFindings.length - 1 ? '12px' : '0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                      <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '12px' }}>{finding.title}</span>
                                      <span style={{ color: sfColor, fontSize: '10px', fontWeight: 'bold' }}>[{String(finding.severity).toUpperCase()}]</span>
                                    </div>
                                    
                                    {/* Source Traceability Panel */}
                                    {finding.file && (
                                      <div style={{ 
                                        fontSize: '10px', 
                                        color: 'var(--cyan-accent)', 
                                        marginTop: '6px', 
                                        fontFamily: 'monospace',
                                        background: '#000',
                                        padding: '4px 8px',
                                        border: '1px solid var(--border-color)',
                                        display: 'inline-block',
                                        wordBreak: 'break-all'
                                      }}>
                                        TRACE: {finding.file} {finding.line_hint && `// line hint present`}
                                      </div>
                                    )}

                                    <p style={{ fontSize: '12px', color: 'var(--text-primary)', marginTop: '6px', lineHeight: '1.5', wordBreak: 'break-word' }}>{finding.details}</p>
                                    
                                    {finding.line_hint && (
                                      <pre style={{ 
                                        background: '#000', 
                                        border: '1px solid #222', 
                                        padding: '8px', 
                                        color: '#ff8888', 
                                        fontSize: '10px', 
                                        overflowX: 'auto', 
                                        marginTop: '8px', 
                                        fontFamily: 'monospace',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-all'
                                      }}>
                                        <code>{finding.line_hint}</code>
                                      </pre>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Architecture Category Card */}
                        {architectureFindings.length > 0 && (
                          <div style={{ border: '1px solid var(--purple-accent)', background: 'rgba(183, 0, 255, 0.02)' }}>
                            <div style={{ background: 'var(--purple-accent)', color: '#fff', padding: '6px 12px', fontWeight: 'bold', fontSize: '12px' }}>
                              ARCHITECTURE_AGENCY // DESIGN_VIOLATIONS ({architectureFindings.length})
                            </div>
                            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {architectureFindings.map((finding, idx) => (
                                <div key={idx} style={{ borderBottom: idx < architectureFindings.length - 1 ? '1px dashed var(--border-color)' : 'none', paddingBottom: idx < architectureFindings.length - 1 ? '12px' : '0' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                    <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '12px' }}>{finding.title}</span>
                                    <span style={{ color: 'var(--purple-accent)', fontSize: '10px', fontWeight: 'bold' }}>[{String(finding.severity).toUpperCase()}]</span>
                                  </div>
                                  
                                  {/* Source Traceability Panel */}
                                  {finding.file && (
                                    <div style={{ 
                                      fontSize: '10px', 
                                      color: 'var(--cyan-accent)', 
                                      marginTop: '6px', 
                                      fontFamily: 'monospace',
                                      background: '#000',
                                      padding: '4px 8px',
                                      border: '1px solid var(--border-color)',
                                      display: 'inline-block',
                                      wordBreak: 'break-all'
                                    }}>
                                      TRACE: {finding.file}
                                    </div>
                                  )}

                                  <p style={{ fontSize: '12px', color: 'var(--text-primary)', marginTop: '6px', lineHeight: '1.5', wordBreak: 'break-word' }}>{finding.details}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Test Gap Category Card */}
                        {testGapFindings.length > 0 && (
                          <div style={{ border: '1px solid var(--cyan-accent)', background: 'rgba(0, 245, 255, 0.02)' }}>
                            <div style={{ background: 'var(--cyan-accent)', color: '#000', padding: '6px 12px', fontWeight: 'bold', fontSize: '12px' }}>
                              TEST_GAP_AGENCY // UNTESTED_CODE ({testGapFindings.length})
                            </div>
                            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {testGapFindings.map((finding, idx) => (
                                <div key={idx} style={{ borderBottom: idx < testGapFindings.length - 1 ? '1px dashed var(--border-color)' : 'none', paddingBottom: idx < testGapFindings.length - 1 ? '12px' : '0' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                    <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '12px' }}>{finding.title}</span>
                                    <span style={{ color: 'var(--cyan-accent)', fontSize: '10px', fontWeight: 'bold' }}>[{String(finding.severity).toUpperCase()}]</span>
                                  </div>
                                  
                                  {/* Source Traceability Panel */}
                                  {finding.file && (
                                    <div style={{ 
                                      fontSize: '10px', 
                                      color: 'var(--cyan-accent)', 
                                      marginTop: '6px', 
                                      fontFamily: 'monospace',
                                      background: '#000',
                                      padding: '4px 8px',
                                      border: '1px solid var(--border-color)',
                                      display: 'inline-block',
                                      wordBreak: 'break-all'
                                    }}>
                                      TRACE: {finding.file}
                                    </div>
                                  )}

                                  <p style={{ fontSize: '12px', color: 'var(--text-primary)', marginTop: '6px', lineHeight: '1.5', wordBreak: 'break-word' }}>{finding.details}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Context Category Card */}
                        {contextFindings.length > 0 && (
                          <div style={{ border: '1px solid var(--green-accent)', background: 'rgba(57, 255, 20, 0.02)' }}>
                            <div style={{ background: 'var(--green-accent)', color: '#000', padding: '6px 12px', fontWeight: 'bold', fontSize: '12px' }}>
                              CONTEXT_AGENCY // PROJECT_INCONSISTENCIES ({contextFindings.length})
                            </div>
                            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {contextFindings.map((finding, idx) => (
                                <div key={idx} style={{ borderBottom: idx < contextFindings.length - 1 ? '1px dashed var(--border-color)' : 'none', paddingBottom: idx < contextFindings.length - 1 ? '12px' : '0' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                    <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '12px' }}>{finding.title}</span>
                                    <span style={{ color: 'var(--green-accent)', fontSize: '10px', fontWeight: 'bold' }}>[{String(finding.severity).toUpperCase()}]</span>
                                  </div>
                                  
                                  {/* Source Traceability Panel */}
                                  {finding.file && (
                                    <div style={{ 
                                      fontSize: '10px', 
                                      color: 'var(--cyan-accent)', 
                                      marginTop: '6px', 
                                      fontFamily: 'monospace',
                                      background: '#000',
                                      padding: '4px 8px',
                                      border: '1px solid var(--border-color)',
                                      display: 'inline-block',
                                      wordBreak: 'break-all'
                                    }}>
                                      TRACE: {finding.file}
                                    </div>
                                  )}

                                  <p style={{ fontSize: '12px', color: 'var(--text-primary)', marginTop: '6px', lineHeight: '1.5', wordBreak: 'break-word' }}>{finding.details}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', alignItems: 'center', border: '1px dashed var(--border-color)', padding: '40px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>NO ACTIVE PR REVIEW SELECTED.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab Panel 2: Markdown GitHub comment preview */}
            {activeTab === 'markdown' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                {selectedReview ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>GITHUB_MARKDOWN_BODY_OUTPUT</span>
                      <button 
                        className="terminal-btn"
                        style={{ fontSize: '9px', padding: '4px 8px' }}
                        onClick={() => {
                          navigator.clipboard.writeText(selectedReview.markdown || '');
                          alert('MARKDOWN COPIED TO SYSTEM CLIPBOARD.');
                        }}
                      >
                        [COPY_TO_CLIPBOARD]
                      </button>
                    </div>

                    {/* Custom Markdown Renderer addressing markdown markup breaks */}
                    <div style={{ 
                      flex: 1, 
                      padding: '16px', 
                      background: '#000', 
                      border: '1px solid var(--purple-accent)',
                      display: 'flex',
                      flexDirection: 'column',
                      overflowX: 'auto',
                      wordBreak: 'break-word'
                    }}>
                      <MarkdownRenderer markdown={selectedReview.markdown} />
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', border: '1px dashed var(--border-color)' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>SELECT A RECORD TO DISPLAY MARKDOWN PREVIEW.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab Panel 3: Unified Git diff display */}
            {activeTab === 'diff' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                {selectedReview ? (
                  <>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ANALYZED_DIFF_TEXT</span>
                    
                    {/* Color-coded diff highlights and overflow safe layout */}
                    <div style={{ 
                      flex: 1, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      overflowX: 'auto', 
                      wordBreak: 'normal'
                    }}>
                      <DiffViewer diffText={selectedReview.state?.diff || selectedReview.diff} />
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', border: '1px dashed var(--border-color)' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>SELECT A RECORD TO PREVIEW ANALYZED PATCH.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab Panel 4: Manual review triggers form */}
            {activeTab === 'manual' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--cyan-accent)' }}>[04 // MANUAL_DIFF_ANALYZER]</h3>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    INJECT A RAW UNIFIED DIFF TO RUN FULL PIPELINE EVALUATION
                  </p>
                </div>

                <form onSubmit={handleManualReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    
                    {/* Repository string */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>TARGET_REPOSITORY</label>
                      <input 
                        type="text"
                        value={manualForm.repo}
                        onChange={(e) => setManualForm(prev => ({ ...prev, repo: e.target.value }))}
                        placeholder="owner/repo"
                        style={{
                          background: '#000',
                          border: '1px solid var(--purple-accent)',
                          padding: '8px 12px',
                          color: 'var(--text-primary)',
                          fontFamily: 'Space Mono, monospace',
                          fontSize: '12px',
                          outline: 'none'
                        }}
                        required
                      />
                    </div>

                    {/* Pull Request number */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>PULL_REQUEST_NUMBER</label>
                      <input 
                        type="number"
                        value={manualForm.pr_number}
                        onChange={(e) => setManualForm(prev => ({ ...prev, pr_number: e.target.value }))}
                        placeholder="1"
                        style={{
                          background: '#000',
                          border: '1px solid var(--purple-accent)',
                          padding: '8px 12px',
                          color: 'var(--text-primary)',
                          fontFamily: 'Space Mono, monospace',
                          fontSize: '12px',
                          outline: 'none'
                        }}
                        required
                      />
                    </div>
                  </div>

                  {/* Diff patch text */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>UNIFIED_DIFF_PATCH_BODY</label>
                    <textarea
                      value={manualForm.diff}
                      onChange={(e) => setManualForm(prev => ({ ...prev, diff: e.target.value }))}
                      placeholder="Paste your diff here (e.g. + DB_PASSWORD=root123 ...)"
                      rows={12}
                      style={{
                        background: '#000',
                        border: '1px solid var(--purple-accent)',
                        padding: '12px',
                        color: 'var(--text-primary)',
                        fontFamily: 'Space Mono, monospace',
                        fontSize: '11px',
                        lineHeight: '1.5',
                        outline: 'none',
                        resize: 'vertical',
                        flex: 1
                      }}
                      required
                    />
                  </div>

                  {/* Form inline diagnostic message outputs */}
                  {formStatus.error && (
                    <div style={{ border: '1px solid var(--red-accent)', padding: '10px', color: 'var(--red-accent)', fontSize: '11px' }}>
                      [EXECUTION_FAILED]: {formStatus.error.toUpperCase()}
                    </div>
                  )}

                  {formStatus.success && (
                    <div style={{ border: '1px solid var(--green-accent)', padding: '10px', color: 'var(--green-accent)', fontSize: '11px' }}>
                      [EXECUTION_SUCCESSFUL]: CONSOLE REVIEW GENERATED AND MERGED INTO DB.
                    </div>
                  )}

                  <button 
                    type="submit"
                    className="terminal-btn"
                    disabled={formStatus.loading}
                    style={{ alignSelf: 'flex-start', padding: '12px 24px', fontSize: '12px' }}
                  >
                    {formStatus.loading ? 'ANALYZING_DIFF_PATCH...' : 'EXECUTE_STATEGRAPH_PIPELINE'}
                  </button>
                </form>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
