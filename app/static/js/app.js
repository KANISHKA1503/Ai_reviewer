/**
 * Code Review Console — Client logic
 * Clean, structured tab switcher, live filters, and text-only detail modals.
 */

// ── State variables ──
let reviews = [];
let stats = {};
let events = [];
let searchQuery = "";
let statusFilter = "all";
let pollTimer = null;
const POLL_INTERVAL = 8000;

// ── DOM Ready initialization ──
document.addEventListener("DOMContentLoaded", () => {
  init();
});

async function init() {
  setupNavigation();
  setupFilters();
  await Promise.all([fetchStats(), fetchReviews(), fetchEvents()]);
  startPolling();
  setupFormHandler();
}

// ── Multi-Navigation Tab Switcher ──
function setupNavigation() {
  const navBar = document.getElementById("nav-bar");
  if (!navBar) return;

  navBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-btn");
    if (!btn) return;

    // Remove active styling from all buttons
    navBar.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    // Highlight active button
    btn.classList.add("active");

    const tabId = btn.dataset.tab;
    
    // Hide all view panes
    document.querySelectorAll(".view-pane").forEach((pane) => {
      pane.classList.add("hidden");
    });

    // Reveal target view pane
    const targetPane = document.getElementById(`view-${tabId}`);
    if (targetPane) {
      targetPane.classList.remove("hidden");
    }
  });

  // Expose switchTab globally so links can switch tabs easily
  window.switchTab = function (tabId) {
    const targetBtn = navBar.querySelector(`[data-tab="${tabId}"]`);
    if (targetBtn) {
      targetBtn.click();
    }
  };
}

// ── Background Polling ──
function startPolling() {
  pollTimer = setInterval(async () => {
    await Promise.all([fetchStats(), fetchReviews(), fetchEvents()]);
  }, POLL_INTERVAL);
}

// ── API Fetch Handlers ──
async function fetchStats() {
  try {
    const resp = await fetch("/api/stats");
    if (!resp.ok) throw new Error("Failed to fetch stats");
    stats = await resp.json();
    renderStats();
  } catch (err) {
    console.error("Stats fetch error:", err);
  }
}

async function fetchReviews() {
  try {
    const resp = await fetch("/api/reviews?limit=30");
    if (!resp.ok) throw new Error("Failed to fetch reviews");
    const newReviews = await resp.json();

    // Detect newly completed reviews for user alerts
    if (reviews.length > 0) {
      for (const nr of newReviews) {
        const prev = reviews.find((r) => r.id === nr.id);
        if (prev && prev.status === "analyzing" && nr.status === "complete") {
          showToast(`Review complete: ${nr.repo_full_name}#${nr.pr_number} — Score: ${nr.score}/100`);
        }
        if (prev && prev.status !== "error" && nr.status === "error") {
          showToast(`Review failed for ${nr.repo_full_name}#${nr.pr_number}`, "error");
        }
      }
    }

    reviews = newReviews;
    renderReviews();
    renderDashboardSnapshot();
  } catch (err) {
    console.error("Reviews fetch error:", err);
  }
}

async function fetchEvents() {
  try {
    const resp = await fetch("/api/events");
    if (!resp.ok) throw new Error("Failed to fetch events");
    events = await resp.json();
    renderActivity();
  } catch (err) {
    console.error("Events fetch error:", err);
  }
}

// ── Interactive Filters & Real-time Live Search ──
function setupFilters() {
  const searchInput = document.getElementById("search-input");
  const clearBtn = document.getElementById("clear-search");
  const filterPills = document.getElementById("filter-pills");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      if (clearBtn) {
        clearBtn.style.display = searchQuery ? "block" : "none";
      }
      renderReviews();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
        searchQuery = "";
        clearBtn.style.display = "none";
        renderReviews();
      }
    });
  }

  if (filterPills) {
    filterPills.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter-pill");
      if (!btn) return;

      // Highlight active pill styling
      filterPills.querySelectorAll(".filter-pill").forEach((pill) => {
        pill.classList.remove("active");
      });
      btn.classList.add("active");

      statusFilter = btn.dataset.filter;
      renderReviews();
    });
  }
}

// ── Rendering: Aggregate Statistics Counters ──
function renderStats() {
  animateValue("stat-total-reviews", stats.total_reviews || 0);
  animateValue("stat-total-findings", stats.total_findings || 0);
  animateValue("stat-high-quality", stats.high_quality_prs || 0);
  animateValue("stat-avg-score", stats.avg_score || 0);
}

