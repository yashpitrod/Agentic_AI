import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL, useAuth } from '../App.jsx'

/**
 * Parse a GitHub PR URL into { repo, prNumber }.
 * Supports formats:
 *   https://github.com/owner/repo/pull/123
 *   github.com/owner/repo/pull/123
 *   owner/repo #123  (shorthand)
 */
function parsePRUrl(input) {
  const trimmed = input.trim()

  // Full URL format
  const urlMatch = trimmed.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/)
  if (urlMatch) {
    return { repo: urlMatch[1], prNumber: parseInt(urlMatch[2], 10) }
  }

  // Shorthand: owner/repo #123
  const shortMatch = trimmed.match(/^([^/]+\/[^/\s]+)\s*#\s*(\d+)$/)
  if (shortMatch) {
    return { repo: shortMatch[1], prNumber: parseInt(shortMatch[2], 10) }
  }

  return null
}

export default function LandingPage() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [imgFailed, setImgFailed] = useState(false)
  const navigate = useNavigate()
  const { user, authLoading } = useAuth()

  if (authLoading) {
    return (
      <div className="loading-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h1 className="loading-title">Checking Authentication...</h1>
        <div className="loading-progress" style={{ margin: '20px auto 0', maxWidth: '300px' }}>
          <div className="loading-progress-fill" style={{ width: '40%' }} />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <section className="hero" id="hero-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="hero-copy" style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p className="eyebrow">Secure Code Review Agent</p>

          <h1 style={{ fontSize: '2.5rem', lineHeight: '1.2', marginBottom: '20px' }}>
            AI-powered reviews start with <span className="highlight">Google Sign-in</span>
          </h1>

          <p className="hero-line" style={{ fontSize: '1.15rem', color: '#444', marginBottom: '30px' }}>
            Authenticate using Google to get access to SilentReviewer, run manual pull request reviews, and connect your own repositories securely.
          </p>

          <div className="option-card" id="option-auth-card" style={{ width: '100%', maxWidth: '480px', transform: 'none', boxShadow: '8px 8px 0 var(--ink)', border: '3px solid var(--ink)', background: 'var(--paper)', borderRadius: 'var(--radius-lg)' }}>
            <div className="option-card__header option-card__header--sky" style={{ display: 'flex', justifyContent: 'center', borderBottom: '3px solid var(--ink)', padding: '12px', background: 'var(--sky)' }}>
              <span className="option-card__title" style={{ fontSize: '1.2rem', fontWeight: 800 }}>Welcome to SilentReviewer</span>
            </div>
            <div className="option-card__body option-card__body--center" style={{ padding: '40px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div className="option-card__icon" style={{ fontSize: '3rem', margin: '0 0 10px' }}>🔑</div>
              <p className="option-card__desc" style={{ textAlign: 'center', fontSize: '0.95rem', color: '#555', margin: 0 }}>
                Join SilentReviewer to analyze code, identify security issues, check test gaps, and track your review history in one isolated, private dashboard.
              </p>
              
              <a
                href={`${API_URL}/auth/google`}
                className="btn btn-google"
                id="landing-signin-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  fontSize: '1.1rem',
                  padding: '14px 28px',
                  borderRadius: '10px',
                  boxShadow: '4px 4px 0 var(--ink)',
                  border: '3px solid var(--ink)',
                  background: '#fff',
                  cursor: 'pointer',
                  width: '100%',
                  marginTop: '10px'
                }}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <strong style={{ fontWeight: 800 }}>Continue with Google</strong>
              </a>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!url.trim()) {
      setError('Paste a GitHub PR URL first!')
      return
    }

    const parsed = parsePRUrl(url)
    if (!parsed) {
      setError('That doesn\'t look right. Paste a full PR URL like: https://github.com/facebook/react/pull/31185')
      return
    }

    navigate('/review', {
      state: { repo: parsed.repo, prNumber: parsed.prNumber },
    })
  }

  const handleTryExample = () => {
    setError('')
    navigate('/review', {
      state: { repo: 'facebook/react', prNumber: 31185 },
    })
  }

  return (
    <section className="hero" id="hero-section">
      <div className="hero-copy">
        <p className="eyebrow">Open-Source AI Agent</p>

        <h1>
          AI-powered PR reviews for teams without a{' '}
          <span className="highlight">senior engineer</span>
        </h1>

        <p className="hero-line">
          Try a one-time review on any public PR, or connect your repo for automatic
          AI reviews on every pull request.
        </p>

        {/* ── Two Option Cards ────────────────────────── */}
        <div className="hero-options">

          {/* Option A: Public PR Review */}
          <div className="option-card" id="option-public-pr">
            <div className="option-card__header option-card__header--sky">
              <span className="option-card__badge">A</span>
              <span className="option-card__title">Try with a Public PR</span>
            </div>
            <div className="option-card__body">
              <label
                htmlFor="pr-url-input"
                className="option-card__label"
              >
                📋 Paste a GitHub PR URL:
              </label>

              <form className="url-form" onSubmit={handleSubmit} id="pr-url-form">
                <input
                  type="text"
                  className={`url-input ${error ? 'is-error' : ''}`}
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(''); }}
                  placeholder="https://github.com/facebook/react/pull/31185"
                  aria-label="GitHub PR URL"
                  id="pr-url-input"
                />
                <button type="submit" className="btn btn-primary" id="review-btn">
                  Review ↗
                </button>
              </form>

              {error && (
                <p className="option-card__error">
                  {error}
                </p>
              )}

              <div className="option-card__hint">
                Go to any GitHub repo → Pull Requests tab → click a PR → copy the URL
              </div>

              <div className="option-card__try">
                <span>Don't have a PR URL?</span>
                <button
                  onClick={handleTryExample}
                  className="btn btn-small btn-teal"
                  id="try-example-btn"
                >
                  🚀 Try facebook/react #31185
                </button>
              </div>
            </div>
          </div>

          {/* OR Divider */}
          <div className="option-divider">
            <span>OR</span>
          </div>

          {/* Option B: Connect Repo */}
          <div className="option-card" id="option-connect-repo">
            <div className="option-card__header option-card__header--green">
              <span className="option-card__badge">B</span>
              <span className="option-card__title">Connect Your Repo</span>
            </div>
            <div className="option-card__body option-card__body--center">
              <div className="option-card__icon">🔗</div>
              <p className="option-card__desc">
                Install SilentReviewer on your own repository for <strong>automatic
                AI reviews</strong> on every pull request — no manual pasting needed.
              </p>
              <a
                href={`${API_URL}/auth/github`}
                className="btn btn-primary btn-github"
                id="connect-github-btn"
              >
                <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                Connect with GitHub
              </a>
              <div className="option-card__hint">
                Requires admin access to the repository
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hero-visual">
        {!imgFailed ? (
          <img
            src="/images/review-preview-placeholder.png"
            alt="SilentReviewer AI comment posted on a GitHub pull request showing security and architecture findings"
            className="preview-image"
            width="900"
            height="500"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="preview-placeholder">
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📸</div>
              <div>Live review screenshot coming soon</div>
              <div style={{ fontSize: '0.75rem', marginTop: '6px', color: '#888' }}>
                Drop your screenshot at<br />
                /public/images/review-preview-placeholder.png
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
