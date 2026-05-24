import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
          Paste any public GitHub Pull Request URL below — our AI agents will analyze
          security, architecture, test coverage, and code consistency in parallel.
        </p>

        {/* Clear instruction label */}
        <label
          htmlFor="pr-url-input"
          style={{
            display: 'block',
            fontSize: '0.82rem',
            fontWeight: 700,
            marginBottom: '8px',
            color: '#333',
          }}
        >
          📋 Paste a GitHub PR URL here:
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
          <p style={{ color: '#ff4d4d', fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px' }}>
            {error}
          </p>
        )}

        {/* How to get a PR URL — step by step */}
        <div style={{
          fontSize: '0.78rem',
          color: '#777',
          marginBottom: '16px',
          lineHeight: 1.6,
        }}>
          Go to any GitHub repo → Pull Requests tab → click a PR → copy the URL from your browser
        </div>

        {/* Prominent try-it button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#555' }}>
            Don't have a PR URL?
          </span>
          <button
            onClick={handleTryExample}
            className="btn btn-small btn-teal"
            id="try-example-btn"
          >
            🚀 Try with facebook/react PR #31185
          </button>
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

