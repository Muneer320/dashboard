import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

const DEFAULT_BACKEND_URL = 'https://ascent.scaler.com';
const DEFAULT_PROCESSOR_URL = 'http://127.0.0.1:8765';
const STORAGE_KEYS = {
  backendUrl: 'mirageOps.backendUrl',
};

function formatDurationMs(value) {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms) || ms <= 0) return '0 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds >= 10 ? 1 : 2)} s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds - (minutes * 60);
  return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}

function normalizeBackendUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/$/, '');
  if (!trimmed) return DEFAULT_BACKEND_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(trimmed)) return `http://${trimmed}`;
  return `https://${trimmed}`;
}

function formatCountdown(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function loadStoredState() {
  return {
    backendUrl: normalizeBackendUrl(localStorage.getItem(STORAGE_KEYS.backendUrl) || DEFAULT_BACKEND_URL),
  };
}

function getProcessorBaseUrl() {
  if (typeof window === 'undefined') return '';
  const { hostname, port, protocol } = window.location;
  if ((hostname === '127.0.0.1' || hostname === 'localhost') && port === '4175') {
    return hostname === 'localhost' ? DEFAULT_PROCESSOR_URL : `${protocol}//${hostname}:8765`;
  }
  if (port === '8765') {
    return `${protocol}//${window.location.host}`;
  }
  return '';
}

function useMirageOps() {
  const [state, setState] = useState(loadStoredState);
  const [connectionHealth, setConnectionHealth] = useState({ text: 'checking backend', kind: 'pending' });
  const [processorHealth, setProcessorHealth] = useState({ text: 'checking', kind: 'pending' });
  const [processorSnapshot, setProcessorSnapshot] = useState(null);
  const [authStatus, setAuthStatus] = useState('Checking saved local connection...');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.backendUrl, state.backendUrl);
  }, [state.backendUrl]);

  function logClientRequest(kind, label, durationMs, extra = {}) {
    const entry = {
      kind,
      label,
      durationMs: Number(durationMs.toFixed(2)),
      at: new Date().toISOString(),
      ...extra,
    };
    const existing = Array.isArray(window.__mirageOpsRequestTimings) ? window.__mirageOpsRequestTimings : [];
    window.__mirageOpsRequestTimings = [...existing.slice(-39), entry];
    console.info('[MirageOps timing]', entry);
  }

  async function backendRequest(path, options = {}) {
    const backendUrl = normalizeBackendUrl(options.backendUrl || state.backendUrl);
    const processorBaseUrl = getProcessorBaseUrl();
    const startedAt = performance.now();
    const response = await fetch(`${processorBaseUrl}/dashboard/api/backend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        backendUrl,
        method: options.method || 'GET',
        path,
        headers: options.headers || {},
        body: options.body ?? null,
      }),
    });
    logClientRequest('backend', `${options.method || 'GET'} ${path}`, performance.now() - startedAt, { status: response.status });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { detail: text };
    }

    if (!response.ok) {
      throw new Error(data?.detail || data?.message || `HTTP ${response.status}`);
    }
    return data;
  }

  async function processorRequest(path, options = {}) {
    const processorBaseUrl = getProcessorBaseUrl();
    const startedAt = performance.now();
    const response = await fetch(`${processorBaseUrl}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    logClientRequest('processor', `${options.method || 'GET'} ${path}`, performance.now() - startedAt, { status: response.status });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { detail: text };
    }

    if (!response.ok) {
      throw new Error(data?.detail || data?.message || `HTTP ${response.status}`);
    }
    return data;
  }

  async function refreshProcessorHealth() {
    try {
      const processorBaseUrl = getProcessorBaseUrl();
      const response = await fetch(`${processorBaseUrl}/health`);
      const data = await response.json();
      const running = Boolean(data.runState?.running);
      const databaseConnected = Boolean(
        data.backendDatabaseConnected ?? data.databaseConnected,
      );
      setProcessorHealth({
        text: running
          ? `processor busy | ${data.runState?.kind || 'job'}`
          : `processor online | ${data.modelVersion} | ${databaseConnected ? 'db online' : 'db offline'}`,
        kind: running ? 'processing' : (databaseConnected ? 'ok' : 'failed'),
      });
      setProcessorSnapshot(data);
      return data;
    } catch {
      setProcessorHealth({ text: 'processor offline', kind: 'failed' });
      setProcessorSnapshot(null);
      return null;
    }
  }

  async function refreshConnectionHealth() {
    try {
      await backendRequest('/api/v1/admin-panel/mirage/jobs');
      setConnectionHealth({ text: 'online | db connected', kind: 'ok' });
      setAuthStatus('Connected. Mirage Ops is ready.');
      return true;
    } catch (error) {
      setConnectionHealth({ text: `backend issue | ${error.message}`, kind: 'failed' });
      setAuthStatus(error.message);
      return false;
    }
  }

  async function connectSavedLogin() {
    setAuthStatus('Checking local processor connection...');
    try {
      return await refreshConnectionHealth();
    } catch (error) {
      setConnectionHealth({ text: `backend issue | ${error.message}`, kind: 'failed' });
      setAuthStatus(error.message);
      return false;
    }
  }

  function forgetSavedLogin() {
    setConnectionHealth({ text: 'auto-login is configured in local env', kind: 'pending' });
    setAuthStatus('Local auto-login comes from the processor environment, not browser storage.');
  }

  return {
    state,
    setState,
    connectionHealth,
    processorHealth,
    processorSnapshot,
    authStatus,
    setAuthStatus,
    backendRequest,
    processorRequest,
    refreshProcessorHealth,
    refreshConnectionHealth,
    connectSavedLogin,
    forgetSavedLogin,
  };
}

