import { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Link, useLocation, useSearchParams } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LoadingPage from './pages/LoadingPage.jsx'
import ResultsPage from './pages/ResultsPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import ConnectRepoPage from './pages/ConnectRepoPage.jsx'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export { API_URL }

// ── Auth Context ──────────────────────────────────
const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export default function App() {
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // Auth state
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('sr_token'))
  const [authLoading, setAuthLoading] = useState(!!localStorage.getItem('sr_token'))

  // Check for token in URL params (from Google OAuth redirect)
  useEffect(() => {
    const urlToken = searchParams.get('token')
    if (urlToken) {
      localStorage.setItem('sr_token', urlToken)
      setToken(urlToken)
      // Remove token from URL
      searchParams.delete('token')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Fetch user info when token is available
  useEffect(() => {
    if (!token) {
      setUser(null)
      setAuthLoading(false)
      return
    }

    async function fetchUser() {
      try {
        const resp = await fetch(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (resp.ok) {
          const data = await resp.json()
          setUser(data)
        } else {
          // Token expired or invalid
          localStorage.removeItem('sr_token')
          setToken(null)
          setUser(null)
        }
      } catch {
        // Backend unreachable — keep token for later
      } finally {
        setAuthLoading(false)
      }
    }

    fetchUser()
  }, [token])

  const handleSignOut = () => {
    localStorage.removeItem('sr_token')
    setToken(null)
    setUser(null)
  }

  const isActive = (path) => location.pathname === path ? 'is-active' : ''

  return (
    <AuthContext.Provider value={{ user, token, authLoading }}>
      {/* Decorative background shapes */}
      <div className="shape shape-pink" aria-hidden="true" />
      <div className="shape shape-yellow" aria-hidden="true" />
      <div className="shape shape-teal" aria-hidden="true" />

      {/* Sticky Header */}
      <header className="site-header">
        <Link to="/" className="brand" onClick={() => setNavOpen(false)}>
          <div className="brand-mark">SR</div>
          <div>
            <strong>SilentReviewer</strong>
            <small>AI PR Reviews</small>
          </div>
        </Link>

        <button
          className={`nav-toggle ${navOpen ? 'is-open' : ''}`}
          onClick={() => setNavOpen(!navOpen)}
          aria-label="Toggle navigation"
        >
          <span /><span /><span />
        </button>

        <nav className={`site-nav ${navOpen ? 'is-open' : ''}`}>
          <Link to="/" className={isActive('/')} onClick={() => setNavOpen(false)}>
            Home
          </Link>
          <Link to="/history" className={isActive('/history')} onClick={() => setNavOpen(false)}>
            History
          </Link>

          {/* Auth button */}
          {user ? (
            <div className="user-menu">
              <img
                src={user.picture}
                alt={user.name}
                className="user-avatar"
                referrerPolicy="no-referrer"
              />
              <span className="user-name">{user.name?.split(' ')[0]}</span>
              <button
                onClick={() => { handleSignOut(); setNavOpen(false); }}
                className="btn btn-small btn-sign-out"
                id="sign-out-btn"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <a
              href={`${API_URL}/auth/google`}
              className="btn btn-small btn-google"
              id="sign-in-btn"
              onClick={() => setNavOpen(false)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </a>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <main className="site-main">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/review" element={<LoadingPage />} />
          <Route path="/results/:id" element={<ResultsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/connect" element={<ConnectRepoPage />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="site-footer">
        SilentReviewer — Agentic AI PR review system powered by LangGraph &amp; Gemini
      </footer>
    </AuthContext.Provider>
  )
}
