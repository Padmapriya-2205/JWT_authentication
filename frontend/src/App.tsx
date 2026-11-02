import { useState } from 'react';
import { ApiError, getProfile, login, logout, refreshSession, register } from './api';
import type { AuthResponse, User } from './types';

type AuthMode = 'login' | 'signup';
type DashboardTab = 'profile' | 'session';

interface JwtDisplayClaims {
  sub?: string;
  role?: string;
  tokenType?: string;
  exp?: number;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function getJwtDisplayClaims(token: string): JwtDisplayClaims | null {
  const encodedPayload = token.split('.')[1];
  if (!encodedPayload) return null;

  try {
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as unknown;
    if (typeof payload !== 'object' || payload === null) return null;

    const claims = payload as Record<string, unknown>;
    return {
      ...(typeof claims.sub === 'string' ? { sub: claims.sub } : {}),
      ...(typeof claims.role === 'string' ? { role: claims.role } : {}),
      ...(typeof claims.tokenType === 'string' ? { tokenType: claims.tokenType } : {}),
      ...(typeof claims.exp === 'number' ? { exp: claims.exp } : {}),
    };
  } catch {
    return null;
  }
}

function App() {
  const [session, setSession] = useState<AuthResponse | null>(null);

  if (session) {
    return <Dashboard session={session} onSessionChange={setSession} />;
  }

  return <AuthPage onAuthenticated={setSession} />;
}

function AuthPage({ onAuthenticated }: { onAuthenticated: (session: AuthResponse) => void }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);

    try {
      if (mode === 'signup') {
        const result = await register({ username, password, name, phoneNumber });
        setNotice(result.message);
        setMode('login');
        setPassword('');
      } else {
        const result = await login(username, password);
        onAuthenticated(result);
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
    setNotice('');
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="brand-mark" aria-hidden="true">A</div>
        <p className="eyebrow">AUTHENTICATION PLAYGROUND</p>
        <h1 id="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="subtitle">
          {mode === 'login'
            ? 'Sign in to explore your secure session.'
            : 'A few details and you’re ready to sign in.'}
        </p>

        <div className="mode-switch" role="tablist" aria-label="Authentication">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => changeMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => changeMode('signup')}
          >
            Sign up
          </button>
        </div>

        {notice && <div className="notice" role="status">{notice}</div>}
        {error && <div className="error-message" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <label>
                Full name
                <input
                  autoComplete="name"
                  maxLength={80}
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                />
              </label>
              <label>
                Phone number
                <input
                  autoComplete="tel"
                  maxLength={20}
                  required
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="+1 555 123 4567"
                />
              </label>
            </>
          )}
          <label>
            Username
            <input
              autoComplete="username"
              maxLength={30}
              minLength={3}
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. alex.morgan"
            />
          </label>
          <label>
            Password
            <input
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              maxLength={72}
              minLength={mode === 'signup' ? 8 : 1}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
            />
          </label>
          <button className="primary-button submit-button" disabled={busy} type="submit">
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in securely' : 'Create account'}
          </button>
        </form>

        <p className="form-footnote">
          {mode === 'login' ? 'New to AuthLab?' : 'Already have an account?'}{' '}
          <button
            className="text-button"
            onClick={() => changeMode(mode === 'login' ? 'signup' : 'login')}
            type="button"
          >
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
        <div className="security-note">
          <span className="lock-icon" aria-hidden="true">⌑</span>
          Passwords are securely hashed. Your role is assigned by the server.
        </div>
      </section>
      <p className="page-caption">A simple, transparent look at how authentication works.</p>
    </main>
  );
}

