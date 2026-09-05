'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { ApiClientError } from '@/lib/api';
import { ArrowRight, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('finance@dealflow360.test');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Login failed');
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
              Sign in to your workspace
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Enter your credentials to access DealFlow360. New internal accounts are created by an admin.
            </p>
          </div>

          {error && (
            <div className="df-alert df-alert-error" style={{ marginBottom: 20 }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
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
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-full"
              style={{ marginTop: 8, padding: '10px 20px', fontSize: 14, gap: 8 }}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
              {!submitting && <ArrowRight size={14} />}
            </button>
          </form>

          {/* Seed account helper */}
          <div
            style={{
              marginTop: 28,
              padding: '12px 14px',
              background: 'var(--surface-02)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}
          >
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 6 }}>
              DEMO ACCOUNTS
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[
                { role: 'Sales Rep', email: 'sales.rep@dealflow360.test' },
                { role: 'Sales Manager', email: 'sales.manager@dealflow360.test' },
                { role: 'Finance', email: 'finance@dealflow360.test' },
                { role: 'Admin', email: 'admin@dealflow360.test' },
                { role: 'Customer', email: 'customer@acme.test' },
              ].map(({ role, email: e }) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmail(e)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'none',
                    border: 'none',
                    padding: '3px 0',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>{role}</span>
                  <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'monospace' }}>{e}</span>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
              Password: Password123!
            </p>
          </div>
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
