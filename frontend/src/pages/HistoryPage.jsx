import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { API_URL, useAuth } from '../App.jsx'

export default function HistoryPage() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const { user, token, authLoading } = useAuth()

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }

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
  }, [token, user, authLoading])

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

  if (authLoading) {
    return (
      <div className="loading-container" style={{ textAlign: 'center' }}>
        <h2 className="loading-title" style={{ fontSize: '1.2rem' }}>Checking Authentication...</h2>
        <div className="loading-progress" style={{ marginTop: '16px' }}>
          <div className="loading-progress-fill" style={{ width: '40%' }} />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="empty-state" style={{ maxWidth: '500px', margin: '40px auto' }}>
        <h2>Authentication Required</h2>
        <p style={{ marginBottom: '20px' }}>You must sign in with Google to view and manage your personal review history.</p>
        <a href={`${API_URL}/auth/google`} className="btn btn-google">
          <svg viewBox="0 0 24 24" width="18" height="18" style={{ flexShrink: 0, marginRight: '8px' }}>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </a>
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <h1>Review History</h1>
        <p>
          Your reviews, {user.name?.split(' ')[0]} — click any to see the full analysis
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
