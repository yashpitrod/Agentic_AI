import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { API_URL } from '../App.jsx'

const CATEGORIES = [
  {
    key: 'security',
    label: 'Security',
    emoji: '🔴',
    agentMatch: 'security',
    cardClass: 'card-security',
  },
  {
    key: 'architecture',
    label: 'Architecture',
    emoji: '🟡',
    agentMatch: 'architecture',
    cardClass: 'card-architecture',
  },
  {
    key: 'test_gaps',
    label: 'Test Gaps',
    emoji: '🟡',
    agentMatch: 'test',
    cardClass: 'card-test-gaps',
  },
  {
    key: 'consistency',
    label: 'Consistency',
    emoji: '🟢',
    agentMatch: 'context',
    cardClass: 'card-consistency',
  },
]

export default function ResultsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openCategories, setOpenCategories] = useState({})
  const [toastVisible, setToastVisible] = useState(false)

  useEffect(() => {
    async function fetchReview() {
      try {
        const response = await fetch(`${API_URL}/reviews/${id}`)
        if (!response.ok) {
          throw new Error(`Review not found (${response.status})`)
        }
        const data = await response.json()
        setReview(data)

        // Auto-open categories that have findings
        const initialOpen = {}
        CATEGORIES.forEach(cat => {
          const findings = getCategoryFindings(data.findings || [], cat.agentMatch)
          if (findings.length > 0) {
            initialOpen[cat.key] = true
          }
        })
        setOpenCategories(initialOpen)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchReview()
  }, [id])

  function getCategoryFindings(findings, agentMatch) {
    return findings.filter(f => {
      const agent = String(f.agent || '').toLowerCase()
      if (agentMatch === 'test') {
        return agent.includes('test_gaps') || agent.includes('test')
      }
      if (agentMatch === 'context') {
        return agent.includes('context') || agent.includes('consistency')
      }
      return agent.includes(agentMatch)
    })
  }

  const categorizedFindings = useMemo(() => {
    if (!review) return {}
    const result = {}
    CATEGORIES.forEach(cat => {
      result[cat.key] = getCategoryFindings(review.findings || [], cat.agentMatch)
    })
    return result
  }, [review])

  const toggleCategory = (key) => {
    setOpenCategories(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleCopyMarkdown = async () => {
    if (!review?.markdown) return
    try {
      await navigator.clipboard.writeText(review.markdown)
      setToastVisible(true)
      setTimeout(() => setToastVisible(false), 2500)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = review.markdown
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setToastVisible(true)
      setTimeout(() => setToastVisible(false), 2500)
    }
  }

  const getSeverityClass = (severity) => {
    const sev = String(severity).toLowerCase()
    if (sev === 'critical') return 'severity-critical'
    if (sev === 'high') return 'severity-high'
    if (sev === 'warning' || sev === 'medium') return 'severity-warning'
    if (sev === 'info') return 'severity-info'
    if (sev === 'low') return 'severity-low'
    return 'severity-info'
  }

  if (loading) {
    return (
      <div className="loading-container" style={{ textAlign: 'center' }}>
        <h1 className="loading-title">Loading Review...</h1>
        <p className="loading-subtitle">Fetching results from the database</p>
        <div className="loading-progress">
          <div className="loading-progress-fill" style={{ width: '60%' }} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="loading-container">
        <h1 className="loading-title">Review Not Found</h1>
        <p className="loading-subtitle">{error}</p>
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            ← Back to Home
          </button>
          <Link to="/history" className="btn btn-secondary">
            View History
          </Link>
        </div>
      </div>
    )
  }

  if (!review) return null

  const repo = review.repo || 'unknown/repo'
  const prNumber = review.pr_number || 0
  const severity = String(review.summary?.highest_severity || 'clean').toLowerCase()
  const totalFindings = review.findings?.length || 0

  return (
    <>
      {/* Page Head */}
      <div className="page-head">
        <h1>Review Results</h1>
        <p>
          {repo} — PR #{prNumber}
        </p>
      </div>

      {/* Meta info bar */}
      <div className="results-header">
        <div className="results-meta">
          <span className="results-meta-item">
            Repo: <strong>{repo}</strong>
          </span>
          <span className="results-meta-item">
            PR: <strong>#{prNumber}</strong>
          </span>
          <span className="results-meta-item">
            Severity:{' '}
            <strong style={{
              color: severity === 'critical' || severity === 'high' ? '#ff4d4d' :
                severity === 'warning' || severity === 'medium' ? '#cc8800' : '#27bda5'
            }}>
              {severity.toUpperCase()}
            </strong>
          </span>
          <span className="results-meta-item">
            Findings: <strong>{totalFindings}</strong>
          </span>
          <a
            href={`https://github.com/${repo}/pull/${prNumber}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-small btn-teal"
          >
            View on GitHub ↗
          </a>
        </div>
      </div>

      {/* Clean PR Celebration */}
      {totalFindings === 0 && (
        <div className="clean-pr-card" id="clean-pr-card">
          <div className="clean-pr-icon">✅</div>
          <h2 className="clean-pr-title">All Clear — No Issues Found!</h2>
          <p className="clean-pr-desc">
            All 4 AI agents reviewed this PR and found <strong>zero issues</strong>.
            This pull request looks clean across security, architecture, test coverage, and code consistency.
          </p>
          <div className="clean-pr-agents">
            <span className="clean-pr-agent">🔒 Security — passed</span>
            <span className="clean-pr-agent">🏗️ Architecture — passed</span>
            <span className="clean-pr-agent">🧪 Test Gaps — passed</span>
            <span className="clean-pr-agent">📏 Consistency — passed</span>
          </div>
        </div>
      )}

      {/* Category Cards */}
      <div className="category-cards">
        {CATEGORIES.map((cat) => {
          const findings = categorizedFindings[cat.key] || []
          const isOpen = openCategories[cat.key]
          const count = findings.length

          return (
            <div key={cat.key} className={`category-card ${cat.cardClass}`}>
              <div
                className="category-header"
                onClick={() => toggleCategory(cat.key)}
              >
                <span>
                  {cat.emoji} {cat.label}
                  {count > 0 ? (
                    <span className="category-count" style={{ marginLeft: '10px' }}>
                      {count} {count === 1 ? 'issue' : 'issues'}
                    </span>
                  ) : (
                    <span className="category-clean" style={{ marginLeft: '10px' }}>
                      ✓ Clean
                    </span>
                  )}
                </span>
                <span className={`arrow ${isOpen ? 'is-open' : ''}`}>▼</span>
              </div>

              <div className={`category-body ${isOpen ? 'is-open' : ''}`}>
                {count === 0 ? (
                  <div className="no-issues">✓ No issues found in this category</div>
                ) : (
                  findings.map((finding, idx) => (
                    <div key={idx} className="finding-item">
                      <div className="finding-title">
                        <span>{finding.title}</span>
                        <span className={`severity-badge ${getSeverityClass(finding.severity)}`}>
                          {String(finding.severity).toUpperCase()}
                        </span>
                      </div>

                      <p className="finding-details">{finding.details}</p>

                      {finding.file && (
                        <div className="finding-file">
                          📁 {finding.file}
                        </div>
                      )}

                      {finding.line_hint && (
                        <pre className="finding-code">
                          <code>{finding.line_hint}</code>
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Copy GitHub Comment */}
      <div className="copy-section">
        <p>
          📋 Copy the full review as a GitHub PR comment — same markdown that gets posted on the PR
        </p>
        <button
          className="btn btn-primary"
          onClick={handleCopyMarkdown}
          id="copy-markdown-btn"
        >
          Copy GitHub Comment
        </button>
      </div>

      {/* Back navigation */}
      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        <Link to="/" className="btn btn-small">
          ← New Review
        </Link>
        <Link to="/history" className="btn btn-small btn-secondary">
          View History
        </Link>
      </div>

      {/* Toast */}
      <div className={`toast ${toastVisible ? 'is-visible' : ''}`}>
        ✓ Markdown copied to clipboard!
      </div>
    </>
  )
}
