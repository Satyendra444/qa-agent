CREATE TABLE IF NOT EXISTS sessions (
    session_id      TEXT PRIMARY KEY,
    status          TEXT NOT NULL
                        CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    requirement     TEXT NOT NULL,
    current_agent   TEXT,
    outputs         JSONB,
    errors          JSONB,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- ── Agent logs ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_logs (
    id              BIGSERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL,
    session_id      TEXT        NOT NULL REFERENCES sessions (session_id),
    agent           TEXT        NOT NULL,
    tool            TEXT        NOT NULL,
    input           JSONB,
    output          JSONB,
    latency         INTEGER     NOT NULL,   -- milliseconds
    status          TEXT        NOT NULL,
    tokens          INTEGER     NOT NULL DEFAULT 0,
    cost            NUMERIC(18,6) NOT NULL DEFAULT 0,
    errors          JSONB
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_session_id ON agent_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent      ON agent_logs (agent);
CREATE INDEX IF NOT EXISTS idx_agent_logs_tool       ON agent_logs (tool);
CREATE INDEX IF NOT EXISTS idx_agent_logs_timestamp  ON agent_logs (timestamp);

-- ── Evaluation reports ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evaluation_reports (
    session_id      TEXT PRIMARY KEY REFERENCES sessions (session_id),
    metrics         JSONB       NOT NULL,
    hallucinations  JSONB       NOT NULL,
    recommendations JSONB       NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL
);

-- ── Execution results ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS execution_results (
    session_id          TEXT    NOT NULL REFERENCES sessions (session_id),
    test_id             TEXT    NOT NULL,
    status              TEXT    NOT NULL
                            CHECK (status IN ('passed', 'failed', 'skipped')),
    duration_ms         INTEGER NOT NULL,
    error_message       TEXT,
    failure_category    TEXT,
    artifact_paths      JSONB,
    PRIMARY KEY (session_id, test_id)
);

CREATE INDEX IF NOT EXISTS idx_execution_results_session_id
    ON execution_results (session_id);
