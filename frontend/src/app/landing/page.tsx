import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  ArrowRight,
  Boxes,
  Activity,
  BarChart2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Reveal } from '@/components/landing/Reveal';
import './landing.css';

export const metadata: Metadata = {
  title: 'DealFlow360: quote to cash with the policy built in',
  description:
    'A B2B sales operations platform where approvals route by blended discount risk, fulfillment splits across warehouses, and one-time and recurring billing reconcile on a single order.',
};

const NAV_LINKS = [
  { label: 'How it works', href: '#flow' },
  { label: 'Governance', href: '#governance' },
  { label: 'Portal', href: '#portal' },
  { label: 'Roles', href: '#roles' },
];

const BREAKS = [
  'Discount approvals happen in email threads, so nobody can reconstruct who agreed to what.',
  'Stock sits across several warehouses while the order behaves as though it sits in one.',
  'Hardware bills once and subscriptions bill forever, on the same confirmed order.',
];

const FLOW = [
  { label: 'Quote', body: 'Add products, apply discounts, and watch margin update on every line.' },
  { label: 'Approve', body: 'A blended risk score decides who signs off, and in what order.' },
  { label: 'Fulfill', body: 'Stock is allocated across warehouses, with a manual override when you need one.' },
  { label: 'Bill', body: 'One-time lines invoice once. Recurring lines get a schedule and proration.' },
];

const ROLES = [
  { name: 'Sales Rep', body: 'Builds quotations, applies discounts, answers customer change requests.' },
  { name: 'Sales Manager', body: 'Reviews risk, approves or returns, configures tiers and approval chains.' },
  { name: 'Finance and Operations', body: 'Handles second-level approvals, warehouse splits, billing and credit notes.' },
  { name: 'Admin', body: 'Owns products, pricing, warehouses, plans, and platform reporting.' },
  { name: 'Customer', body: 'Reviews the quotation, negotiates terms, and confirms in one click.' },
];