function Dashboard({
  session,
  onSessionChange,
}: {
  session: AuthResponse;
  onSessionChange: (session: AuthResponse | null) => void;
}) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('session');
  const [profile, setProfile] = useState<User | null>(null);
  const [message, setMessage] = useState('You are signed in successfully.');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<string[]>([
    'Login succeeded. The API returned an access token and a refresh token.',
  ]);

  function recordActivity(detail: string) {
    setActivity((current) => [`${new Date().toLocaleTimeString()} — ${detail}`, ...current].slice(0, 12));
  }

  async function verifySession() {
    setError('');
    setBusy(true);
    recordActivity('Sending GET /api/auth/me with the access token in the Authorization: Bearer header.');
    try {
      setProfile(await getProfile(session.accessToken));
      setMessage('Your access token is valid. The protected profile loaded successfully.');
      recordActivity('GET /api/auth/me succeeded. The API returned the public profile.');
    } catch (profileError) {
      if (!(profileError instanceof ApiError) || profileError.status !== 401) {
        recordActivity('GET /api/auth/me failed before refresh; inspect the displayed error.');
        setError(getErrorMessage(profileError));
        return;
      }
      recordActivity('GET /api/auth/me returned 401. Sending POST /api/auth/refresh with the refresh token in the JSON body.');
      let refreshed: AuthResponse;
      try {
        refreshed = await refreshSession(session.refreshToken);
      } catch (refreshError) {
        recordActivity('Refresh failed. The UI cleared the session; sign in again.');
        setError(`${getErrorMessage(profileError)} ${getErrorMessage(refreshError)}`);
        onSessionChange(null);
        return;
      }

      onSessionChange(refreshed);
      recordActivity('Refresh succeeded. Retrying GET /api/auth/me with the new access token.');
      try {
        const refreshedProfile = await getProfile(refreshed.accessToken);
        setProfile(refreshedProfile);
        setMessage('Access token renewed and the protected profile loaded successfully.');
        recordActivity('GET /api/auth/me succeeded with the new access token. The API returned the public profile.');
      } catch (retryError) {
        recordActivity('The retry of GET /api/auth/me failed; the renewed session remains available.');
        setError(getErrorMessage(retryError));
      }
    } finally {
      setBusy(false);
    }
  }

  function openProfileTab() {
    setActiveTab('profile');
    void verifySession();
  }

  async function renewSession() {
    setError('');
    setBusy(true);
    recordActivity('Manual refresh: sending POST /api/auth/refresh with the current refresh token in the JSON body.');
    try {
      const refreshed = await refreshSession(session.refreshToken);
      onSessionChange(refreshed);
      setMessage('Session refreshed. The previous refresh token has been rotated.');
      recordActivity('Refresh succeeded. The backend replaced the stored refresh-token hash; the UI now holds the new pair.');
    } catch (refreshError) {
      recordActivity('Refresh failed. The refresh token may be expired, invalid, or already used.');
      setError(getErrorMessage(refreshError));
      onSessionChange(null);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setError('');
    setBusy(true);
    recordActivity('Sending POST /api/auth/logout with the refresh token in the JSON body.');
    try {
      await logout(session.refreshToken);
      recordActivity('Sign-out succeeded. The backend removed the stored refresh-token hash.');
      onSessionChange(null);
    } catch (logoutError) {
      recordActivity('Sign-out request failed; the session remains active.');
      setError(getErrorMessage(logoutError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="AuthLab home">
          <span className="brand-mark small" aria-hidden="true">A</span>
          AuthLab
        </a>
        <span className="topbar-label"><span className="status-dot" /> SESSION ACTIVE</span>
      </header>

      <section className="dashboard-content">
        <div className="success-banner">
          <span className="success-icon" aria-hidden="true">✓</span>
          <div>
            <p className="eyebrow">AUTHENTICATION COMPLETE</p>
            <h1>Signed in successfully</h1>
            <p>{message}</p>
          </div>
        </div>

        <div className="dashboard-tabs" role="tablist" aria-label="Session dashboard">
          <button
            type="button"
            role="tab"
            id="profile-tab"
            aria-selected={activeTab === 'profile'}
            aria-controls="profile-panel"
            className={activeTab === 'profile' ? 'active' : ''}
            disabled={busy}
            onClick={openProfileTab}
          >
            Get profile
          </button>
          <button
            type="button"
            role="tab"
            id="session-tab"
            aria-selected={activeTab === 'session'}
            aria-controls="session-panel"
            className={activeTab === 'session' ? 'active' : ''}
            disabled={busy}
            onClick={() => setActiveTab('session')}
          >
            Tokens &amp; refresh
          </button>
        </div>

        {error && <div className="error-message dashboard-error" role="alert">{error}</div>}

        {activeTab === 'profile' ? (
          <section className="panel profile-panel" id="profile-panel" role="tabpanel" aria-labelledby="profile-tab">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">ACCESS-TOKEN PROTECTED ENDPOINT</p>
                <h2>Profile from the API</h2>
              </div>
              {profile && <span className="role-pill">{profile.role}</span>}
            </div>
            <p className="token-disclaimer">
              Selecting this tab calls <code>GET /api/auth/me</code> using the current access token as a Bearer token.
            </p>
            {busy && <p role="status">Requesting profile with the access token…</p>}
            {!busy && !profile && (
              <p role="status">No profile response yet. Select this tab again to request the protected profile.</p>
            )}
            {profile && (
              <>
                <div className="profile-summary">
                  <span className="avatar">{profile.name.charAt(0).toUpperCase()}</span>
                  <div><strong>{profile.name}</strong><span>@{profile.username}</span></div>
                </div>
                <dl className="detail-list">
                  <div><dt>User ID</dt><dd>{profile.id}</dd></div>
                  <div><dt>Username</dt><dd>{profile.username}</dd></div>
                  <div><dt>Phone number</dt><dd>{profile.phoneNumber}</dd></div>
                  <div><dt>User role</dt><dd>{profile.role}</dd></div>
                </dl>
                <button className="secondary-button full-button" disabled={busy} onClick={verifySession}>
                  Request profile again
                </button>
              </>
            )}
          </section>
        ) : (
          <div id="session-panel" role="tabpanel" aria-labelledby="session-tab">
            <div className="dashboard-grid">
              <section className="panel tokens-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">JWT SESSION</p>
                    <h2>Your tokens</h2>
                  </div>
                  <span className="token-count">02 TOKENS</span>
                </div>
                <TokenCard label="ACCESS TOKEN" token={session.accessToken} lifetime="Expires in 15 minutes" />
                <TokenCard label="REFRESH TOKEN" token={session.refreshToken} lifetime="Expires in 7 days · single use" />
                <button className="secondary-button full-button" disabled={busy} onClick={renewSession}>
                  {busy ? 'Refreshing…' : 'Rotate refresh token'}
                </button>
                <p className="token-disclaimer">Demo only: tokens are visible here and held in memory, not persisted.</p>
              </section>

              <section className="panel flow-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">REQUEST / RESPONSE TRACE</p>
              <h2>How access and refresh work</h2>
            </div>
          </div>
          <ol className="flow-steps">
            <li><strong>Verify access token</strong> calls <code>GET /api/auth/me</code> with <code>Authorization: Bearer &lt;accessToken&gt;</code>. Nest's JWT guard verifies its signature and expiry before loading the profile.</li>
            <li>If the profile request returns <code>401</code>, the UI calls <code>POST /api/auth/refresh</code> with <code>{'{ "refreshToken": "..." }'}</code> in the JSON body.</li>
            <li>The API verifies the refresh JWT, checks it against the bcrypt hash stored on the user, then replaces that hash and returns a new token pair. The UI replaces both tokens in memory.</li>
            <li>Use <strong>Rotate refresh token</strong> to test that refresh flow immediately. The old refresh token is single-use; the UI switches to the returned replacement.</li>
          </ol>
          <h3 className="activity-title">Latest activity (token values are never shown here)</h3>
          <ol className="activity-list" aria-live="polite">
            {activity.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
          </ol>
          <p className="token-disclaimer">JWT claim details below are decoded for learning only; decoding does not verify a token. The API performs signature and expiry verification.</p>
              </section>
            </div>
          </div>
        )}

        <div className="dashboard-footer">
          <span>Protected route · JWT Bearer authentication</span>
          <button className="text-button signout-button" disabled={busy} onClick={signOut}>
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}

function TokenCard({ label, token, lifetime }: { label: string; token: string; lifetime: string }) {
  const [copied, setCopied] = useState(false);
  const claims = getJwtDisplayClaims(token);

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="token-card">
      <div className="token-card-heading">
        <span>{label}</span>
        <button className="copy-button" onClick={copyToken} type="button">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <code className="token-value">{token}</code>
      <p>{lifetime}</p>
      {claims && (
        <dl className="claim-list">
          <div><dt>Token type</dt><dd>{claims.tokenType ?? 'unknown'}</dd></div>
          <div><dt>Subject (user id)</dt><dd>{claims.sub ?? 'unknown'}</dd></div>
          <div><dt>Role</dt><dd>{claims.role ?? 'unknown'}</dd></div>
          <div><dt>Expires at</dt><dd>{claims.exp ? new Date(claims.exp * 1000).toLocaleString() : 'unknown'}</dd></div>
        </dl>
      )}
    </div>
  );
}

export default App;
