'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { api, ApiClientError } from '@/lib/api';

import { ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

const PROPOSED_ROLES = [
  { value: 'SALES_REP', label: 'Sales Rep' },
  { value: 'SALES_MANAGER', label: 'Sales Manager' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'request'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [proposedRole, setProposedRole] = useState('SALES_REP');
  const [team, setTeam] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  const switchMode = (next: 'login' | 'request') => {
    setMode(next);
    setError(null);
    setRequestSubmitted(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'request') {
        await api.post('/auth/signup-request', {
          fullName,
          email,
          password,
          proposedRole,
          team: team || undefined,
        });
        setRequestSubmitted(true);
      } else {
        await login(email, password);
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : mode === 'request' ? 'Request failed' : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#fff' }}>
      {/* Left — Brand panel */}
      <div
        style={{
          flex: '0 0 45%',
          background: '#171A21',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px',
        }}
        className="login-brand-panel"
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: 'var(--accent)',
              borderRadius: 7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>D</span>
          </div>
          <span style={{ color: '#FAFAFA', fontSize: 16, fontWeight: 600, letterSpacing: 0 }}>
            DealFlow360
          </span>
        </div>

        {/* Headline */}
        <div>
          <h1
            style={{
              color: '#FAFAFA',
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: 0,
              marginBottom: 16,
            }}
          >
            Intelligent B2B
            <br />
            Sales Operations
          </h1>
          <p style={{ color: '#A3AAB8', fontSize: 14, lineHeight: 1.6, maxWidth: 340 }}>
            From quotation to fulfillment — manage your entire sales pipeline with built-in discount governance,
            risk evaluation, and approval workflows.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 36 }}>
            {[
              'Automated discount governance',
              'Multi-step approval workflows',
              'Real-time deal health monitoring',
              'End-to-end fulfillment tracking',
            ].map((feat) => (
              <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: '#D5DAE5', fontSize: 13 }}>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ color: '#A3AAB8', fontSize: 12 }}>
          © 2026 DealFlow360
        </div>
      </div>

      {/* Right — Form panel */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          padding: '48px 24px',
        }}
      >

        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--surface-02)', borderRadius: 'var(--radius)', padding: 4 }}>
            {(['login', 'request'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 'calc(var(--radius) - 2px)',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: mode === m ? 'var(--surface-01)' : 'transparent',
                  color: mode === m ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  boxShadow: mode === m ? 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.06))' : 'none',
                }}
              >
                {m === 'login' ? 'Sign in' : 'Request access'}
              </button>
            ))}
          </div>

          {mode === 'request' && requestSubmitted ? (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'var(--green-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <CheckCircle2 size={20} color="var(--green)" />
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Request submitted
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  An admin will review your request for <strong>{formatRole(proposedRole)}</strong> access. You
                  can sign in with the password you set once it's approved.
                </p>
              </div>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="btn btn-ghost btn-full"
                style={{ padding: '10px 20px', fontSize: 14 }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 36 }}>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: 0,
                    marginBottom: 6,
                  }}
                >
                  {mode === 'request' ? 'Request an internal account' : 'Sign in to your workspace'}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {mode === 'request'
                    ? 'Propose the role and team you need. An admin will review and approve it.'
                    : 'Enter your credentials to access DealFlow360.'}
                </p>
              </div>

              {error && (
                <div className="df-alert df-alert-error" style={{ marginBottom: 20 }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {mode === 'request' && (
                  <div className="df-field">
                    <label className="df-label" htmlFor="fullName">Full name</label>
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="df-input"
                      placeholder="Jane Doe"
                      required
                      autoComplete="name"
                    />
                  </div>
                )}

                <div className="df-field">
                  <label className="df-label" htmlFor="email">Email address</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="df-input"
                    placeholder="you@company.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="df-field">
                  <label className="df-label" htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="df-input"
                    placeholder="••••••••"
                    required
                    minLength={mode === 'request' ? 8 : undefined}
                    autoComplete={mode === 'request' ? 'new-password' : 'current-password'}
                  />
                </div>

                {mode === 'request' && (
                  <>
                    <div className="df-field">
                      <label className="df-label" htmlFor="proposedRole">Role you're requesting</label>
                      <select
                        id="proposedRole"
                        value={proposedRole}
                        onChange={(e) => setProposedRole(e.target.value)}
                        className="df-select"
                      >
                        {PROPOSED_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="df-field">
                      <label className="df-label" htmlFor="team">Team (optional)</label>
                      <input
                        id="team"
                        type="text"
                        value={team}
                        onChange={(e) => setTeam(e.target.value)}
                        className="df-input"
                        placeholder="e.g. east"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary btn-full"
                  style={{ marginTop: 8, padding: '10px 20px', fontSize: 14, gap: 8 }}
                >
                  {submitting
                    ? mode === 'request' ? 'Submitting…' : 'Signing in…'
                    : mode === 'request' ? 'Submit request' : 'Sign in'}
                  {!submitting && <ArrowRight size={14} />}
                </button>
              </form>

            </>
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .login-brand-panel {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function formatRole(role: string) {
  return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
