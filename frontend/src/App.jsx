import React, { useState, useEffect } from 'react';
import {
  GitPullRequest,
  ShieldAlert,
  Cpu,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Play,
  Terminal,
  Copy,
  ExternalLink,
  Search,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import './App.css';

// ==========================================
// 1. ROBUST MOCK DATA (Phase 5 State Schema)
// ==========================================
const MOCK_PRS = [
  {
    repo: "yashpitrod/Agentic_AI",
    pr_number: 142,
    pr_title: "feat(auth): add database user authentication and password storage",
    author: "yashpitrod",
    date: "2026-05-23T18:45:00Z",
    summary: {
      finding_count: 4,
      highest_severity: "critical"
    },
    state: {
      diff: `diff --git a/backend/auth.py b/backend/auth.py
index a12e56b..f92c34d 100644
--- a/backend/auth.py
+++ b/backend/auth.py
@@ -1,4 +1,12 @@
 def authenticate_user(username, password):
+    # Hardcoded credential pattern
+    admin_password = "admin123"
+    
+    # Unsafe raw string concatenation SQL Injection
+    query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'"
+    db.execute(query)
+
+def send_email_and_save_user_to_db(user):
+    # SRP Violation (Multi-concern)
+    db.save(user)
+    mail.send_welcome(user.email)`,
      repo: "yashpitrod/Agentic_AI",
      pr_number: 142,
      security_findings: [
        {
          "issue_type": "Hardcoded Secret",
          "severity": "critical",
          "file": "backend/auth.py",
          "description": "A hardcoded administrative password ('admin123') was detected. Credentials must be loaded from secure environment variables or a secret vault.",
          "line_hint": "+ admin_password = \"admin123\""
        },
        {
          "issue_type": "SQL Injection",
          "severity": "critical",
          "file": "backend/auth.py",
          "description": "SQL query uses string concatenation with raw username input. This permits full SQL Injection. Use parameterized query placeholders instead.",
          "line_hint": "+ query = \"SELECT * FROM users WHERE username = '\" + username + \"' ...\""
        }
      ],
      architecture_findings: [
        {
          "violation_type": "SRP Violation (Single Responsibility Principle)",
          "description": "The function 'send_email_and_save_user_to_db' handles both database persistence and third-party email sending.",
          "refactor_suggestion": "Decompose into 'save_user_to_db(user)' and 'send_welcome_email(user)' to keep side effects decoupled.",
          "severity": "warning"
        }
      ],
      context_findings: [
        {
          "type": "Naming Style Inconsistency",
          "severity": "info",
          "description": "The function name 'send_email_and_save_user_to_db' is overly verbose and deviates from the project's standard pattern of single-action active verb naming."
        }
      ]
    },
    findings: [
      {
        "agent": "Security Agent",
        "severity": "critical",
        "title": "Hardcoded Secret",
        "details": "A hardcoded administrative password ('admin123') was detected. Credentials must be loaded from secure environment variables or a secret vault.",
        "file": "backend/auth.py",
        "line_hint": "+ admin_password = \"admin123\""
      },
      {
        "agent": "Security Agent",
        "severity": "critical",
        "title": "SQL Injection",
        "details": "SQL query uses string concatenation with raw username input. This permits full SQL Injection. Use parameterized query placeholders instead.",
        "file": "backend/auth.py",
        "line_hint": "+ query = \"SELECT * FROM users WHERE username = '\" + username + \"' ...\""
      },
      {
        "agent": "Architecture Agent",
        "severity": "warning",
        "title": "SRP Violation (Single Responsibility Principle)",
        "details": "The function 'send_email_and_save_user_to_db' handles both database persistence and third-party email sending.",
        "refactor_suggestion": "Decompose into 'save_user_to_db(user)' and 'send_welcome_email(user)' to keep side effects decoupled."
      },
      {
        "agent": "Context Agent",
        "severity": "info",
        "title": "Naming Style Inconsistency",
        "details": "The function name 'send_email_and_save_user_to_db' is overly verbose and deviates from the project's standard pattern of single-action active verb naming."
      }
    ],
    markdown: `## SilentReviewer Findings

### 🔴 Security Agent Findings
<details>
<summary><b>[CRITICAL] Hardcoded Secret</b> in <code>backend/auth.py</code></summary>

* **Description:** A hardcoded administrative password (\`admin123\`) was detected. Credentials must be loaded from secure environment variables or a secret vault.
* **Line Hint:**
  \`\`\`python
  + admin_password = "admin123"
  \`\`\`
</details>

<details>
<summary><b>[CRITICAL] SQL Injection</b> in <code>backend/auth.py</code></summary>

* **Description:** SQL query uses string concatenation with raw username input. This permits full SQL Injection. Use parameterized query placeholders instead.
* **Line Hint:**
  \`\`\`python
  + query = "SELECT * FROM users WHERE username = '" + username + "' ..."
  \`\`\`
</details>

### 🟡 Architecture Agent Findings
<details>
<summary><b>[WARNING] SRP Violation</b></summary>

* **Description:** The function 'send_email_and_save_user_to_db' handles both database persistence and third-party email sending.
* **Refactor Suggestion:** Decompose into 'save_user_to_db(user)' and 'send_welcome_email(user)' to keep side effects decoupled.
</details>

### 🔵 Context Agent Findings
<details>
<summary><b>[INFO] Naming Style Inconsistency</b></summary>

* **Description:** The function name 'send_email_and_save_user_to_db' is overly verbose and deviates from the project's standard pattern of single-action active verb naming.
</details>`
  },
  {
    repo: "facebook/react",
    pr_number: 28994,
    pr_title: "refactor(hooks): introduce heavy nested helper context resolver",
    author: "star-coder",
    date: "2026-05-22T14:20:00Z",
    summary: {
      finding_count: 2,
      highest_severity: "warning"
    },
    state: {
      diff: `+ class HookContextResolverGodObject {
+     # Violates line count & SRP
+     # Contains over 250+ lines of custom resolving logic
+     # and triggers circular reference risks
+ }`,
      repo: "facebook/react",
      pr_number: 28994,
      security_findings: [],
      architecture_findings: [
        {
          "violation_type": "God Class Violation",
          "description": "Class 'HookContextResolverGodObject' acts as a God Class. It encapsulates multiple unrelated orchestration layers and spans more than 280 lines.",
          "refactor_suggestion": "Decompose into smaller utility classes: 'ContextStore', 'HookResolver', and 'ReferenceValidator'.",
          "severity": "warning"
        }
      ],
      context_findings: [
        {
          "type": "Circular Import Risk",
          "severity": "info",
          "description": "Imports 'react-reconciler' inside this utility block which could trigger a circular module reference during runtime."
        }
      ]
    },
    findings: [
      {
        "agent": "Architecture Agent",
        "severity": "warning",
        "title": "God Class Violation",
        "details": "Class 'HookContextResolverGodObject' acts as a God Class. It encapsulates multiple unrelated orchestration layers and spans more than 280 lines.",
        "refactor_suggestion": "Decompose into smaller utility classes: 'ContextStore', 'HookResolver', and 'ReferenceValidator'."
      },
      {
        "agent": "Context Agent",
        "severity": "info",
        "title": "Circular Import Risk",
        "details": "Imports 'react-reconciler' inside this utility block which could trigger a circular module reference during runtime."
      }
    ],
    markdown: `## SilentReviewer Findings

### 🟡 Architecture Agent Findings
<details>
<summary><b>[WARNING] God Class Violation</b></summary>

* **Description:** Class 'HookContextResolverGodObject' acts as a God Class. It encapsulates multiple unrelated orchestration layers and spans more than 280 lines.
* **Refactor Suggestion:** Decompose into smaller utility classes: 'ContextStore', 'HookResolver', and 'ReferenceValidator'.
</details>

### 🔵 Context Agent Findings
<details>
<summary><b>[INFO] Circular Import Risk</b></summary>

* **Description:** Imports 'react-reconciler' inside this utility block which could trigger a circular module reference during runtime.
</details>`
  },
  {
    repo: "demo/repo",
    pr_number: 1,
    pr_title: "feat: add user login and registration controllers",
    author: "partner-contrib",
    date: "2026-05-21T09:12:00Z",
    summary: {
      finding_count: 3,
      highest_severity: "critical"
    },
    state: {
      diff: `+ password = "admin123"
+ query = "SELECT * FROM users WHERE id = " + user_id
+ def send_email_and_save_user_to_db(user):
+     pass`,
      repo: "demo/repo",
      pr_number: 1,
      security_findings: [
        {
          "issue_type": "Hardcoded Secret",
          "severity": "critical",
          "file": "main.py",
          "description": "Hardcoded password 'admin123' found. Secrets should be stored securely, not directly in code. Consider using environment variables, a secrets management service, or a configuration file.",
          "line_hint": "+ password = \"admin123\""
        },
        {
          "issue_type": "SQL Injection",
          "severity": "critical",
          "file": "main.py",
          "description": "Potential SQL injection vulnerability. The 'user_id' variable is directly concatenated into the SQL query, allowing for malicious input to alter query logic. Use parameterized queries or prepared statements to prevent this.",
          "line_hint": "+ query = \"SELECT * FROM users WHERE id = \" + user_id"
        }
      ],
      architecture_findings: [
        {
          "violation_type": "SRP Violation",
          "description": "The function `send_email_and_save_user_to_db` is responsible for two distinct concerns: sending emails and saving user data to the database. This violates the Single Responsibility Principle (SRP).",
          "refactor_suggestion": "Split the function into two separate, focused functions: `send_user_email(user)` and `save_user_to_db(user)`. Each function should then handle only one specific responsibility.",
          "severity": "warning"
        }
      ],
      context_findings: []
    },
    findings: [
      {
        "agent": "Security Agent",
        "severity": "critical",
        "title": "Hardcoded Secret",
        "details": "Hardcoded password 'admin123' found. Secrets should be stored securely, not directly in code. Consider using environment variables, a secrets management service, or a configuration file.",
        "file": "main.py",
        "line_hint": "+ password = \"admin123\""
      },
      {
        "agent": "Security Agent",
        "severity": "critical",
        "title": "SQL Injection",
        "details": "Potential SQL injection vulnerability. The 'user_id' variable is directly concatenated into the SQL query, allowing for malicious input to alter query logic. Use parameterized queries or prepared statements to prevent this.",
        "file": "main.py",
        "line_hint": "+ query = \"SELECT * FROM users WHERE id = \" + user_id"
      },
      {
        "agent": "Architecture Agent",
        "severity": "warning",
        "title": "SRP Violation",
        "details": "The function `send_email_and_save_user_to_db` is responsible for two distinct concerns: sending emails and saving user data to the database. This violates the Single Responsibility Principle (SRP).",
        "refactor_suggestion": "Split the function into two separate, focused functions: `send_user_email(user)` and `save_user_to_db(user)`. Each function should then handle only one specific responsibility."
      }
    ],
    markdown: `## SilentReviewer Findings

### 🔴 Security Agent Findings
<details>
<summary><b>[CRITICAL] Hardcoded Secret</b> in <code>main.py</code></summary>

* **Description:** Hardcoded password 'admin123' found. Secrets should be stored securely, not directly in code. Consider using environment variables, a secrets management service, or a configuration file.
* **Line Hint:**
  \`\`\`python
  + password = "admin123"
  \`\`\`
</details>

<details>
<summary><b>[CRITICAL] SQL Injection</b> in <code>main.py</code></summary>

* **Description:** Potential SQL injection vulnerability. The 'user_id' variable is directly concatenated into the SQL query, allowing for malicious input to alter query logic. Use parameterized queries or prepared statements to prevent this.
* **Line Hint:**
  \`\`\`python
  + query = "SELECT * FROM users WHERE id = " + user_id
  \`\`\`
</details>

### 🟡 Architecture Agent Findings
<details>
<summary><b>[WARNING] SRP Violation</b></summary>

* **Description:** The function \`send_email_and_save_user_to_db\` is responsible for two distinct concerns: sending emails and saving user data to the database. This violates the Single Responsibility Principle (SRP).
* **Refactor Suggestion:** Split the function into two separate, focused functions: \`send_user_email(user)\` and \`save_user_to_db(user)\`.
</details>`
  },
  {
    repo: "django/django",
    pr_number: 17351,
    pr_title: "fix(views): fix validation for query parameters in list view",
    author: "clean-coder",
    date: "2026-05-20T11:05:00Z",
    summary: {
      finding_count: 0,
      highest_severity: "clean"
    },
    state: {
      diff: `+ def get_queryset(self):
+     # Clean & Parameterized
+     user_id = self.request.GET.get('user_id')
+     if user_id and user_id.isdigit():
+         return self.model.objects.filter(id=int(user_id))
+     return self.model.objects.none()`,
      repo: "django/django",
      pr_number: 17351,
      security_findings: [],
      architecture_findings: [],
      context_findings: []
    },
    findings: [],
    markdown: `## SilentReviewer Findings

No blocking issues found in this first-pass review. The code matches standard security, design, style, and testing requirements!`
  },
  {
    repo: "pallets/flask",
    pr_number: 5212,
    pr_title: "feat(blueprints): support custom middleware resolution",
    author: "app-architect",
    date: "2026-05-19T16:30:00Z",
    summary: {
      finding_count: 1,
      highest_severity: "info"
    },
    state: {
      diff: `+ def add_middleware(self, middleware_callable):
+     # Flask standards usually use decorators
+     self.before_request(middleware_callable)`,
      repo: "pallets/flask",
      pr_number: 5212,
      security_findings: [],
      architecture_findings: [],
      context_findings: [
        {
          "type": "Style Deviation",
          "severity": "info",
          "description": "Blueprint utilizes manual middleware lists instead of standard Flask decorator decorators, which may confuse developers who expect conventional decorator registration."
        }
      ]
    },
    findings: [
      {
        "agent": "Context Agent",
        "severity": "info",
        "title": "Style Deviation",
        "details": "Blueprint utilizes manual middleware lists instead of standard Flask decorator decorators, which may confuse developers who expect conventional decorator registration."
      }
    ],
    markdown: `## SilentReviewer Findings

### 🔵 Context Agent Findings
<details>
<summary><b>[INFO] Style Deviation</b></summary>

* **Description:** Blueprint utilizes manual middleware lists instead of standard Flask decorator decorators, which may confuse developers who expect conventional decorator registration.
</details>`
  }
];

export default function App() {
  // Navigation & PR State
  const [prs, setPrs] = useState(MOCK_PRS);
  const [selectedPr, setSelectedPr] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all");

  // Custom Live Trigger Form
  const [customDiff, setCustomDiff] = useState("");
  const [customRepo, setCustomRepo] = useState("yashpitrod/Agentic_AI");
  const [customPrNumber, setCustomPrNumber] = useState(1);
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);
  const [showLiveForm, setShowLiveForm] = useState(false);

  // Accordion Expand State in Details View
  const [expandedSection, setExpandedSection] = useState({
    security: true,
    architecture: true,
    test_gaps: true,
    consistency: true,
    markdown: true
  });

  // Toggle single accordion section
  const toggleSection = (section) => {
    setExpandedSection(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Helper to copy text to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  // Clean fetch logic with beautiful mock fallback
  const handleReviewDiff = async (e) => {
    e.preventDefault();
    if (!customDiff.trim()) return;

    setIsLiveLoading(true);
    setLiveError(null);

    const payload = {
      diff: customDiff,
      repo: customRepo,
      pr_number: Number(customPrNumber)
    };

    try {
      // Point to our FastAPI backend manual review endpoint
      const response = await fetch("http://localhost:8000/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const result = await response.json();

      // Inject returned real-time results into list
      const newPr = {
        repo: result.repo || customRepo,
        pr_number: result.pr_number || Number(customPrNumber),
        pr_title: `Live Review Request: ${customRepo}#${customPrNumber}`,
        author: "Live Trigger API",
        date: new Date().toISOString(),
        summary: result.summary,
        state: result.state,
        findings: result.findings,
        markdown: result.markdown
      };

      setPrs(prev => [newPr, ...prev]);
      setSelectedPr(newPr);
      setShowLiveForm(false);
      setCustomDiff("");
    } catch (error) {
      console.warn("[SilentReviewer Dashboard] Backend API fetch failed or offline. Falling back to robust simulation...", error);

      // FALLBACK SIMULATION logic mimicking complete Gemini orchestrator findings for the demo
      setTimeout(() => {
        let simulatedFindings = [];
        let highest = "clean";

        // Check content patterns to dynamically simulate findings
        const diffLower = customDiff.toLowerCase();
        if (diffLower.includes("password") || diffLower.includes("secret") || diffLower.includes("api_key") || diffLower.includes("token")) {
          simulatedFindings.push({
            agent: "Security Agent",
            severity: "critical",
            title: "Hardcoded Secret",
            details: "Simulated Review: A plaintext credential pattern was found in the diff. Securely store secrets in vault systems.",
            file: "main.py",
            line_hint: "+ " + (customDiff.split('\n').find(l => l.includes("password") || l.includes("secret")) || "password = '...'")
          });
          highest = "critical";
        }
        if (diffLower.includes("select ") || diffLower.includes("from ") || diffLower.includes("concat")) {
          simulatedFindings.push({
            agent: "Security Agent",
            severity: "critical",
            title: "SQL Injection Risk",
            details: "Simulated Review: Direct injection pattern detected in SQL execution. Transition to parameterized placeholders.",
            file: "db.py",
            line_hint: "+ " + (customDiff.split('\n').find(l => l.includes("select") || l.includes("concat")) || "query = '...'")
          });
          highest = "critical";
        }
        if (customDiff.split('\n').length > 50) {
          simulatedFindings.push({
            agent: "Architecture Agent",
            severity: "warning",
            title: "Large Code Surface Area",
            details: "Simulated Review: This PR contains a substantial number of contiguous additions. Review concerns carefully.",
            refactor_suggestion: "Favour composing small unit modules rather than adding bulky standalone logic Blocks."
          });
          if (highest !== "critical") highest = "warning";
        }
        if (diffLower.includes("def ") && !diffLower.includes("test_")) {
          simulatedFindings.push({
            agent: "Context Agent",
            severity: "info",
            title: "Test Gap Detector Alert",
            details: "Simulated Review: You introduced new definition declarations but did not supply corresponding unit tests."
          });
          if (highest === "clean") highest = "info";
        }

        const simulatedMarkdown = `## SilentReviewer Findings

${simulatedFindings.length > 0 ? simulatedFindings.map(f => `### ${f.severity === 'critical' ? '🔴' : f.severity === 'warning' ? '🟡' : '🔵'} ${f.agent}
<details>
<summary><b>[${f.severity.toUpperCase()}] ${f.title}</b></summary>

* **Description:** ${f.details}
${f.line_hint ? `* **Line Hint:**\n  \`\`\`python\n  ${f.line_hint}\n  \`\`\`` : ''}
${f.refactor_suggestion ? `* **Refactor Suggestion:** ${f.refactor_suggestion}` : ''}
</details>`).join('\n\n') : 'No blocking issues found in this first-pass review. The code looks clean!'}`;

        const simulatedPR = {
          repo: customRepo,
          pr_number: Number(customPrNumber),
          pr_title: `Live Demo Review (${customRepo}#${customPrNumber})`,
          author: "Demo Presenter",
          date: new Date().toISOString(),
          summary: {
            finding_count: simulatedFindings.length,
            highest_severity: highest
          },
          state: {
            diff: customDiff,
            repo: customRepo,
            pr_number: Number(customPrNumber),
            security_findings: simulatedFindings.filter(f => f.agent === "Security Agent"),
            architecture_findings: simulatedFindings.filter(f => f.agent === "Architecture Agent"),
            context_findings: simulatedFindings.filter(f => f.agent === "Context Agent")
          },
          findings: simulatedFindings,
          markdown: simulatedMarkdown
        };

        setPrs(prev => [simulatedPR, ...prev]);
        setSelectedPr(simulatedPR);
        setShowLiveForm(false);
        setCustomDiff("");
        setIsLiveLoading(false);
      }, 1000);
    } finally {
      setIsLiveLoading(false);
    }
  };

  // Helper colors for neubrutalist badges
  const getSeverityStyle = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return { bg: 'bg-[#ff5e97]', label: '🔴 Critical' };
      case 'warning':
        return { bg: 'bg-[#ffc542]', label: '🟡 Warning' };
      case 'info':
        return { bg: 'bg-[#6fe7db]', label: '🔵 Info' };
      case 'clean':
      case 'none':
        return { bg: 'bg-[#5dfdcb]', label: '🟢 Clean' };
      default:
        return { bg: 'bg-white', label: 'Info' };
    }
  };

  // Filter & search PR list
  const filteredPrs = prs.filter(pr => {
    const matchesSearch = pr.repo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.pr_title.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterSeverity === 'all') return matchesSearch;
    return matchesSearch && pr.summary.highest_severity.toLowerCase() === filterSeverity;
  });

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto flex flex-col gap-8">

      {/* ==========================================
          HEADER SECTION (SilentReviewer Brand)
         ========================================== */}
      <header className="neo-card bg-[#FFF37A] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight select-none font-sans uppercase m-0 flex items-center gap-3">
            <Cpu className="w-10 h-10 md:w-14 md:h-14 stroke-[3px] text-black fill-[#ff5e97]" />
            SilentReviewer
          </h1>
          <p className="text-lg font-bold text-gray-800 mt-2 font-sans border-t-2 border-black pt-1 inline-block">
            High-Contrast AI Pull Request Reviewer Dashboard &bull; Phase 5
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowLiveForm(!showLiveForm)}
            className="neo-btn bg-[#5dfdcb] hover:bg-[#34e2aa] py-3 px-6 text-sm md:text-base flex items-center gap-2"
          >
            <Play className="w-5 h-5 fill-black" />
            Live Demo Trigger
          </button>
        </div>
      </header>

      {/* ==========================================
          LIVE CODE REVIEW TRIGGER (FORM MODAL)
         ========================================== */}
      {showLiveForm && (
        <div className="neo-card bg-[#FDFD96] border-4 border-black neo-shadow-lg flex flex-col gap-4">
          <div className="flex justify-between items-center border-b-4 border-black pb-3">
            <h3 className="text-xl md:text-2xl font-black uppercase flex items-center gap-2 m-0">
              <Terminal className="w-6 h-6 stroke-[3px]" />
              Trigger Live PR Diff Review
            </h3>
            <button
              onClick={() => setShowLiveForm(false)}
              className="neo-btn bg-white py-1 px-3 text-xs"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleReviewDiff} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-black uppercase">GitHub Repository Name</label>
                <input
                  type="text"
                  value={customRepo}
                  onChange={(e) => setCustomRepo(e.target.value)}
                  className="neo-input"
                  placeholder="e.g. facebook/react"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-black uppercase">PR Number</label>
                <input
                  type="number"
                  value={customPrNumber}
                  onChange={(e) => setCustomPrNumber(e.target.value)}
                  className="neo-input"
                  placeholder="e.g. 176"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-black uppercase flex justify-between items-center">
                <span>Unified Diff Patch</span>
                <span className="text-xs text-gray-600">Must prefix additions with +</span>
              </label>
              <textarea
                value={customDiff}
                onChange={(e) => setCustomDiff(e.target.value)}
                className="neo-input font-mono-brutal min-h-[160px] text-sm"
                placeholder={`+ password = "admin123"\n+ query = "SELECT * FROM users WHERE id = " + user_id`}
                required
              />
            </div>

            <div className="flex justify-between items-center">
              <div className="text-xs font-bold text-gray-700">
                ⭐ Tips: Paste credentials or concatenations to trigger security findings!
              </div>
              <button
                type="submit"
                disabled={isLiveLoading}
                className="neo-btn bg-[#ff5e97] hover:bg-[#ff2d75] py-3 px-8 text-white uppercase tracking-wider flex items-center gap-2"
              >
                {isLiveLoading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Running Agents...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-white stroke-none" />
                    Run Agents
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================
          MAIN VIEWS SWITCHER
         ========================================== */}
      {!selectedPr ? (

        // ==========================================
        // VIEW 1: DASHBOARD LIST VIEW
        // ==========================================
        <div className="flex flex-col gap-6">

          {/* SEARCH, FILTERS & SUMMARY */}
          <div className="neo-card bg-[#ff9f68] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Search className="w-6 h-6 stroke-[3px]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="neo-input w-full md:w-80"
                placeholder="Search repo or PR title..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <span className="text-sm font-black uppercase">Filter Severity:</span>
              <div className="flex rounded-none overflow-hidden border-4 border-black">
                {['all', 'critical', 'warning', 'clean'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setFilterSeverity(sev)}
                    className={`px-4 py-2 font-bold uppercase text-xs transition-colors border-r-2 last:border-r-0 border-black cursor-pointer ${filterSeverity === sev ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'
                      }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* GRID LIST - PREPR CARD GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredPrs.map((pr, index) => {
              const style = getSeverityStyle(pr.summary.highest_severity);
              return (
                <div
                  key={index}
                  onClick={() => setSelectedPr(pr)}
                  className="neo-card bg-white hover:bg-[#fffdf5] cursor-pointer neo-shadow-hover flex flex-col justify-between min-h-[220px]"
                >
                  <div>
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <span className="font-mono-brutal text-sm font-bold bg-[#6fe7db] border-2 border-black px-2 py-0.5 shadow-[2px_2px_0px_rgba(0,0,0,1)] flex items-center gap-1.5">
                        <GitPullRequest className="w-4 h-4 stroke-[2.5px]" />
                        {pr.repo}#{pr.pr_number}
                      </span>

                      {/* Overall Severity Badge */}
                      <span className={`border-2 border-black px-3 py-1 font-bold text-xs uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] ${style.bg}`}>
                        {style.label}
                      </span>
                    </div>

                    <h2 className="text-xl md:text-2xl font-black leading-tight border-b-2 border-black pb-2 mt-2 select-none">
                      {pr.pr_title}
                    </h2>
                  </div>

                  <div className="flex justify-between items-center mt-4 pt-2">
                    <div className="text-sm font-bold text-gray-700">
                      Author: <span className="underline decoration-2">{pr.author}</span>
                    </div>
                    <div className="text-xs font-bold text-gray-500 font-mono-brutal">
                      {new Date(pr.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredPrs.length === 0 && (
              <div className="col-span-full neo-card bg-white border-dashed text-center py-12 flex flex-col items-center justify-center gap-3">
                <AlertTriangle className="w-12 h-12 stroke-[3px] text-[#ffc542]" />
                <p className="text-xl font-black uppercase">No Pull Request Reviews Found</p>
                <p className="text-sm text-gray-600 font-bold">Try adjusting your search criteria or triggering a live review!</p>
              </div>
            )}
          </div>
        </div>

      ) : (

        // ==========================================
        // VIEW 2: PR DETAIL VIEW
        // ==========================================
        <div className="flex flex-col gap-6">

          {/* TOP BAR / NAVIGATION */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => setSelectedPr(null)}
              className="neo-btn bg-white hover:bg-gray-100 py-2 px-5 text-sm flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5px]" />
              Back to Dashboard
            </button>
            <div className="font-mono-brutal text-sm font-black bg-[#ff9f68] border-4 border-black px-4 py-2 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
              REVIEW FOR {selectedPr.repo}#{selectedPr.pr_number}
            </div>
          </div>

          {/* PR OVERVIEW CARD */}
          <div className="neo-card bg-white border-4 border-black flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b-2 border-black">
              <div>
                <span className="text-xs font-black uppercase text-gray-600">Review Summary Target</span>
                <h2 className="text-2xl md:text-3xl font-black mt-1 uppercase leading-tight select-none">
                  {selectedPr.pr_title}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black uppercase">PR Severity:</span>
                <span className={`border-4 border-black px-4 py-2 font-black text-sm uppercase shadow-[4px_4px_0px_rgba(0,0,0,1)] ${getSeverityStyle(selectedPr.summary.highest_severity).bg}`}>
                  {getSeverityStyle(selectedPr.summary.highest_severity).label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-bold">
              <div className="bg-[#fcf8f2] border-2 border-black p-3">
                <div className="text-xs text-gray-500 uppercase">Author</div>
                <div className="text-base font-black mt-1">{selectedPr.author}</div>
              </div>
              <div className="bg-[#fcf8f2] border-2 border-black p-3">
                <div className="text-xs text-gray-500 uppercase">Total Findings</div>
                <div className="text-base font-black mt-1">{selectedPr.findings.length} issues</div>
              </div>
              <div className="bg-[#fcf8f2] border-2 border-black p-3">
                <div className="text-xs text-gray-500 uppercase">Target Repository</div>
                <div className="text-base font-black mt-1 font-mono-brutal">{selectedPr.repo}</div>
              </div>
              <div className="bg-[#fcf8f2] border-2 border-black p-3">
                <div className="text-xs text-gray-500 uppercase">Review Date</div>
                <div className="text-base font-black mt-1 font-mono-brutal">{new Date(selectedPr.date).toLocaleDateString()}</div>
              </div>
            </div>
          </div>

          {/* TWO PANEL DETAIL LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* LEFT COLUMN: 4 EXPANDABLE ACCORDIONS (Lg: 7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-6">

              {/* SECTION 1: SECURITY AGENT ACCORDION */}
              <div className="neo-card bg-[#fff] border-4 border-black p-0 overflow-hidden">
                <button
                  onClick={() => toggleSection('security')}
                  className="w-full bg-[#ff5e97] p-4 text-left font-black uppercase text-lg md:text-xl flex justify-between items-center border-b-4 border-black"
                >
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="w-6 h-6 stroke-[2.5px]" />
                    1. Security Agent Findings ({selectedPr.state.security_findings?.length || 0})
                  </span>
                  {expandedSection.security ? <ChevronUp className="w-6 h-6 stroke-[3px]" /> : <ChevronDown className="w-6 h-6 stroke-[3px]" />}
                </button>
                {expandedSection.security && (
                  <div className="p-4 flex flex-col gap-4 bg-white">
                    {selectedPr.state.security_findings?.length > 0 ? (
                      selectedPr.state.security_findings.map((f, i) => (
                        <div key={i} className="border-4 border-black p-4 bg-[#fffdf0] shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col gap-3">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-base uppercase bg-[#ff5e97] border-2 border-black px-2 py-0.5 text-xs">
                              {f.severity.toUpperCase()} : {f.issue_type}
                            </span>
                            {f.file && (
                              <span className="font-mono-brutal text-xs font-bold text-gray-600 bg-white border border-black px-1.5 py-0.5">
                                {f.file}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-gray-800">{f.description}</p>
                          {f.line_hint && (
                            <div className="bg-black text-white p-3 rounded-none overflow-x-auto text-xs font-mono-brutal border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                              <code>{f.line_hint}</code>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm font-bold text-green-700 bg-[#eefdf5] border-2 border-green-700 p-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        No Security vulnerabilities detected in this Pull Request.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 2: ARCHITECTURE AGENT ACCORDION */}
              <div className="neo-card bg-[#fff] border-4 border-black p-0 overflow-hidden">
                <button
                  onClick={() => toggleSection('architecture')}
                  className="w-full bg-[#ffc542] p-4 text-left font-black uppercase text-lg md:text-xl flex justify-between items-center border-b-4 border-black"
                >
                  <span className="flex items-center gap-2">
                    <Cpu className="w-6 h-6 stroke-[2.5px]" />
                    2. Architecture Agent Findings ({selectedPr.state.architecture_findings?.length || 0})
                  </span>
                  {expandedSection.architecture ? <ChevronUp className="w-6 h-6 stroke-[3px]" /> : <ChevronDown className="w-6 h-6 stroke-[3px]" />}
                </button>
                {expandedSection.architecture && (
                  <div className="p-4 flex flex-col gap-4 bg-white">
                    {selectedPr.state.architecture_findings?.length > 0 ? (
                      selectedPr.state.architecture_findings.map((f, i) => (
                        <div key={i} className="border-4 border-black p-4 bg-[#fffdf0] shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col gap-3">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-base uppercase bg-[#ffc542] border-2 border-black px-2 py-0.5 text-xs">
                              {f.severity.toUpperCase()} : {f.violation_type || "Violation"}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-gray-800">{f.description}</p>
                          {f.refactor_suggestion && (
                            <div className="border-l-4 border-black pl-3 py-1 bg-white font-sans text-sm font-bold italic text-gray-700">
                              <span className="font-black not-italic block uppercase text-xs text-black pb-0.5">💡 Refactor Suggestion:</span>
                              "{f.refactor_suggestion}"
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm font-bold text-green-700 bg-[#eefdf5] border-2 border-green-700 p-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        No architecture pattern violations detected in this Pull Request.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 3: TEST GAPS ACCORDION */}
              <div className="neo-card bg-[#fff] border-4 border-black p-0 overflow-hidden">
                <button
                  onClick={() => toggleSection('test_gaps')}
                  className="w-full bg-[#6fe7db] p-4 text-left font-black uppercase text-lg md:text-xl flex justify-between items-center border-b-4 border-black"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-6 h-6 stroke-[2.5px]" />
                    3. Test Gap Detector Alerts (Simulated)
                  </span>
                  {expandedSection.test_gaps ? <ChevronUp className="w-6 h-6 stroke-[3px]" /> : <ChevronDown className="w-6 h-6 stroke-[3px]" />}
                </button>
                {expandedSection.test_gaps && (
                  <div className="p-4 bg-white flex flex-col gap-4">
                    {/* Simulated validation logic matching our Phase 5 checklist criteria */}
                    {selectedPr.state.diff.includes("def ") && !selectedPr.state.diff.includes("test_") ? (
                      <div className="border-4 border-black p-4 bg-[#fffdf0] shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col gap-2">
                        <span className="font-black text-xs uppercase bg-[#ffc542] border-2 border-black px-2 py-0.5 w-max">
                          WARNING : TEST COVERAGE GAP
                        </span>
                        <p className="text-sm font-bold text-gray-800">
                          New functions/definitions were introduced, but no test modifications were found in the Pull Request diff.
                        </p>
                        <p className="text-xs text-gray-600 font-bold">
                          👉 Solution: Commit a corresponding test file (e.g. prefix <code>test_</code>) containing coverage for success, failure, and edge paths.
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-green-700 bg-[#eefdf5] border-2 border-green-700 p-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        PR contains satisfactory test modifications or lacks functional additions requiring testing.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 4: STYLISTIC CONSISTENCY ACCORDION */}
              <div className="neo-card bg-[#fff] border-4 border-black p-0 overflow-hidden">
                <button
                  onClick={() => toggleSection('consistency')}
                  className="w-full bg-[#ff9f68] p-4 text-left font-black uppercase text-lg md:text-xl flex justify-between items-center border-b-4 border-black"
                >
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-6 h-6 stroke-[2.5px]" />
                    4. Historical Consistency findings ({selectedPr.state.context_findings?.length || 0})
                  </span>
                  {expandedSection.consistency ? <ChevronUp className="w-6 h-6 stroke-[3px]" /> : <ChevronDown className="w-6 h-6 stroke-[3px]" />}
                </button>
                {expandedSection.consistency && (
                  <div className="p-4 flex flex-col gap-4 bg-white">
                    {selectedPr.state.context_findings?.length > 0 ? (
                      selectedPr.state.context_findings.map((f, i) => (
                        <div key={i} className="border-4 border-black p-4 bg-[#fffdf0] shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-base uppercase bg-[#ff9f68] border-2 border-black px-2 py-0.5 text-xs">
                              {f.severity.toUpperCase()} : {f.type}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-gray-800 mt-2">{f.description}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm font-bold text-green-700 bg-[#eefdf5] border-2 border-green-700 p-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        No stylistic deviations compared to the repository's historical codebase structure.
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT COLUMN: GITHUB COMMENT PREVIEW (Lg: 5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">

              <div className="neo-card bg-[#FFF37A] border-4 border-black p-0 overflow-hidden neo-shadow-lg">
                <div className="bg-black text-white p-4 font-black uppercase text-base flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <ExternalLink className="w-5 h-5 text-[#5dfdcb]" />
                    GitHub Comment Preview
                  </span>
                  <button
                    onClick={() => copyToClipboard(selectedPr.markdown)}
                    className="neo-btn bg-[#5dfdcb] hover:bg-[#2bfcaa] py-1 px-3 text-black text-xs uppercase"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Markdown
                  </button>
                </div>

                <div className="p-4 bg-white flex flex-col gap-4 border-t-4 border-black">
                  <div className="text-xs font-bold text-gray-600 bg-gray-100 border border-black p-2 mb-2 font-mono-brutal">
                    💡 This is the collapse-disclosed markdown commentary generated by the orchestrator and posted automatically to the GitHub Pull Request timeline.
                  </div>

                  {/* Rendered Markdown Box Mock */}
                  <div className="bg-[#fafafa] border-4 border-black p-4 neo-shadow shadow-[2px_2px_0px_rgba(0,0,0,1)] text-sm font-sans flex flex-col gap-4">
                    <h4 className="text-xl font-black border-b-2 border-black pb-1 m-0">🤖 SilentReviewer</h4>

                    {/* Security fold mock */}
                    {selectedPr.state.security_findings?.length > 0 && (
                      <div>
                        <div className="font-black text-red-600 uppercase text-xs pb-1 flex items-center gap-1">🔴 Security Findings</div>
                        {selectedPr.state.security_findings.map((f, i) => (
                          <details key={i} className="border border-black bg-white p-2 mb-2 group cursor-pointer">
                            <summary className="font-bold text-xs flex justify-between items-center select-none outline-none">
                              <span>⚠️ [CRITICAL] {f.issue_type} in <code className="bg-gray-100 px-1 border">{f.file}</code></span>
                            </summary>
                            <div className="mt-2 pt-2 border-t text-xs font-semibold text-gray-700 flex flex-col gap-2">
                              <p>{f.description}</p>
                              {f.line_hint && (
                                <pre className="bg-black text-white p-2 font-mono text-[10px] overflow-x-auto">
                                  {f.line_hint}
                                </pre>
                              )}
                            </div>
                          </details>
                        ))}
                      </div>
                    )}

                    {/* Architecture fold mock */}
                    {selectedPr.state.architecture_findings?.length > 0 && (
                      <div>
                        <div className="font-black text-[#cca300] uppercase text-xs pb-1 flex items-center gap-1">🟡 Architecture Findings</div>
                        {selectedPr.state.architecture_findings.map((f, i) => (
                          <details key={i} className="border border-black bg-white p-2 mb-2 group cursor-pointer">
                            <summary className="font-bold text-xs flex justify-between items-center select-none outline-none">
                              <span>📐 [WARNING] {f.violation_type || "Violation"}</span>
                            </summary>
                            <div className="mt-2 pt-2 border-t text-xs font-semibold text-gray-700 flex flex-col gap-2">
                              <p>{f.description}</p>
                              {f.refactor_suggestion && <p className="italic text-gray-600">💡 Refactor: {f.refactor_suggestion}</p>}
                            </div>
                          </details>
                        ))}
                      </div>
                    )}

                    {/* Clean banner mock */}
                    {selectedPr.findings.length === 0 && (
                      <div className="bg-[#eefdf5] border border-green-700 text-green-700 p-3 text-center font-bold text-xs">
                        🟢 No blocking issues found in this first-pass review!
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RAW MARKDOWN CODE BOX */}
              <div className="neo-card bg-[#fff] border-4 border-black p-0 overflow-hidden">
                <button
                  onClick={() => toggleSection('markdown')}
                  className="w-full bg-[#a6e3e9] p-4 text-left font-black uppercase text-sm md:text-base flex justify-between items-center border-b-4 border-black"
                >
                  <span>Raw Markdown Source</span>
                  {expandedSection.markdown ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {expandedSection.markdown && (
                  <div className="p-4 bg-black text-[#5dfdcb] font-mono-brutal text-xs overflow-x-auto max-h-[300px]">
                    <pre className="m-0 select-text whitespace-pre-wrap">{selectedPr.markdown}</pre>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ==========================================
          FOOTER BRANDING
         ========================================== */}
      <footer className="neo-card bg-black text-white text-center py-6 mt-auto">
        <p className="font-bold text-sm tracking-wide uppercase flex items-center justify-center gap-2">
          Designed with Stark Neubrutalism &bull; SilentReviewer AI Dashboard &bull; React &amp; Tailwind CSS
        </p>
      </footer>

    </div>
  );
}