export default function LandingPage() {
  return (
    <div className="landing-root">
      <header className="landing-nav">
        <div className="landing-nav__inner">
          <Link href="/landing" className="landing-nav__brand">
            <span className="landing-mark">D</span>
            <span>DealFlow360</span>
          </Link>
          <nav className="landing-nav__links" aria-label="Landing page sections">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <Link href="/login" className="landing-btn landing-btn--primary landing-btn--sm">
            Open the workspace
          </Link>
        </div>
      </header>

      <main>
        {/* Hero: asymmetric split, copy left, real product screenshot right */}
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <p className="landing-eyebrow">B2B sales operations platform</p>
            <h1 className="landing-hero__title">
              Quote to cash, with the discount policy built in.
            </h1>
            <p className="landing-hero__sub">
              Approvals route by blended risk. Fulfillment splits across warehouses. One-time and
              recurring billing reconcile on one order.
            </p>
            <div className="landing-hero__actions">
              <Link href="/login" className="landing-btn landing-btn--primary">
                Open the workspace
                <ArrowRight size={16} aria-hidden />
              </Link>
              <a href="#flow" className="landing-btn landing-btn--ghost">
                See how it works
              </a>
            </div>
          </div>
          <div className="landing-hero__shot">
            <Image
              src="/landing/quote-builder.png"
              alt="Quotation builder showing line items with policy limits beside a commercial summary with total and margin"
              width={1295}
              height={601}
              priority
              sizes="(max-width: 1000px) 100vw, 52vw"
            />
          </div>
        </section>

        {/* Stakes: hairline band, no cards */}
        <section className="landing-band">
          <Reveal>
            <h2 className="landing-band__title">Where quote to cash usually breaks</h2>
            <div className="landing-band__grid">
              {BREAKS.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </Reveal>
        </section>

        {/* Flow: process rail */}
        <section className="landing-section" id="flow">
          <Reveal>
            <p className="landing-eyebrow">How it works</p>
            <h2 className="landing-h2">One pass from draft to paid.</h2>
          </Reveal>
          <Reveal delay={80}>
            <ol className="landing-rail">
              {FLOW.map((step) => (
                <li key={step.label}>
                  <span className="landing-rail__node" aria-hidden />
                  <h3>{step.label}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

        {/* Capabilities: asymmetric bento, five cells for five capabilities */}
        <section className="landing-section">
          <Reveal>
            <h2 className="landing-h2">Built around the parts that are hard.</h2>
          </Reveal>
          <Reveal delay={80}>
            <div className="landing-bento">
              <article className="landing-cell landing-cell--wide">
                <div className="landing-cell__text">
                  <Sparkles size={18} aria-hidden />
                  <h3>Upsell that knows the margin</h3>
                  <p>
                    Suggestions rank by co-purchase history and promotion weight, and only surface
                    when they clear the margin floor you set.
                  </p>
                </div>
                <Image
                  src="/landing/upsell-panel.png"
                  alt="Recommendation panel suggesting a promoted support plan with its margin contribution"
                  width={806}
                  height={153}
                  sizes="(max-width: 900px) 100vw, 55vw"
                />
              </article>

              <article className="landing-cell landing-cell--tint">
                <div className="landing-cell__text">
                  <ShieldCheck size={18} aria-hidden />
                  <h3>Blended discount risk</h3>
                  <p>
                    Every line is checked against its own category and tier ceiling, then scored
                    across the whole quotation.
                  </p>
                </div>
              </article>

              <article className="landing-cell landing-cell--tall">
                <div className="landing-cell__text">
                  <Boxes size={18} aria-hidden />
                  <h3>Split across warehouses</h3>
                  <p>
                    The system proposes an allocation that keeps shipments down. Accept it, or
                    override it by hand.
                  </p>
                </div>
                <Image
                  src="/landing/fulfillment-split.png"
                  alt="Fulfillment allocation splitting twenty five units into two shipments with backorder status"
                  width={618}
                  height={739}
                  sizes="(max-width: 900px) 100vw, 40vw"
                />
              </article>

              <article className="landing-cell landing-cell--tint">
                <div className="landing-cell__text">
                  <Activity size={18} aria-hidden />
                  <h3>Deal health, watched continuously</h3>
                  <p>
                    Stalled quotations, discount anomalies, and slipping delivery promises surface
                    as alerts a manager can nudge or escalate.
                  </p>
                </div>
              </article>

              <article className="landing-cell landing-cell--full">
                <div className="landing-cell__text">
                  <BarChart2 size={18} aria-hidden />
                  <h3>Report on the filters that matter</h3>
                  <p>
                    Period, rep, team, approval status, category, and product. Export the same view
                    to XLSX or PDF.
                  </p>
                </div>
                <Image
                  src="/landing/reports.png"
                  alt="Report filter row with sales rep, team, approval status, category and product filters"
                  width={1257}
                  height={59}
                  sizes="100vw"
                />
              </article>
            </div>
          </Reveal>
        </section>

        {/* Governance: split, copy left, screenshot right */}
        <section className="landing-section landing-split" id="governance">
          <Reveal className="landing-split__copy">
            <h2 className="landing-h2">The score decides the signers.</h2>
            <p>
              A Gold customer may be allowed twenty percent, while a services line inside that same
              order is capped at ten. Every line is checked against its own ceiling, and the excess
              is blended across the order.
            </p>
            <p>
              Small overages spread across many lines reach the same exposure as one obvious
              violation, and both route the same way: Sales Manager first, Finance after, and only
              when the score calls for it.
            </p>
          </Reveal>
          <Reveal delay={80} className="landing-split__shot landing-split__shot--narrow">
            <Image
              src="/landing/approval-timeline.png"
              alt="Approval progress showing submitted, sales manager, finance and confirmed steps with approve, return and reject actions"
              width={341}
              height={691}
              sizes="(max-width: 900px) 70vw, 30vw"
            />
          </Reveal>
        </section>

        {/* Portal: split reversed, screenshot left, copy right */}
        <section className="landing-section landing-split landing-split--reverse" id="portal">
          <Reveal className="landing-split__shot landing-split__shot--narrow">
            <Image
              src="/landing/portal-quote.png"
              alt="Customer portal summary with grand total, confirm quotation, request changes and propose discount actions"
              width={321}
              height={394}
              sizes="(max-width: 900px) 65vw, 28vw"
            />
          </Reveal>
          <Reveal delay={80} className="landing-split__copy">
            <h2 className="landing-h2">Customers negotiate in the browser.</h2>
            <p>
              Send the quotation once. The customer opens a restricted view, asks for changes on a
              specific line, or counters the discount, without a single email thread.
            </p>
            <p>
              If the new terms cross the approval threshold, the quotation re-enters the approval
              flow on its own. If they do not, it moves straight to fulfillment.
            </p>
          </Reveal>
        </section>

        {/* Roles: definition list */}
        <section className="landing-section" id="roles">
          <Reveal>
            <h2 className="landing-h2">Five roles, one system of record.</h2>
          </Reveal>
          <Reveal delay={80}>
            <dl className="landing-roles">
              {ROLES.map((role) => (
                <div key={role.name}>
                  <dt>{role.name}</dt>
                  <dd>{role.body}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>

        {/* Closing */}
        <section className="landing-closing">
          <Reveal>
            <h2>See it run end to end.</h2>
            <p>
              Sign in with a demo account and walk a quotation from draft through approval,
              fulfillment, and billing.
            </p>
            <Link href="/login" className="landing-btn landing-btn--primary">
              Open the workspace
              <ArrowRight size={16} aria-hidden />
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <Link href="/landing" className="landing-nav__brand">
            <span className="landing-mark">D</span>
            <span>DealFlow360</span>
          </Link>
          <nav aria-label="Footer">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <span className="landing-footer__note">© 2026 DealFlow360</span>
        </div>
      </footer>
    </div>
  );
}
