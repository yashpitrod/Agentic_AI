import { useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LoadingPage from './pages/LoadingPage.jsx'
import ResultsPage from './pages/ResultsPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export { API_URL }

export default function App() {
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()

  const isActive = (path) => location.pathname === path ? 'is-active' : ''

  return (
    <>
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
          className="nav-toggle"
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
        </nav>
      </header>

      {/* Main Content */}
      <main className="site-main">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/review" element={<LoadingPage />} />
          <Route path="/results/:id" element={<ResultsPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="site-footer">
        SilentReviewer — Agentic AI PR review system powered by LangGraph & Gemini
      </footer>
    </>
  )
}
