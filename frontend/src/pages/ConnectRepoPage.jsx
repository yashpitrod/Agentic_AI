import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { API_URL } from '../App.jsx'

const STEPS = [
  { key: 'auth',    label: 'Connecting to GitHub',  emoji: '🔗' },
  { key: 'repo',    label: 'Enter your repo name',  emoji: '📁' },
  { key: 'install', label: 'Installing webhook',    emoji: '⚙️' },
  { key: 'done',    label: "You're live!",           emoji: '🚀' },
]

export default function ConnectRepoPage() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session')

  const [currentStep, setCurrentStep] = useState(0)
  const [repoName, setRepoName] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isInstalling, setIsInstalling] = useState(false)

  // Step 0 → 1: If we have a session, auth is done
  useEffect(() => {
    if (sessionId) {
      // Brief delay for visual satisfaction
      const timer = setTimeout(() => setCurrentStep(1), 600)
      return () => clearTimeout(timer)
    }
  }, [sessionId])

  const handleInstall = async (e) => {
    e.preventDefault()
    setError('')

    const trimmed = repoName.trim()
    if (!trimmed) {
      setError('Enter a repository name first!')
      return
    }

    if (!trimmed.includes('/') || trimmed.split('/').length !== 2) {
      setError('Use the format: owner/repo-name (e.g. octocat/Hello-World)')
      return
    }

    if (!sessionId) {
      setError('Session expired. Please reconnect with GitHub.')
      return
    }

    // Move to installing step
    setCurrentStep(2)
    setIsInstalling(true)

    try {
      const response = await fetch(`${API_URL}/api/connect-repo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_name: trimmed,
          session_id: sessionId,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || `Failed (${response.status})`)
      }

      const data = await response.json()
      setSuccessMessage(data.message || `SilentReviewer is now watching ${trimmed}.`)
      setCurrentStep(3)
    } catch (err) {
      setError(err.message)
      setCurrentStep(1) // Go back to repo input step
    } finally {
      setIsInstalling(false)
    }
  }

  const getStepStatus = (stepIndex) => {
    if (stepIndex < currentStep) return 'done'
    if (stepIndex === currentStep) return 'active'
    return 'pending'
  }

  // No session — show error state
  if (!sessionId) {
    return (
      <div className="connect-container">
        <div className="page-head">
          <h1>Connect Your Repo</h1>
          <p>Something went wrong — no session found.</p>
        </div>
        <div className="connect-error-card">
          <p>
            <strong>No OAuth session detected.</strong> This usually means you navigated
            here directly instead of through the GitHub authorization flow.
          </p>
          <div className="connect-actions">
            <a href={`${API_URL}/auth/github`} className="btn btn-primary" id="retry-oauth-btn">
              🔗 Connect with GitHub
            </a>
            <Link to="/" className="btn btn-small">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="connect-container">
      <div className="page-head">
        <h1>Connect Your Repo</h1>
        <p>Install SilentReviewer on your GitHub repository for automatic PR reviews</p>
      </div>

      {/* Steps */}
      <div className="connect-steps">
        {STEPS.map((step, idx) => {
          const status = getStepStatus(idx)
          return (
            <div
              key={step.key}
              className={`connect-step connect-step--${status}`}
              id={`connect-step-${step.key}`}
            >
              <div className="connect-step__number">
                {status === 'done' ? '✓' : idx + 1}
              </div>
              <div className="connect-step__body">
                <div className="connect-step__label">
                  <span className="connect-step__emoji">{step.emoji}</span>
                  {step.label}
                </div>

                {/* Step 1: Repo input form */}
                {step.key === 'repo' && status === 'active' && (
                  <form className="connect-repo-form" onSubmit={handleInstall}>
                    <input
                      type="text"
                      className={`url-input ${error ? 'is-error' : ''}`}
                      value={repoName}
                      onChange={(e) => { setRepoName(e.target.value); setError(''); }}
                      placeholder="owner/repo-name"
                      aria-label="Repository name"
                      id="repo-name-input"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isInstalling}
                      id="install-webhook-btn"
                    >
                      Install SilentReviewer
                    </button>
                  </form>
                )}

                {/* Step 2: Installing spinner */}
                {step.key === 'install' && status === 'active' && (
                  <div className="connect-step__status-text">
                    Setting up webhook on <strong>{repoName}</strong>...
                  </div>
                )}

                {/* Step 3: Success */}
                {step.key === 'done' && status === 'active' && (
                  <div className="connect-step__success">
                    <p className="connect-success-msg">
                      ✅ {successMessage || 'SilentReviewer is now watching your repo.'}
                    </p>
                    <p className="connect-success-hint">
                      Open any Pull Request on <strong>{repoName}</strong> to get an automatic AI review.
                    </p>
                    <div className="connect-actions">
                      <Link to="/history" className="btn btn-small btn-teal" id="go-history-btn">
                        View Review History
                      </Link>
                      <Link to="/" className="btn btn-small" id="go-home-btn">
                        ← Back to Home
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Error display */}
      {error && (
        <div className="connect-error-card">
          <p><strong>Error:</strong> {error}</p>
          <div className="connect-actions">
            <a href={`${API_URL}/auth/github`} className="btn btn-small" id="reconnect-btn">
              🔗 Reconnect with GitHub
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