function animateValue(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const current = parseInt(el.textContent) || 0;
  if (current === target) return;

  const duration = 400;
  const steps = 15;
  const increment = (target - current) / steps;
  let step = 0;

  const timer = setInterval(() => {
    step++;
    const val = Math.round(current + increment * step);
    el.textContent = step === steps ? target : val;
    if (step >= steps) clearInterval(timer);
  }, duration / steps);
}

// ── Rendering: Dashboard Quick Snapshot Reviews Table ──
function renderDashboardSnapshot() {
  const tbody = document.getElementById("dashboard-tbody");
  if (!tbody) return;

  if (reviews.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <div class="empty-title">No reviews found</div>
            <div class="empty-desc">Submit a PR URL via the launcher to trigger your first review.</div>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = reviews
    .slice(0, 5)
    .map((r) => {
      const statusBadge = getStatusBadge(r.status);
      const scoreHtml = getScoreHtml(r.score, r.status);
      const timeAgo = formatTimeAgo(r.created_at);

      return `
      <tr onclick="openDetail(${r.id})" title="Inspect review report">
        <td class="pr-title-cell">
          <div class="pr-title-link">${escapeHtml(r.pr_title || `PR #${r.pr_number}`)}</div>
          <div class="pr-repo">${escapeHtml(r.repo_full_name)}</div>
        </td>
        <td><strong>${escapeHtml(r.pr_author || "—")}</strong></td>
        <td>${statusBadge}</td>
        <td>${scoreHtml}</td>
        <td><span class="timestamp">${timeAgo}</span></td>
      </tr>`;
    })
    .join("");
}

// ── Rendering: Full Reviews Console Database Table ──
function renderReviews() {
  const tbody = document.getElementById("reviews-tbody");
  if (!tbody) return;

  if (reviews.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-title">No reviews found</div>
            <div class="empty-desc">No entries recorded in console.</div>
          </div>
        </td>
      </tr>`;
    return;
  }

  // Snappy client-side live filtering
  const filtered = reviews.filter((r) => {
    // 1. Status pill filter
    if (statusFilter !== "all" && r.status !== statusFilter) {
      return false;
    }
    // 2. Search box input filter
    if (searchQuery) {
      const title = (r.pr_title || "").toLowerCase();
      const repo = (r.repo_full_name || "").toLowerCase();
      const author = (r.pr_author || "").toLowerCase();
      const prNum = String(r.pr_number || "");
      if (
        !title.includes(searchQuery) &&
        !repo.includes(searchQuery) &&
        !author.includes(searchQuery) &&
        !prNum.includes(searchQuery)
      ) {
        return false;
      }
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-title">No matching reviews</div>
            <div class="empty-desc">Try modifying your search query or status filter.</div>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((r) => {
      const statusBadge = getStatusBadge(r.status);
      const scoreHtml = getScoreHtml(r.score, r.status);
      const findingsHtml = getFindingsHtml(r.total_findings, r.status);
      const timeAgo = formatTimeAgo(r.created_at);

      return `
      <tr onclick="openDetail(${r.id})" title="Inspect review report">
        <td class="pr-title-cell">
          <div class="pr-title-link">${escapeHtml(r.pr_title || `PR #${r.pr_number}`)}</div>
          <div class="pr-repo">${escapeHtml(r.repo_full_name)}</div>
        </td>
        <td><strong>${escapeHtml(r.pr_author || "—")}</strong></td>
        <td>${statusBadge}</td>
        <td>${scoreHtml}</td>
        <td>${findingsHtml}</td>
        <td><span class="timestamp">${timeAgo}</span></td>
      </tr>`;
    })
    .join("");
}

function getStatusBadge(status) {
  const map = {
    pending: '<span class="badge badge-pending">Pending</span>',
    analyzing: '<span class="badge badge-analyzing">Analyzing</span>',
    complete: '<span class="badge badge-complete">Complete</span>',
    error: '<span class="badge badge-error">Error</span>',
  };
  return map[status] || `<span class="badge badge-pending">${status}</span>`;
}

function getScoreHtml(score, status) {
  if (status !== "complete" || score === null || score === undefined) return "—";
  let cls = "score-high";
  if (score < 70) cls = "score-low";
  else if (score < 85) cls = "score-medium";
  return `<span class="score ${cls}">${score}/100</span>`;
}

function getFindingsHtml(count, status) {
  if (status !== "complete") return "—";
  if (count === 0) {
    return '<span class="findings-count clean">Clean</span>';
  }
  return `<span class="findings-count has-issues">${count} findings</span>`;
}

// ── Rendering: Telemetry Log Feed ──
function renderActivity() {
  const feed = document.getElementById("activity-feed");
  if (!feed) return;

  if (events.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">Console Silent</div>
        <div class="empty-desc">Webhook telemetry events will appear here in real-time.</div>
      </div>`;
    return;
  }

  feed.innerHTML = events
    .map((e) => {
      const isError = e.event_type.includes("error") || e.event_type.includes("failed");
      const label = isError ? "[ERROR]" : "[INFO]";
      const iconClass = isError ? "error" : "";
      return `
      <div class="activity-item">
        <div class="activity-icon ${iconClass}">${label}</div>
        <div class="activity-content">
          <div class="activity-text">
            <strong>${escapeHtml(e.event_type)}</strong> — ${escapeHtml(e.payload_summary || "No description payload")}
          </div>
          <div class="activity-time">${formatTimeAgo(e.received_at)}</div>
        </div>
      </div>`;
    })
    .join("");
}

// ── Interactive Detail Modal ──
async function openDetail(reviewId) {
  const overlay = document.getElementById("detail-overlay");
  try {
    const resp = await fetch(`/api/reviews/${reviewId}`);
    if (!resp.ok) throw new Error("Review entry not found");
    const review = await resp.json();
    renderDetailModal(review);
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  } catch (err) {
    showToast("Failed to fetch detailed review metrics", "error");
  }
}

function closeDetail() {
  const overlay = document.getElementById("detail-overlay");
  if (overlay) {
    overlay.classList.remove("active");
  }
  document.body.style.overflow = "";
}

function renderDetailModal(review) {
  const modal = document.getElementById("detail-modal-content");
  if (!modal) return;

  const scoreClass =
    review.score >= 85 ? "high" : review.score >= 70 ? "medium" : "low";

  let findings = review.findings || [];
  if (typeof findings === "string") {
    try {
      findings = JSON.parse(findings);
    } catch {
      findings = [];
    }
  }

  // Parse markdown summaries into sleek developer HTML blocks
  let summaryHtml = "";
  if (review.summary) {
    summaryHtml = formatMarkdownSummary(review.summary);
  }

  const findingsHtml =
    findings.length === 0
      ? `<div class="empty-state">
           <div class="empty-title">All Clean</div>
           <div class="empty-desc">No issues were identified in this pull request changeset.</div>
         </div>`
      : `<div class="findings-list">
           ${findings
             .map(
               (f) => `
             <div class="finding-card severity-${f.severity}">
               <div class="finding-header">
                 <span class="finding-severity ${f.severity}">${f.severity}</span>
                 <span class="finding-category">${formatCategory(f.category)}</span>
                 <span class="finding-location">${escapeHtml(f.file)}:${f.line}</span>
               </div>
               <div class="finding-title">${escapeHtml(f.title)}</div>
               <div class="finding-message">${escapeHtml(f.message)}</div>
               ${
                 f.suggestion
                   ? `
                 <div class="finding-suggestion">
                   <div class="suggestion-header">Suggested Refactoring</div>
                   <div class="suggestion-content">${escapeHtml(f.suggestion)}</div>
                 </div>`
                   : ""
               }
             </div>`
             )
             .join("")}
         </div>`;

  modal.innerHTML = `
    <div class="detail-header">
      <h2>${escapeHtml(review.pr_title || `PR #${review.pr_number}`)}</h2>
      <button class="close-btn" onclick="closeDetail()" title="Close (Esc)">✕</button>
    </div>
    <div class="detail-body">
      <div class="modal-grid">
        <!-- Left Sidebar: Metadata Card -->
        <div class="modal-sidebar">
          <div class="sidebar-gauge-card">
            <div class="score-box-flat ${scoreClass}">
              <span>${review.score !== null ? review.score : "—"}</span><span style="font-size: 0.8rem; color: var(--text-muted);">/100</span>
            </div>
            <div class="gauge-label">Quality Score</div>
          </div>
          
          <div class="sidebar-meta-list">
            <div class="sidebar-meta-item">
              <span class="sidebar-meta-label">Repository</span>
              <span class="sidebar-meta-value mono" title="${escapeHtml(review.repo_full_name)}">${escapeHtml(review.repo_full_name)}</span>
            </div>
            <div class="sidebar-meta-item">
              <span class="sidebar-meta-label">Author</span>
              <span class="sidebar-meta-value" title="${escapeHtml(review.pr_author)}">${escapeHtml(review.pr_author || "—")}</span>
            </div>
            <div class="sidebar-meta-item">
              <span class="sidebar-meta-label">Files Checked</span>
              <span class="sidebar-meta-value">${review.files_analyzed || 0}</span>
            </div>
            <div class="sidebar-meta-item">
              <span class="sidebar-meta-label">Findings</span>
              <span class="sidebar-meta-value">${review.total_findings || 0}</span>
            </div>
            <div class="sidebar-meta-item">
              <span class="sidebar-meta-label">Platform</span>
              <span class="sidebar-meta-value" style="text-transform: uppercase;">${escapeHtml(review.platform || "github")}</span>
            </div>
          </div>
          
          ${
            review.pr_url
              ? `
            <div class="sidebar-platform-link">
              <a href="${escapeHtml(review.pr_url)}" target="_blank" rel="noopener" class="btn-secondary">
                <span>View on ${review.platform === "gitlab" ? "GitLab" : "GitHub"} ↗</span>
              </a>
            </div>`
              : ""
          }
        </div>

        <!-- Right Content Area: Detailed report -->
        <div class="modal-content-area">
          ${
            summaryHtml
              ? `
            <div class="modal-section-title">Summary</div>
            <div class="ai-summary-block">${summaryHtml}</div>
          `
              : ""
          }
          
          <div class="modal-section-title">Findings</div>
          ${findingsHtml}
        </div>
      </div>
    </div>`;
}

// Helper: Secure regex-based markdown renderer
function formatMarkdownSummary(text) {
  if (!text) return "";
  let html = escapeHtml(text);

  // Translate code backticks
  html = html.replace(
    /`([^`]+)`/g,
    '<code style="font-family: var(--font-mono); background: rgba(255,255,255,0.06); padding: 2px 4px; border-radius: 4px; font-size: 0.74rem; color: var(--text-accent);">$1</code>'
  );

  // Translate bold items
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Iterate line by line to support nested outlines
  html = html
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        return `<li style="margin-left: 14px; margin-bottom: 4px; color: var(--text-secondary); list-style-type: square;">${trimmed.substring(
          2
        )}</li>`;
      }
      if (trimmed.startsWith("### ")) {
        return `<h4 style="font-family: var(--font-sans); font-size: 0.82rem; font-weight: 600; color: #ffffff; margin: 12px 0 6px 0;">${trimmed.substring(
          4
        )}</h4>`;
      }
      if (trimmed.startsWith("## ")) {
        return `<h4 style="font-family: var(--font-sans); font-size: 0.88rem; font-weight: 600; color: #ffffff; margin: 14px 0 6px 0; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 4px;">${trimmed.substring(
          3
        )}</h4>`;
      }
      if (trimmed) {
        return `<p style="margin-bottom: 8px; color: var(--text-secondary);">${trimmed}</p>`;
      }
      return "";
    })
    .join("");

  // Clean bullet tags
  html = html.replace(/(<li.*?>.*?<\/li>)/g, '<ul style="margin: 6px 0; padding-left: 8px;">$1</ul>');
  html = html.replace(/<\/ul>\s*<ul style="margin: 6px 0; padding-left: 8px;">/g, "");

  return html;
}

// ── Manual Submission Action Form ──
function setupFormHandler() {
  const form = document.getElementById("review-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("pr-url-input");
    const btn = document.getElementById("submit-btn");
    const prUrl = input.value.trim();

    if (!prUrl) return;

    btn.classList.add("loading");
    btn.disabled = true;

    try {
      const resp = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pr_url: prUrl }),
      });

      const data = await resp.json();

      if (resp.ok) {
        showToast(`Review triggered for ${prUrl}`);
        input.value = "";
        await Promise.all([fetchStats(), fetchReviews()]);
      } else {
        showToast(`${data.error || "Failed to trigger review script"}`);
      }
    } catch (err) {
      showToast("Connection error — is the server running?");
    } finally {
      btn.classList.remove("loading");
      btn.disabled = false;
    }
  });
}

// ── Toast Banner Alerts ──
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  // Slide-out and remove timer
  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// ── General Utility Helpers ──
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatCategory(cat) {
  return (cat || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimeAgo(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// ── Click modal backdrop to exit overlay ──
document.addEventListener("click", (e) => {
  if (e.target.id === "detail-overlay") {
    closeDetail();
  }
});

// ── Key press Esc to exit overlay ──
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDetail();
  }
});
