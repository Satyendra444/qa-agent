

'use strict';

const ERROR_BANNER = document.getElementById('error-banner');
const SESSIONS_TBODY = document.getElementById('sessions-tbody');
const DRILLDOWN_SECTION = document.getElementById('drilldown-section');
const DRILLDOWN_ID_SPAN = document.getElementById('drilldown-session-id');
const DRILLDOWN_CONTENT = document.getElementById('drilldown-content');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function showError(message) {
  if (!ERROR_BANNER) return;
  ERROR_BANNER.textContent = message;
  ERROR_BANNER.classList.remove('hidden');
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Session list (Requirement 13.1)
// ---------------------------------------------------------------------------

async function loadSessions() {
  try {
    const sessions = await fetchJSON('/api/dashboard/sessions');
    if (!SESSIONS_TBODY) return;
    SESSIONS_TBODY.innerHTML = '';
    if (!sessions.length) {
      SESSIONS_TBODY.innerHTML = '<tr><td colspan="5">No sessions yet.</td></tr>';
      return;
    }
    for (const s of sessions) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.sessionId}</td>
        <td>${s.status}</td>
        <td>${s.startedAt}</td>
        <td>${s.duration ?? 'N/A'}</td>
        <td>${s.status === 'completed' ? '✅ passed' : s.status === 'failed' ? '❌ failed' : '—'}</td>
      `;
      tr.addEventListener('click', () => showDrilldown(s.sessionId));
      SESSIONS_TBODY.appendChild(tr);
    }
  } catch (err) {
    showError(`Could not load session list: ${err.message}`);
    if (SESSIONS_TBODY) {
      SESSIONS_TBODY.innerHTML = '<tr><td colspan="5">Failed to load sessions.</td></tr>';
    }
  }
}

// ---------------------------------------------------------------------------
// Drill-down (Requirements 13.2, 13.3)
// ---------------------------------------------------------------------------

async function showDrilldown(sessionId) {
  if (!DRILLDOWN_SECTION || !DRILLDOWN_ID_SPAN || !DRILLDOWN_CONTENT) return;
  DRILLDOWN_ID_SPAN.textContent = sessionId;
  DRILLDOWN_SECTION.classList.remove('hidden');
  DRILLDOWN_CONTENT.innerHTML = '<p>Loading…</p>';

  try {
    const session = await fetchJSON(`/api/sessions/${sessionId}`);
    // TODO (task 30.2): render chronological agent actions, tool calls, latency, eval scores
    DRILLDOWN_CONTENT.innerHTML = `<pre>${JSON.stringify(session, null, 2)}</pre>`;
  } catch (err) {
    showError(`Could not load session detail for ${sessionId}: ${err.message}`);
    DRILLDOWN_CONTENT.innerHTML = '<p>Failed to load session details.</p>';
  }
}

// ---------------------------------------------------------------------------
// Charts (Requirements 13.5, 13.6, 13.7)
// ---------------------------------------------------------------------------

async function loadCharts() {
  try {
    const metrics = await fetchJSON('/api/dashboard/metrics');

    // TODO (task 30.2): implement Chart.js rendering using metrics data
    // Placeholder: log to console until task 30.2 is implemented
    console.info('[dashboard] Metrics loaded — chart rendering pending task 30.2', metrics);
  } catch (err) {
    showError(`Could not load metric data: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  void loadSessions();
  void loadCharts();
});
