import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { API_URL } from '../App.jsx'

export default function HistoryPage() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchHistory() {
      try {
        const response = await fetch(`${API_URL}/reviews`)
        if (!response.ok) {
          throw new Error(`Failed to load reviews (${response.status})`)
        }
        const data = await response.json()
        setReviews(data.reviews || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [])

  const formatTime = (isoString) => {
    if (!isoString) return '—'
    try {
      const date = new Date(isoString)
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return isoString
    }
  }

  const getSeverityStyle = (severity) => {
    const sev = String(severity).toLowerCase()
    if (sev === 'critical' || sev === 'high') return { background: '#ff4d4d', color: '#fff' }
    if (sev === 'warning' || sev === 'medium') return { background: '#ffd447' }
    if (sev === 'info') return { background: '#9fc5ff' }
    return { background: '#9fe365' }
  }

  const handleClick = (reviewId) => {
    navigate(`/results/${reviewId}`)
  }

  return (
    <>
      <div className="page-head">
        <h1>Review History</h1>
        <p>
          Browse past PR reviews — click any review to see the full analysis
        </p>
      </div>

      {loading && (
        <div className="loading-container" style={{ textAlign: 'center' }}>
          <h2 className="loading-title" style={{ fontSize: '1.2rem' }}>Loading reviews...</h2>
          <div className="loading-progress" style={{ marginTop: '16px' }}>
            <div className="loading-progress-fill" style={{ width: '40%' }} />
          </div>
        </div>
      )}

      {error && (
        <div className="loading-container">
          <h2 className="loading-title" style={{ fontSize: '1.2rem' }}>Cannot Load Reviews</h2>
          <p className="loading-subtitle">{error}</p>
          <p className="loading-subtitle" style={{ fontSize: '0.82rem', marginTop: '8px' }}>
            Make sure the backend is running: <code style={{ background: '#fff3de', padding: '2px 8px', border: '2px solid #121212', borderRadius: '4px' }}>uvicorn backend.main:app --reload</code>
          </p>
        </div>
      )}

      {!loading && !error && reviews.length === 0 && (
        <div className="empty-state">
          <h2>No Reviews Yet</h2>
          <p>
            Start by reviewing a public GitHub PR — paste any PR URL on the home page.
          </p>
          <Link to="/" className="btn btn-primary">
            ← Review a PR
          </Link>
        </div>
      )}

      {!loading && !error && reviews.length > 0 && (
        <div className="history-list">
          {reviews.slice(0, 10).map((review, idx) => {
            const repo = review.repo || review.state?.repo || 'unknown/repo'
            const prNumber = review.pr_number || review.state?.pr_number || 0
            const severity = String(review.summary?.highest_severity || review.overall_severity || 'clean').toLowerCase()
            const findingsCount = review.findings?.length || review.summary?.finding_count || 0
            const createdAt = review.created_at || ''

            return (
              <div
                key={review.id || idx}
                className="history-card is-revealed"
                style={{ animationDelay: `${idx * 60}ms` }}
                onClick={() => handleClick(review.id)}
                id={`history-card-${review.id}`}
              >
                <div className="history-info">
                  <h3>{repo}</h3>
                  <p>
                    PR #{prNumber} · {findingsCount} {findingsCount === 1 ? 'finding' : 'findings'}
                  </p>
                </div>

                <div className="history-badge">
                  <span
                    className="history-severity"
                    style={getSeverityStyle(severity)}
                  >
                    {severity === 'clean' ? '✓ Clean' : severity.toUpperCase()}
                  </span>
                  <span className="history-time">
                    {formatTime(createdAt)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
