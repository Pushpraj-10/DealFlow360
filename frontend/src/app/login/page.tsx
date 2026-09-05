'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { api, ApiClientError } from '@/lib/api';
import { ArrowRight, AlertCircle, CheckCircle2, Zap, Shield, BarChart3, Package } from 'lucide-react';

const PROPOSED_ROLES = [
  { value: 'SALES_REP', label: 'Sales Rep' },
  { value: 'SALES_MANAGER', label: 'Sales Manager' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'ADMIN', label: 'Admin' },
];

const FEATURES = [
  { icon: <Zap size={14} />, text: 'Automated discount governance' },
  { icon: <Shield size={14} />, text: 'Multi-step approval workflows' },
  { icon: <BarChart3 size={14} />, text: 'Real-time deal health monitoring' },
  { icon: <Package size={14} />, text: 'End-to-end fulfillment tracking' },
];

function formatRole(role: string) {
  return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
    <div className="login-root">
      {/* Left — Brand panel */}
      <div className="login-brand-panel">
        {/* Glow orbs */}
        <div className="login-glow login-glow--1" />
        <div className="login-glow login-glow--2" />

        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo__mark">D</div>
          <span className="login-logo__name">DealFlow360</span>
        </div>

        {/* Headline */}
        <div className="login-headline">
          <p className="login-eyebrow">B2B Sales Platform</p>
          <h1 className="login-headline__title">
            Intelligent<br />
            Sales Operations
          </h1>
          <p className="login-headline__desc">
            From quotation to fulfillment — manage your entire sales pipeline
            with built-in discount governance, risk evaluation, and approval workflows.
          </p>

          {/* Feature pills */}
          <div className="login-features">
            {FEATURES.map((feat) => (
              <div key={feat.text} className="login-feature-pill">
                <span className="login-feature-pill__icon">{feat.icon}</span>
                <span>{feat.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="login-brand-footer">© 2026 DealFlow360 · All rights reserved</div>
      </div>

      {/* Right — Form panel */}
      <div className="login-form-side">
        <div className="login-form-card">
          {/* Tab switcher */}
          <div className="login-tab-bar">
            {(['login', 'request'] as const).map((m) => (
              <button
                key={m}
                type="button"
                id={`login-tab-${m}`}
                onClick={() => switchMode(m)}
                className={`login-tab${mode === m ? ' login-tab--active' : ''}`}
              >
                {m === 'login' ? 'Sign in' : 'Request access'}
              </button>
            ))}
          </div>

          {mode === 'request' && requestSubmitted ? (
            <div className="login-success">
              <div className="login-success__icon">
                <CheckCircle2 size={22} />
              </div>
              <h2 className="login-success__title">Request submitted!</h2>
              <p className="login-success__desc">
                An admin will review your request for{' '}
                <strong>{formatRole(proposedRole)}</strong> access. You can sign in
                once it's approved.
              </p>
              <button
                type="button"
                id="login-back-btn"
                onClick={() => switchMode('login')}
                className="btn btn-secondary btn-full"
                style={{ marginTop: 8 }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <div className="login-form-header">
                <h2 className="login-form-title">
                  {mode === 'request' ? 'Request an account' : 'Welcome back'}
                </h2>
                <p className="login-form-sub">
                  {mode === 'request'
                    ? 'Propose the role and team you need. An admin will review and approve it.'
                    : 'Enter your credentials to access your workspace.'}
                </p>
              </div>

              {error && (
                <div className="df-alert df-alert-error" style={{ marginBottom: 16 }}>
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
                  id="login-submit-btn"
                  disabled={submitting}
                  className="btn btn-primary btn-full login-submit-btn"
                >
                  {submitting
                    ? (mode === 'request' ? 'Submitting…' : 'Signing in…')
                    : (mode === 'request' ? 'Submit request' : 'Sign in')}
                  {!submitting && <ArrowRight size={15} />}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <style>{`
        .login-root {
          min-height: 100vh;
          display: flex;
          background: #fff;
          font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
        }

        /* ── Brand panel ─────────────────────── */
        .login-brand-panel {
          flex: 0 0 44%;
          background: #080E1C;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 44px 52px;
          position: relative;
          overflow: hidden;
        }

        .login-glow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .login-glow--1 {
          width: 480px;
          height: 480px;
          background: radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%);
          top: -140px;
          left: -120px;
        }

        .login-glow--2 {
          width: 380px;
          height: 380px;
          background: radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%);
          bottom: -80px;
          right: -100px;
        }

        .login-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          position: relative;
          z-index: 1;
        }

        .login-logo__mark {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: linear-gradient(135deg, #6366F1, #8B5CF6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.5px;
          box-shadow: 0 4px 16px -4px rgba(99,102,241,0.7), 0 0 0 1px rgba(255,255,255,0.1) inset;
        }

        .login-logo__name {
          color: #F1F5F9;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.3px;
        }

        .login-headline {
          position: relative;
          z-index: 1;
        }

        .login-eyebrow {
          color: #818CF8;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin: 0 0 16px;
        }

        .login-headline__title {
          color: #F8FAFC;
          font-size: 36px;
          font-weight: 800;
          line-height: 1.12;
          letter-spacing: -0.8px;
          margin: 0 0 18px;
        }

        .login-headline__desc {
          color: #94A3B8;
          font-size: 14px;
          line-height: 1.65;
          max-width: 360px;
          margin: 0 0 32px;
        }

        .login-features {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .login-feature-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          color: #CBD5E1;
          font-size: 13px;
          transition: background 0.15s;
        }

        .login-feature-pill:hover {
          background: rgba(99,102,241,0.08);
          border-color: rgba(99,102,241,0.2);
        }

        .login-feature-pill__icon {
          display: flex;
          align-items: center;
          color: #818CF8;
          flex-shrink: 0;
        }

        .login-brand-footer {
          color: rgba(148,163,184,0.5);
          font-size: 11.5px;
          position: relative;
          z-index: 1;
        }

        /* ── Form panel ──────────────────────── */
        .login-form-side {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #F8FAFC;
          padding: 48px 24px;
        }

        .login-form-card {
          width: 100%;
          max-width: 390px;
          background: #fff;
          border: 1px solid #E2E8F0;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 8px 32px -8px rgba(15,23,42,0.12), 0 2px 8px -2px rgba(15,23,42,0.07);
        }

        .login-tab-bar {
          display: flex;
          gap: 4px;
          background: #F1F5F9;
          border-radius: 9px;
          padding: 4px;
          margin-bottom: 28px;
        }

        .login-tab {
          flex: 1;
          padding: 8px 0;
          border-radius: 7px;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          background: transparent;
          color: #64748B;
          transition: all 0.15s;
          font-family: inherit;
        }

        .login-tab--active {
          background: #fff;
          color: #0F172A;
          box-shadow: 0 1px 3px rgba(15,23,42,0.1), 0 1px 2px rgba(15,23,42,0.06);
        }

        .login-form-header {
          margin-bottom: 24px;
        }

        .login-form-title {
          font-size: 22px;
          font-weight: 700;
          color: #0F172A;
          letter-spacing: -0.4px;
          margin: 0 0 6px;
        }

        .login-form-sub {
          font-size: 13px;
          color: #64748B;
          line-height: 1.5;
          margin: 0;
        }

        .login-submit-btn {
          margin-top: 6px;
          padding: 11px 20px;
          font-size: 14px;
          border-radius: 9px;
        }

        .login-success {
          text-align: center;
          padding: 12px 0;
        }

        .login-success__icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #ECFDF5;
          color: #059669;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          box-shadow: 0 0 0 8px #F0FDF4;
        }

        .login-success__title {
          font-size: 20px;
          font-weight: 700;
          color: #0F172A;
          margin: 0 0 8px;
        }

        .login-success__desc {
          font-size: 13px;
          color: #64748B;
          line-height: 1.6;
          margin: 0 0 20px;
        }

        @media (max-width: 768px) {
          .login-brand-panel { display: none; }
          .login-form-side { background: #fff; }
          .login-form-card {
            border: none;
            box-shadow: none;
            padding: 24px 16px;
          }
        }
      `}</style>
    </div>
  );
}