function pillClass(kind) {
  return `pill ${kind || ''}`.trim();
}

function AppShell({ ops, children }) {
  const location = useLocation();

  useEffect(() => {
    ops.refreshProcessorHealth();
    ops.connectSavedLogin();
    const id = window.setInterval(() => {
      ops.refreshProcessorHealth();
      ops.refreshConnectionHealth();
    }, 8000);
    return () => window.clearInterval(id);
  }, [ops.state.backendUrl]);

  return (
    <>
      <header className="topbar">
        <Link className="brand" to="/">Mirage Ops</Link>
        <nav>
          <NavLink className={location.pathname === '/' ? 'active' : ''} to="/">Connect</NavLink>
          <NavLink className={location.pathname === '/users' ? 'active' : ''} to="/users">Users</NavLink>
          <NavLink className={location.pathname === '/jobs' ? 'active' : ''} to="/jobs">Jobs</NavLink>
          <NavLink className={location.pathname === '/create' ? 'active' : ''} to="/create">Create Job</NavLink>
        </nav>
        <div className="status-pills">
          <span className={pillClass(ops.connectionHealth.kind)}>{ops.connectionHealth.text}</span>
          <span className={pillClass(ops.processorHealth.kind)}>{ops.processorHealth.text}</span>
        </div>
      </header>
      <main className={location.pathname === '/job' ? 'shell' : 'shell narrow'}>{children}</main>
    </>
  );
}

function ConnectPage({ ops }) {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Local-only mapping control</p>
        <h1>Manage Mirage mappings without touching the live user dashboard.</h1>
        <p>This tool runs on your machine, talks to the deployed Ascent backend, and starts GPU inference on the local processor.</p>
      </section>

      <section className="card stack">
        <h2>Ascent connection status</h2>
        <label>
          Backend URL
          <input
            value={ops.state.backendUrl}
            onChange={(event) => ops.setState((current) => ({ ...current, backendUrl: normalizeBackendUrl(event.target.value) }))}
            onBlur={() => ops.connectSavedLogin()}
            placeholder={DEFAULT_BACKEND_URL}
          />
        </label>
        <div className="row">
          <button onClick={() => ops.forgetSavedLogin()}>Forget saved login</button>
          <Link className="button" to="/jobs">Open jobs</Link>
        </div>
        <p className="muted">Mirage Ops reconnects automatically using the saved backend URL and saved local admin login on this machine.</p>
        <div className="status">{ops.authStatus}</div>
      </section>
    </>
  );
}

