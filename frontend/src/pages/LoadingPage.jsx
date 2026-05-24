import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { API_URL } from '../App.jsx'

const STAGES = [
  { key: 'fetching_diff', label: 'Fetching PR diff from GitHub...' },
  { key: 'security', label: 'Running Security Agent...' },
  { key: 'architecture', label: 'Running Architecture Agent...' },
  { key: 'test_gaps', label: 'Checking test gaps...' },
  { key: 'consistency', label: 'Running Consistency Agent...' },
]

export default function LoadingPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { repo, prNumber } = location.state || {}

  const [stageStatuses, setStageStatuses] = useState(() => {
    const initial = {}
    STAGES.forEach(s => { initial[s.key] = 'pending' })
    return initial
  })
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const abortRef = useRef(null)

  // Redirect if accessed without state
  useEffect(() => {
    if (!repo || !prNumber) {
      navigate('/', { replace: true })
    }
  }, [repo, prNumber, navigate])

  useEffect(() => {
    if (!repo || !prNumber) return

    const abortController = new AbortController()
    abortRef.current = abortController

    async function startStream() {
      try {
        const response = await fetch(`${API_URL}/review-pr/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repo,
            pr_number: prNumber,
            post_comment: false,
          }),
          signal: abortController.signal,
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.detail || `Request failed with status ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6).trim()
            if (!jsonStr) continue

            try {
              const event = JSON.parse(jsonStr)
              handleEvent(event)
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message)
        }
      }
    }

    startStream()

    return () => {
      abortController.abort()
    }
  }, [repo, prNumber])

  function handleEvent(event) {
    const { stage, status, review_id, message } = event

    if (status === 'error') {
      setError(message || 'An error occurred during the review.')
      setStageStatuses(prev => ({ ...prev, [stage]: 'error' }))
      return
    }

    if (stage === 'complete' && status === 'done') {
      // All done — mark everything as done and navigate
      setStageStatuses(prev => {
        const updated = { ...prev }
        STAGES.forEach(s => {
          if (updated[s.key] !== 'error' && updated[s.key] !== 'skipped') {
            updated[s.key] = 'done'
          }
        })
        return updated
      })
      setProgress(100)

      // Small delay for visual satisfaction
      setTimeout(() => {
        navigate(`/results/${review_id}`, { replace: true })
      }, 800)
      return
    }

    // Update stage status
    if (stage && status) {
      const stageKey = stage === 'consistency' ? 'consistency' : stage
      setStageStatuses(prev => {
        const updated = { ...prev, [stageKey]: status }

        // Calculate progress
        const total = STAGES.length
        const completed = STAGES.filter(s => updated[s.key] === 'done' || updated[s.key] === 'skipped').length
        const running = STAGES.filter(s => updated[s.key] === 'running').length
        const pct = Math.round(((completed + running * 0.5) / total) * 100)
        setProgress(Math.min(pct, 95))

        return updated
      })
    }
  }

  if (!repo || !prNumber) return null

  return (
    <div className="loading-container">
      <h1 className="loading-title">Reviewing PR</h1>
      <p className="loading-subtitle">
        {repo} #{prNumber} — Parallel agents are analyzing your code
      </p>

      {/* Progress bar */}
      <div className="loading-progress">
        <div
          className="loading-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stage list */}
      <div className="loading-steps">
        {STAGES.map((stage) => {
          const status = stageStatuses[stage.key]
          let className = 'loading-step'
          if (status === 'running') className += ' is-running'
          else if (status === 'done') className += ' is-done'
          else if (status === 'error') className += ' is-error'
          else if (status === 'skipped') className += ' is-skipped'

          let icon = '○'
          if (status === 'done') icon = '✓'
          else if (status === 'running') icon = '◎'
          else if (status === 'error') icon = '✕'
          else if (status === 'skipped') icon = '–'

          return (
            <div key={stage.key} className={className}>
              <div className="step-icon">{icon}</div>
              <span>{stage.label}</span>
            </div>
          )
        })}
      </div>

      {/* Error display */}
      {error && (
        <div className="loading-error">
          <strong>Error:</strong> {error}
          <div style={{ marginTop: '12px' }}>
            <button
              className="btn btn-small"
              onClick={() => navigate('/', { replace: true })}
            >
              ← Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
