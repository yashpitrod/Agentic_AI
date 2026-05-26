import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { API_URL, useAuth } from '../App.jsx'

export default function HistoryPage() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const { user, token } = useAuth()

  useEffect(() => {
    async function fetchHistory() {
      try {
        const headers = {}
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        const response = await fetch(`${API_URL}/reviews`, { headers })
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
  }, [token])

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
          {user
            ? `Your reviews, ${user.name?.split(' ')[0]} — click any to see the full analysis`
            : 'Sign in to see your personal review history'
          }
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
          <p style={{ marginBottom: '16px' }}>
            {user
              ? 'You haven\'t run any reviews yet. Start by reviewing a PR:'
              : 'Sign in with Google to save personal reviews, or try a quick review:'
            }
          </p>
          <div className="empty-state-options">
            <div className="empty-state-option">
              <strong>Option A — Quick Review</strong>
              <p>Paste any public GitHub PR URL on the home page and click Review.</p>
            </div>
            <div className="empty-state-option">
              <strong>Option B — Connected Repo</strong>
              <p>If you connected a repo, open a new Pull Request on it — the review will appear here automatically.</p>
            </div>
          </div>
          {!user && (
            <a href={`${API_URL}/auth/google`} className="btn btn-google" style={{ marginTop: '14px' }}>
              Continue with Google
            </a>
          )}
          <Link to="/" className="btn btn-primary" style={{ marginTop: '14px' }}>
            ← Review a PR Now
          </Link>
        </div>
      )}

      {!loading && !error && reviews.length > 0 && (
        <div className="history-list">
          {reviews.map((review, idx) => {
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