function JobsPage({ ops }) {
  const [jobs, setJobs] = useState([]);
  const [status, setStatus] = useState('Loading jobs...');

  async function loadJobs() {
    setStatus('Loading jobs...');
    try {
      const data = await ops.backendRequest('/api/v1/admin-panel/mirage/jobs');
      setJobs(data);
      setStatus('Jobs loaded.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  useEffect(() => {
    loadJobs();
  }, []);

  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">Available mapping jobs</p>
        <h1>Run, approve, and publish Mirage jobs.</h1>
        <p>Jobs are loaded from the configured Ascent backend database.</p>
        <div className="row">
          <button onClick={loadJobs}>Refresh jobs</button>
          <Link className="button primary" to="/create">Create new job</Link>
        </div>
        <div className="status">{status}</div>
      </section>

      <section className="card stack">
        <div className="row spread">
          <h2>Jobs</h2>
          <span className="pill">{jobs.length} jobs</span>
        </div>
        <div className="user-verify-list">
          {jobs.length === 0 ? (
            <p className="muted">No jobs yet. Create one from the Create Job page.</p>
          ) : jobs.map((job) => (
            <article className="job-card" key={job.jobId}>
              <div className="row spread">
                <strong>{job.eventNameSnapshot || 'Mirage job'}</strong>
                <span className={pillClass(job.status)}>{job.status}</span>
              </div>
              <p className="muted">
                {job.dayLabel || 'Day'} | {job.imageCount || 0} images | {job.positivePairCount || 0} positives | {job.pendingPairCount || 0} pending pairs
              </p>
              <div className="row">
                <Link className="button primary" to={`/job/${encodeURIComponent(job.jobId)}`}>Open</Link>
                <Link className="button" to={`/job/${encodeURIComponent(job.jobId)}?focus=new-users`}>Map new users</Link>
                <a className="button" href={job.driveFolderUrl || '#'} target="_blank" rel="noreferrer">Drive</a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function UsersPage({ ops }) {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('Loading pending anchor verifications...');
  const [busyUserId, setBusyUserId] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const autoAnchor = ops.processorSnapshot?.autoAnchor || null;
  const autoAnchorCompletedAt = autoAnchor?.lastCompletedAt || null;
  const autoAnchorRunning = ops.processorSnapshot?.runState?.kind === 'auto-anchors' && ops.processorSnapshot?.runState?.running;

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  async function loadUsers() {
    setStatus('Loading pending anchor verifications...');
    try {
      const data = await ops.backendRequest('/api/v1/admin-panel/mirage/users?pending_only=true');
      setUsers(data);
      setStatus(data.length ? 'Pending users loaded.' : 'No pending anchor verifications right now.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (!autoAnchorCompletedAt || busyUserId) return;
    loadUsers();
  }, [autoAnchorCompletedAt]);

  async function verifyPendingAnchors(userId = null) {
    setBusyUserId(userId || '__all__');
    setStatus(userId ? 'Verifying this user\'s pending anchors on the local pipeline...' : 'Verifying all pending anchors on the local pipeline...');
    try {
      const data = await ops.processorRequest('/anchors/process', {
        method: 'POST',
        body: {
          anchorLimit: 20,
          retryRejectedAnchors: true,
          userId,
        },
      });
      await ops.refreshProcessorHealth();
      await loadUsers();
      const anchors = data?.anchors || {};
      setStatus(`Verification complete: ${anchors.processed || 0} processed, ${anchors.approved || 0} approved, ${anchors.rejected || 0} rejected.`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusyUserId(null);
    }
  }

  const nextRunAtMs = Number(autoAnchor?.nextRunAt || 0) * 1000;
  const countdownSeconds = nextRunAtMs > 0 ? Math.max(0, Math.ceil((nextRunAtMs - nowMs) / 1000)) : null;
  const countdownLabel = countdownSeconds == null ? '--:--' : formatCountdown(countdownSeconds);
  const autoAnchorStatus = autoAnchorRunning
    ? 'Auto batch is running now.'
    : autoAnchor?.lastSkippedReason === 'busy'
      ? 'Next auto batch was deferred because the processor was busy.'
      : 'Next full auto batch countdown.';

  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">User verification queue</p>
        <h1>Verify pending anchor images before they join Mirage mappings.</h1>
        <p>Uploaded anchor images are already stored in S3 and the main Mirage database. This queue runs the local verification pipeline so approved anchors become ready for matching.</p>
        <p className="muted">Auto-verification also sweeps all pending anchor users every 10 seconds while this local processor and dashboard are open.</p>
        <p className="muted">Next batch in <strong>{countdownLabel}</strong>. {autoAnchorStatus}</p>
        <div className="row">
          <button className="good" disabled={Boolean(busyUserId)} onClick={() => verifyPendingAnchors(null)}>Verify all pending anchors</button>
          <button onClick={loadUsers}>Refresh queue</button>
        </div>
        <div className="status">{status}</div>
      </section>

      <section className="card stack">
        <div className="row spread">
          <h2>Pending users</h2>
          <span className="pill">{users.length} users</span>
        </div>
        <div className="user-verify-list">
          {users.length === 0 ? (
            <p className="muted">No users are waiting for anchor verification.</p>
          ) : users.map((user) => {
            const queuedCount = Number(user.pendingAnchorCount || 0) + Number(user.processingAnchorCount || 0);
            return (
            <article className="user-verify-card" key={user.userId}>
              <div className="user-verify-preview">
                {user.images?.[0]?.previewUrl ? (
                  <img
                    src={user.images[0].previewUrl}
                    loading="lazy"
                    alt={user.images[0].filename || 'anchor'}
                  />
                ) : (
                  <div className="user-verify-empty">No preview</div>
                )}
              </div>

              <div className="user-verify-main">
                <div className="user-verify-header">
                  <div className="user-verify-head">
                    <strong>{user.name || user.username || user.userId}</strong>
                    <p className="muted">
                      @{user.username || 'unknown'}
                    </p>
                    <p className="muted">
                      {user.totalActiveImageCount || 0} anchors uploaded
                    </p>
                  </div>
                  <span className={pillClass(user.readyForMapping ? 'approved' : user.enrollmentStatus)}>{user.readyForMapping ? 'ready' : (user.enrollmentStatus || 'draft')}</span>
                </div>

                <div className="user-verify-stats">
                  <div className="user-stat">
                    <strong>{user.approvedAnchorCount || 0}/{user.requiredAnchorCount || 6}</strong>
                    <span>Approved</span>
                  </div>
                  <div className="user-stat">
                    <strong>{user.pendingAnchorCount || 0}</strong>
                    <span>Pending</span>
                  </div>
                  <div className="user-stat">
                    <strong>{user.processingAnchorCount || 0}</strong>
                    <span>Processing</span>
                  </div>
                  <div className="user-stat">
                    <strong>{user.rejectedAnchorCount || 0}</strong>
                    <span>Rejected</span>
                  </div>
                </div>

                <p className="muted user-verify-summary">
                  Showing 1 of {user.totalActiveImageCount || 0} anchors. Remaining images stay attached to this user for the same verification run.
                </p>
              </div>

              <div className="user-verify-actions">
                <button
                  className="primary user-verify-button"
                  disabled={Boolean(busyUserId) || queuedCount === 0}
                  onClick={() => verifyPendingAnchors(user.userId)}
                >
                  {queuedCount > 0 ? `Verify queued (${queuedCount})` : 'No queued anchors'}
                </button>
                <span className="muted user-verify-note">
                  {user.images?.[0]?.poseLabel || 'Anchor preview'} | {user.images?.[0]?.status || 'pending'}
                </span>
              </div>
            </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

function CreatePage({ ops }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    dayLabel: 'Day 1',
    eventName: '',
    driveFolderUrl: '',
    driveImageUrls: '',
    recursive: false,
  });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function createJob() {
    setBusy(true);
    setStatus('Creating job in main database...');
    const driveImageUrls = form.driveImageUrls
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    try {
      const job = await ops.backendRequest('/api/v1/admin-panel/mirage/jobs', {
        method: 'POST',
        body: {
          dayLabel: form.dayLabel.trim() || 'Day 1',
          eventId: null,
          eventNameSnapshot: form.eventName.trim() || null,
          driveFolderUrl: form.driveFolderUrl.trim(),
          driveImageUrls,
          recursive: form.recursive,
          matchingMode: 'high_precision',
          forceRecheck: false,
          onlyPending: true,
          userScope: 'all',
          imageScope: 'all',
        },
      });
      setStatus('Job created. Opening job detail...');
      navigate(`/job/${encodeURIComponent(job.jobId)}`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">New mapping job</p>
        <h1>Create a Drive-powered Mirage inference job.</h1>
        <p>The job manifest is saved in the main database. Processing still happens locally on your GPU.</p>
      </section>

      <section className="card stack">
        <div className="grid-2">
          <label>
            Day label
            <input value={form.dayLabel} onChange={(event) => setForm((current) => ({ ...current, dayLabel: event.target.value }))} />
          </label>
          <label>
            Event name snapshot
            <input value={form.eventName} onChange={(event) => setForm((current) => ({ ...current, eventName: event.target.value }))} placeholder="Anvil hackathon" />
          </label>
        </div>
        <label>
          Public Google Drive folder URL
          <input value={form.driveFolderUrl} onChange={(event) => setForm((current) => ({ ...current, driveFolderUrl: event.target.value }))} placeholder="https://drive.google.com/drive/folders/..." />
        </label>
        <label>
          Optional direct Drive image links or file IDs
          <textarea value={form.driveImageUrls} onChange={(event) => setForm((current) => ({ ...current, driveImageUrls: event.target.value }))} placeholder="One image link, direct download URL, or raw Drive file ID per line" />
        </label>
        <label className="inline-check">
          <input checked={form.recursive} onChange={(event) => setForm((current) => ({ ...current, recursive: event.target.checked }))} type="checkbox" />
          Recursive folder scan
        </label>
        <div className="row">
          <button className="primary" disabled={busy} onClick={createJob}>Create job in main DB</button>
          <Link className="button" to="/jobs">Back to jobs</Link>
        </div>
        <div className="status">{status}</div>
      </section>
    </>
  );
}

function JobPage({ ops }) {
  const { jobId } = useParams();
  const [detail, setDetail] = useState(null);
  const [verifiedUsers, setVerifiedUsers] = useState([]);
  const [currentRun, setCurrentRun] = useState(null);
  const [status, setStatus] = useState('Loading job...');
  const [busy, setBusy] = useState(false);
  const [jobMissing, setJobMissing] = useState(false);

  function isMissingJobError(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('mirage job not found') ||
      message.includes('job not found') ||
      message.includes('http 404') ||
      message === 'not found'
    );
  }

  async function loadVerifiedUsers({ silent = false } = {}) {
    try {
      const usersData = await ops.backendRequest('/api/v1/admin-panel/mirage/users?pending_only=false');
      setVerifiedUsers(Array.isArray(usersData) ? usersData : []);
      if (!silent) {
        setStatus('Job loaded.');
      }
    } catch (error) {
      if (!silent) {
        setStatus(error.message);
      }
    }
  }

  async function loadJob({ silent = false } = {}) {
    if (!jobId) return;
    try {
      const jobData = await ops.processorRequest(`/jobs/${encodeURIComponent(jobId)}/detail`);
      setDetail(jobData);
      setJobMissing(false);
      if (!silent) {
        setStatus('Job loaded.');
      }
    } catch (error) {
      if (isMissingJobError(error)) {
        setJobMissing(true);
        setDetail(null);
        setBusy(false);
        setStatus('This Mirage job no longer exists. Open another job from the Jobs page.');
        return;
      }
      setStatus(error.message);
    }
  }

  async function refreshLiveProgress() {
    if (!jobId || jobMissing) return;
    try {
      const runState = await ops.processorRequest('/runs/current');
      setCurrentRun(runState);
      await ops.refreshProcessorHealth();
      await ops.refreshConnectionHealth();
      await loadJob({ silent: true });

      const isCurrentJobRun = Boolean(runState?.running) && runState?.jobId === jobId;
      setBusy(isCurrentJobRun);

      if (isCurrentJobRun) {
        setStatus(runState?.message || 'Local GPU is processing...');
        return;
      }

      const completedCurrentJob =
        !runState?.running &&
        runState?.jobId === jobId &&
        runState?.lastResult?.jobId === jobId;

      if (completedCurrentJob) {
        if (runState?.lastError) {
          setStatus(runState.lastError);
          return;
        }
        if (runState?.kind === 'optimize-assets') {
          const result = runState?.lastResult || {};
          setStatus(
            `Optimization complete: ${result.optimized || 0} optimized, ${result.failed || 0} failed, ${result.rehydrated || 0} rehydrated.`,
          );
          return;
        }
        const stats = runState?.lastResult?.stats || {};
        setStatus(`Completed: ${stats.images || 0} images, ${stats.pairs || 0} pairs, ${stats.positive || 0} positives.`);
      }
    } catch {
      // Keep the last known UI state when background polling fails once.
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      await Promise.all([
        loadJob(),
        loadVerifiedUsers({ silent: true }),
      ]);
      if (!cancelled) {
        await refreshLiveProgress();
      }
    }

    bootstrap();

    const detailPollId = window.setInterval(() => {
      if (!cancelled && !jobMissing) {
        refreshLiveProgress();
      }
    }, 3000);

    const usersPollId = window.setInterval(() => {
      if (!cancelled) {
        loadVerifiedUsers({ silent: true });
      }
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(detailPollId);
      window.clearInterval(usersPollId);
    };
  }, [jobId, jobMissing]);

  async function jobAction(label, path, method = 'POST') {
    setBusy(true);
    setStatus(`${label}...`);
    try {
      await ops.backendRequest(path, { method });
      setStatus(`${label} complete.`);
      await loadJob();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function localJobAction(label, path, method = 'POST') {
    setBusy(true);
    setStatus(`${label}...`);
    try {
      await ops.processorRequest(path, { method });
      setStatus(`${label} complete.`);
      await refreshLiveProgress();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function startJobRun(mode = 'full') {
    if (!jobId) return;
    setBusy(true);
    setStatus(mode === 'new-users'
      ? 'Mapping only newly added users on the local GPU. Existing approved mappings stay untouched.'
      : 'Local GPU started. Progress will keep updating here while images and mappings upload.');
    try {
      const data = await ops.processorRequest(`/jobs/${encodeURIComponent(jobId)}/start`, {
        method: 'POST',
        body: {
          batchSize: 50,
          anchorLimit: 20,
          retryRejectedAnchors: true,
        },
      });
      setStatus(data.runState?.message || 'Local GPU is processing...');
      await refreshLiveProgress();
    } catch (error) {
      setStatus(error.message);
      setBusy(false);
      return;
    }
  }

  async function startAssetOptimization(retryFailedOnly = false) {
    if (!jobId) return;
    setBusy(true);
    setStatus(
      retryFailedOnly
        ? 'Retrying failed image optimizations on this machine.'
        : 'Downloading, optimizing, and uploading job images to S3 on this machine.',
    );
    try {
      const data = await ops.processorRequest(`/jobs/${encodeURIComponent(jobId)}/optimize-assets`, {
        method: 'POST',
        body: {
          batchSize: 30,
          retryFailedOnly,
        },
      });
      setStatus(data.runState?.message || 'Optimizing job images...');
      await refreshLiveProgress();
    } catch (error) {
      setStatus(error.message);
      setBusy(false);
    }
  }

  const images = detail?.images || [];
  const imageTotal = Number(detail?.imageCount || 0);
  const imagePct = imageTotal ? Math.round((Number(detail?.processedImageCount || 0) / imageTotal) * 100) : 0;
  const optimizedImageCount = Number(detail?.optimizedImageCount || 0);
  const failedOptimizedImageCount = Number(detail?.failedOptimizedImageCount || 0);
  const assetProgressDone = optimizedImageCount + failedOptimizedImageCount;
  const assetPct = imageTotal ? Math.round((assetProgressDone / imageTotal) * 100) : 0;
  const assetOptimizationComplete = imageTotal > 0 && assetProgressDone >= imageTotal;
  const fallbackVerifiedUsers = verifiedUsers.filter((user) =>
    Boolean(user?.consentEnabled) && Number(user?.approvedAnchorCount || 0) > 0,
  );
  const totalVerifiedUsers = Math.max(
    Number(detail?.totalVerifiedUserCount || 0),
    fallbackVerifiedUsers.length,
  );
  const rawPendingPairCount = Number(detail?.pendingPairCount || 0);
  const rawPositivePairCount = Number(detail?.positivePairCount || 0);
  const rawNegativePairCount = Number(detail?.negativePairCount || 0);
  const rawFailedPairCount = Number(detail?.failedPairCount || 0);
  const hasKnownPairProgress = rawPendingPairCount + rawPositivePairCount + rawNegativePairCount + rawFailedPairCount > 0;
  const effectivePendingPairCount =
    !hasKnownPairProgress && imageTotal > 0 && totalVerifiedUsers > 0
      ? imageTotal * totalVerifiedUsers
      : rawPendingPairCount;
  const pairTotal = effectivePendingPairCount + rawPositivePairCount + rawNegativePairCount + rawFailedPairCount;
  const pairDone = rawPositivePairCount + rawNegativePairCount + rawFailedPairCount;
  const pairPct = pairTotal ? Math.round((pairDone / pairTotal) * 100) : 0;
  const processedVerifiedUsers = Number(detail?.processedVerifiedUserCount || 0);
  const verifiedUsersPct = totalVerifiedUsers ? Math.round((processedVerifiedUsers / totalVerifiedUsers) * 100) : 0;
  const imageProcessedCount = Number(detail?.processedImageCount || 0);
  const assetReadyForInference = assetOptimizationComplete && optimizedImageCount > 0;
  const showAssetProgress = !assetOptimizationComplete || ['discovering', 'downloading', 'optimizing', 'uploading'].includes(detail?.assetState || 'idle');
  const currentRunProgress = currentRun?.progress || null;
  const timingSnapshot = currentRun?.timings || null;
  const timingStages = timingSnapshot?.stages ? Object.entries(timingSnapshot.stages) : [];
  const currentRunStage = currentRunProgress?.stage || null;
  const currentRunMatchesJob = currentRun?.jobId === jobId;
  const currentRunIsActive = Boolean(currentRun?.running) && currentRunMatchesJob;
  let overallProgressPct;
  let overallProgressLabel;
  let overallProgressCaption;

  if (currentRunIsActive && currentRunStage && currentRunStage !== 'mapping') {
    overallProgressPct = Number(currentRunProgress?.percent || 0);
    overallProgressLabel = `${Number(currentRunProgress?.current || 0)}/${Number(currentRunProgress?.total || 0)} ${currentRunStage}`;
    overallProgressCaption = `${String(currentRunStage).replace('-', ' ')} progress`;
  } else if (currentRunIsActive) {
    overallProgressPct = pairTotal > 0 ? pairPct : imagePct;
    overallProgressLabel = pairTotal > 0
      ? `${pairDone}/${pairTotal} user-image pairs processed`
      : `${imageProcessedCount}/${imageTotal} images processed`;
    overallProgressCaption = 'Mapping progress';
  } else {
    const progressMode = showAssetProgress ? 'assets' : (pairTotal > 0 ? 'pairs' : 'images');
    overallProgressPct = progressMode === 'assets' ? assetPct : (progressMode === 'pairs' ? pairPct : imagePct);
    overallProgressLabel = progressMode === 'assets'
      ? `${assetProgressDone}/${imageTotal} optimized images ready or failed`
      : progressMode === 'pairs'
        ? `${pairDone}/${pairTotal} user-image pairs processed`
        : `${imageProcessedCount}/${imageTotal} images processed`;
    overallProgressCaption = progressMode === 'assets'
      ? 'Asset optimization progress'
      : progressMode === 'pairs'
        ? 'Mappings progress'
        : 'Image processing';
  }

  if (jobMissing) {
    return (
      <section className="card stack">
        <div className="row spread">
          <div>
            <p className="eyebrow">Job detail</p>
            <h1>Mirage job not found</h1>
            <p className="muted">Job ID: {jobId}</p>
          </div>
          <span className="pill failed">missing</span>
        </div>
        <p className="muted">
          This page is pointing at a stale or deleted Mirage job. Open a current job from the Jobs page or create a new one.
        </p>
        <div className="row">
          <Link className="button primary" to="/jobs">Open jobs</Link>
          <Link className="button" to="/create">Create new job</Link>
        </div>
        <div className="status">{status}</div>
        {timingSnapshot ? (
          <div className="stack">
            <div className="row spread">
              <small>Measured latency</small>
              <small>Total: {formatDurationMs(timingSnapshot.runElapsedMs)}</small>
            </div>
            <div className="metric-grid">
              {timingStages.length === 0 ? (
                <div className="metric">
                  <strong>{formatDurationMs(timingSnapshot.runElapsedMs)}</strong>
                  <span>Run total</span>
                </div>
              ) : timingStages.map(([stageName, stageValue]) => (
                <div className="metric" key={stageName}>
                  <strong>{formatDurationMs(stageValue.elapsedMs)}</strong>
                  <span>{String(stageName).replace(/-/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <>
      <section className="card stack">
        <div className="row spread">
          <div>
            <p className="eyebrow">Job detail</p>
            <h1>{detail?.eventNameSnapshot || 'Loading job...'}</h1>
            <p className="muted">{detail ? `${detail.dayLabel || 'Day'} | ${detail.imageCount || 0} images | ${detail.matchingMode || 'high_precision'}` : ''}</p>
          </div>
          <div className="row">
            <span className={pillClass(detail?.galleryVisibility || detail?.status)}>{detail?.galleryVisibility || detail?.status || 'loading'}</span>
            <span className={pillClass(detail?.assetState)}>{detail?.assetState || 'idle'}</span>
            <span className={pillClass(detail?.batchState)}>{detail?.batchState || 'idle'}</span>
          </div>
        </div>

        <div className="metric-grid">
          <div className="metric"><strong>{detail?.imageCount || 0}</strong><span>Images</span></div>
          <div className="metric"><strong>{optimizedImageCount}</strong><span>Optimized</span></div>
          <div className="metric"><strong>{detail?.processedImageCount || 0}</strong><span>Processed</span></div>
          <div className="metric"><strong>{processedVerifiedUsers}/{totalVerifiedUsers}</strong><span>Verified users mapped</span></div>
          <div className="metric"><strong>{rawPositivePairCount}</strong><span>Positive mappings</span></div>
          <div className="metric"><strong>{effectivePendingPairCount}</strong><span>Pending pairs</span></div>
        </div>

        <div className="stack">
          <div className="row spread"><small>{overallProgressCaption}</small><small>{overallProgressLabel}</small></div>
          <div className="bar"><span style={{ width: `${overallProgressPct}%` }} /></div>
        </div>

        <div className="row">
          <button className="good" disabled={busy} onClick={() => startAssetOptimization(false)}>Optimize images</button>
          <button disabled={busy || failedOptimizedImageCount === 0} onClick={() => startAssetOptimization(true)}>Retry failed optimizations</button>
          <button
            className="good"
            disabled={busy || !assetReadyForInference}
            onClick={() => startJobRun('full')}
          >
            {assetReadyForInference ? 'Run local GPU + upload mappings' : 'Optimize images before mapping'}
          </button>
          <button
            className="primary"
            disabled={busy || !assetReadyForInference || effectivePendingPairCount === 0}
            onClick={() => startJobRun('new-users')}
          >
            {effectivePendingPairCount > 0 ? `Map newly added users (${effectivePendingPairCount} pending pairs)` : 'No new user mappings pending'}
          </button>
          <button
            disabled={busy || detail?.batchState === 'published' || (detail?.galleryVisibility || detail?.status) === 'live'}
            onClick={() => localJobAction('Approve', `/jobs/${encodeURIComponent(jobId)}/approve`)}
          >
            Approve job
          </button>
          <button
            className="primary"
            disabled={busy || detail?.batchState !== 'published' || (detail?.galleryVisibility || detail?.status) === 'live'}
            onClick={() => localJobAction('Publish', `/jobs/${encodeURIComponent(jobId)}/publish`)}
          >
            Publish live
          </button>
          <button
            disabled={busy || (detail?.galleryVisibility || detail?.status) !== 'live'}
            onClick={() => localJobAction('Unpublish', `/jobs/${encodeURIComponent(jobId)}/unpublish`)}
          >
            Unpublish
          </button>
          <button className="danger" disabled={busy} onClick={() => {
            if (window.confirm('Delete this Mirage job and all mappings?')) {
              localJobAction('Delete', `/jobs/${encodeURIComponent(jobId)}`, 'DELETE');
            }
          }}>Delete job</button>
          <Link className="button" to="/jobs">Back</Link>
        </div>
        <div className="status">{status}</div>
      </section>

      <section className="card stack">
        <div className="row spread">
          <h2>Images and mappings</h2>
          <span className="pill">{images.length} images</span>
        </div>
        <div className="image-grid">
          {images.length === 0 ? (
            <p className="muted">No images loaded.</p>
          ) : images.slice(0, 120).map((image) => {
            const previewUrl = image.previewUrl || image.url;
            const imageUrl = previewUrl?.startsWith('/api/') ? `${ops.state.backendUrl}${previewUrl}` : previewUrl;
            return (
              <article className="image-card" key={image.imageId || image.filename}>
                {imageUrl ? <img src={imageUrl} loading="lazy" alt={image.filename || 'image'} /> : null}
                <div>
                  <strong>{image.filename || 'image'}</strong>
                  <p className="muted">
                    {(image.assetStatus || 'pending')} assets | {(image.status || 'pending')} mapping | {image.mappedUserCount || 0} mapped users
                  </p>
                  {image.assetError ? <p className="muted">{image.assetError}</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

export default function App() {
  const ops = useMirageOps();
  const appShell = useMemo(() => (children) => <AppShell ops={ops}>{children}</AppShell>, [ops]);

  return appShell(
    <Routes>
      <Route path="/" element={<ConnectPage ops={ops} />} />
      <Route path="/users" element={<UsersPage ops={ops} />} />
      <Route path="/jobs" element={<JobsPage ops={ops} />} />
      <Route path="/create" element={<CreatePage ops={ops} />} />
      <Route path="/job/:jobId" element={<JobPage ops={ops} />} />
    </Routes>,
  );
}
