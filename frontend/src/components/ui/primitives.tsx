import type React from 'react';

export function Button({
  variant = 'secondary',
  size,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning';
  size?: 'sm' | 'lg';
}) {
  return <button className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`.trim()} {...props} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`df-input ${props.className ?? ''}`.trim()} {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`df-select ${props.className ?? ''}`.trim()} {...props} />;
}

export function StatusBadge({ status }: { status: string }) {
  const value = status?.toLowerCase() ?? '';
  const kind =
    value === 'approved' || value === 'active' || value === 'confirmed' || value === 'paid'
      ? 'status-approved'
      : value.includes('pending') || value.includes('approval') || value.includes('partial')
        ? 'status-pending'
        : value === 'rejected' || value === 'unpaid'
          ? 'status-rejected'
          : value.includes('negotiat') || value.includes('sent')
            ? 'status-negotiating'
            : 'status-draft';

  return <span className={`status-badge ${kind}`}>{status.replace(/_/g, ' ')}</span>;
}

export function RiskIndicator({ severity }: { severity?: string | null }) {
  const value = severity?.toLowerCase() ?? 'none';
  const kind = value === 'high' ? 'risk-high' : value === 'medium' ? 'risk-medium' : value === 'low' ? 'risk-low' : 'risk-none';
  return <span className={`risk-badge ${kind}`}>{severity || 'NONE'}</span>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="df-page-header">
      <div>
        <h1 className="df-page-title">{title}</h1>
        {subtitle && <p className="df-page-subtitle">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="df-table-wrap">
      <table className="df-table">{children}</table>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="df-empty">
      {icon && <div className="df-empty-icon">{icon}</div>}
      <div className="df-empty-title">{title}</div>
      {description && <div className="df-empty-desc">{description}</div>}
    </div>
  );
}

export function Metric({
  label,
  value,
  sub,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="df-metric">
      <div className="df-metric-label">{label}</div>
      <div className="df-metric-value text-num">{value}</div>
      {sub && <div className="df-metric-sub">{sub}</div>}
    </div>
  );
}

export function Timeline({ children }: { children: React.ReactNode }) {
  return <div className="df-timeline">{children}</div>;
}

export function LoadingSkeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`.trim()} style={style} />;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="df-alert df-alert-error">{message}</div>;
}
