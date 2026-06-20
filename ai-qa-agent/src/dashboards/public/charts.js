'use strict';

const ERROR_BANNER = document.getElementById('error-banner');
const SESSIONS_TBODY = document.getElementById('sessions-tbody');
const DRILLDOWN_SECTION = document.getElementById('drilldown-section');
const DRILLDOWN_ID_SPAN = document.getElementById('drilldown-session-id');
const DRILLDOWN_CONTENT = document.getElementById('drilldown-content');
const FILTER_FORM = document.getElementById('dashboard-filters');
const FILTER_STATUS = document.getElementById('filter-status');
const FILTER_AGENT = document.getElementById('filter-agent');
const FILTER_TOOL = document.getElementById('filter-tool');
const FILTER_FROM = document.getElementById('filter-from');
const FILTER_TO = document.getElementById('filter-to');

function showError(message) {
  if (!ERROR_BANNER) return;
  ERROR_BANNER.textContent = message;
  ERROR_BANNER.classList.remove('hidden');
}

function buildQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'N/A';
}

function formatDuration(duration) {
  return duration === null ? 'N/A' : `${duration} ms`;
}

async function loadSessions(filters = {}) {
  try {
    const query = buildQuery(filters);
    const url = query ? `/api/dashboard/sessions?${query}` : '/api/dashboard/sessions';
    const sessions = await fetchJSON(url);
    if (!SESSIONS_TBODY) return;
    SESSIONS_TBODY.innerHTML = '';
    if (!sessions.length) {
      SESSIONS_TBODY.innerHTML = '<tr><td colspan="5">No sessions found.</td></tr>';
      return;
    }

    for (const s of sessions) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.sessionId}</td>
        <td>${s.status}</td>
        <td>${formatDate(s.startedAt)}</td>
        <td>${formatDuration(s.duration)}</td>
        <td>${s.status === 'completed' ? '✅ completed' : s.status === 'failed' ? '❌ failed' : '⏳ in progress'}</td>
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

async function showDrilldown(sessionId) {
  if (!DRILLDOWN_SECTION || !DRILLDOWN_ID_SPAN || !DRILLDOWN_CONTENT) return;
  DRILLDOWN_ID_SPAN.textContent = sessionId;
  DRILLDOWN_SECTION.classList.remove('hidden');
  DRILLDOWN_CONTENT.innerHTML = '<p>Loading…</p>';

  try {
    const logs = await fetchJSON(`/api/dashboard/session/${sessionId}/logs`);
    const rows = logs.map((entry) => `
      <tr>
        <td>${formatDate(entry.timestamp)}</td>
        <td>${entry.agent}</td>
        <td>${entry.tool}</td>
        <td>${entry.status}</td>
        <td>${entry.latency}</td>
        <td>${entry.tokens}</td>
        <td>${entry.cost.toFixed(6)}</td>
        <td>${Array.isArray(entry.errors) ? entry.errors.join('; ') : ''}</td>
      </tr>
    `).join('');

    DRILLDOWN_CONTENT.innerHTML = `
      <div class="drilldown-actions">
        <button id="export-session-csv">Export CSV</button>
      </div>
      <table aria-label="Session log details">
        <thead>
          <tr>
            <th>Date</th>
            <th>Agent</th>
            <th>Tool</th>
            <th>Status</th>
            <th>Latency</th>
            <th>Tokens</th>
            <th>Cost</th>
            <th>Errors</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    document.getElementById('export-session-csv')?.addEventListener('click', () => {
      exportCsv(sessionId, logs);
    });
  } catch (err) {
    showError(`Could not load session detail for ${sessionId}: ${err.message}`);
    DRILLDOWN_CONTENT.innerHTML = '<p>Failed to load session details.</p>';
  }
}

function exportCsv(sessionId, rows) {
  const header = ['timestamp', 'agent', 'tool', 'status', 'latency', 'tokens', 'cost', 'errors'];
  const csvRows = [header.join(',')];

  for (const row of rows) {
    const errors = Array.isArray(row.errors) ? row.errors.join('; ') : '';
    const values = [
      JSON.stringify(row.timestamp),
      JSON.stringify(row.agent),
      JSON.stringify(row.tool),
      JSON.stringify(row.status),
      row.latency,
      row.tokens,
      row.cost,
      JSON.stringify(errors),
    ];
    csvRows.push(values.join(','));
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `session-${sessionId}-logs.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildChartData(logs) {
  const labels = logs.map((entry) => new Date(entry.timestamp).toLocaleDateString());
  const groupedByStatus = logs.reduce((acc, entry) => {
    acc[entry.status] = (acc[entry.status] || 0) + 1;
    return acc;
  }, {});

  return {
    labels,
    latency: logs.map((entry) => entry.latency),
    tokens: logs.map((entry) => entry.tokens),
    cost: logs.map((entry) => entry.cost),
    success: groupedByStatus.success ?? 0,
    error: groupedByStatus.error ?? 0,
  };
}

async function loadCharts(filters = {}) {
  try {
    const query = buildQuery(filters);
    const url = query ? `/api/dashboard/metrics?${query}` : '/api/dashboard/metrics';
    const logs = await fetchJSON(url);
    const data = buildChartData(logs);

    const chartSuccess = document.getElementById('chart-success-failure');
    const chartLatency = document.getElementById('chart-latency');
    const chartTokens = document.getElementById('chart-tokens');

    if (chartSuccess && window.Chart) {
      new Chart(chartSuccess, {
        type: 'doughnut',
        data: {
          labels: ['Success', 'Error'],
          datasets: [{
            data: [data.success, data.error],
            backgroundColor: ['#198754', '#dc3545'],
          }],
        },
      });
    }

    if (chartLatency && window.Chart) {
      new Chart(chartLatency, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [
            {
              label: 'Latency (ms)',
              data: data.latency,
              borderColor: '#4d8bfd',
              backgroundColor: 'rgba(77, 139, 253, 0.2)',
              fill: true,
            },
            {
              label: 'Cost',
              data: data.cost,
              borderColor: '#fd7e14',
              backgroundColor: 'rgba(253, 126, 20, 0.2)',
              fill: true,
            },
          ],
        },
        options: { responsive: true },
      });
    }

    if (chartTokens && window.Chart) {
      new Chart(chartTokens, {
        type: 'bar',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Tokens',
            data: data.tokens,
            backgroundColor: '#0dcaf0',
          }],
        },
        options: { responsive: true },
      });
    }
  } catch (err) {
    showError(`Could not load metric data: ${err.message}`);
  }
}

function serializeFilters() {
  return {
    status: FILTER_STATUS?.value,
    agent: FILTER_AGENT?.value,
    tool: FILTER_TOOL?.value,
    from: FILTER_FROM?.value,
    to: FILTER_TO?.value,
  };
}

function onFilterSubmit(event) {
  event.preventDefault();
  const filters = serializeFilters();
  void loadSessions(filters);
  void loadCharts(filters);
}

if (FILTER_FORM) {
  FILTER_FORM.addEventListener('submit', onFilterSubmit);
}

window.addEventListener('DOMContentLoaded', () => {
  void loadSessions();
  void loadCharts();
});
