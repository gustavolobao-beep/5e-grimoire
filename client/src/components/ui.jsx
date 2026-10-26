/** Blocos de interface reutilizáveis, com o tema escuro/místico do Grimório. */
import { createElement, forwardRef, useEffect } from 'react';
import { classNames, initials } from '../lib/format.js';

// ---------------------------------------------------------------------------
// Superfícies
// ---------------------------------------------------------------------------
export function Panel({ className, children, ...rest }) {
  return (
    <section className={classNames('panel', className)} {...rest}>
      {children}
    </section>
  );
}

export function PanelHeader({ title, subtitle, action, className }) {
  return (
    <header className={classNames('panel-head', className)}>
      <div className="min-w-0">
        <h2 className="section-title truncate">{title}</h2>
        {subtitle ? <p className="mt-0.5 truncate text-xs text-slate-400">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Card({ className, children, ...rest }) {
  return (
    <div
      className={classNames(
        'rounded-xl border border-ink-700/70 bg-ink-850/70 p-4 transition-colors hover:border-arcane-500/45',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function EmptyState({ icon = '✦', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-700 bg-ink-900/40 px-6 py-12 text-center">
      <span aria-hidden className="text-2xl text-arcane-400">{icon}</span>
      <h3 className="font-display text-base text-slate-200">{title}</h3>
      {description ? <p className="max-w-md text-sm text-slate-400">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={classNames(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-arcane-500/30 border-t-arcane-400',
        className,
      )}
    />
  );
}

export function LoadingScreen({ label = 'Consultando o grimório…' }) {
  return (
    <div className="flex h-full items-center justify-center gap-3 text-sm text-slate-400">
      <Spinner /> {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulário
// ---------------------------------------------------------------------------
export function Field({ label, hint, error, className, children }) {
  return (
    <label className={classNames('block', className)}>
      {label ? <span className="label">{label}</span> : null}
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-ember">{error}</span> : null}
    </label>
  );
}

export const Input = forwardRef(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={classNames('input', className)} {...rest} />;
});

export const Select = forwardRef(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={classNames('input appearance-none pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef(function Textarea({ className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={classNames('input resize-y', className)} {...rest} />;
});

export function Checkbox({ label, className, ...rest }) {
  return (
    <label className={classNames('flex cursor-pointer items-center gap-2 text-sm text-slate-300', className)}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-ink-600 bg-ink-900 text-arcane-500 focus:ring-arcane-500/40"
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
}

export function Button({ variant = 'primary', size, className, loading, children, ...rest }) {
  const variants = {
    primary: 'btn-primary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
    neon: 'btn-neon',
  };
  return (
    <button
      className={classNames(variants[variant] ?? variants.primary, size === 'xs' && 'btn-xs', className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Spinner className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Overlays e navegação
// ---------------------------------------------------------------------------
export function Modal({ open, title, onClose, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/80 p-4 backdrop-blur-sm sm:items-center">
      <div className={classNames('panel w-full animate-fade-up', width)} role="dialog" aria-modal="true">
        <div className="panel-head">
          <h2 className="font-display text-base text-slate-100">{title}</h2>
          <button type="button" className="btn-ghost btn-xs" onClick={onClose} aria-label="Fechar">
            Fechar
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-ink-700/70 px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={classNames('flex flex-wrap gap-1 border-b border-ink-700/70', className)} role="tablist">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={classNames(
              '-mb-px border-b-2 px-3.5 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-arcane-500 text-white'
                : 'border-transparent text-slate-400 hover:border-ink-600 hover:text-slate-200',
            )}
          >
            {tab.label}
            {tab.badge ? (
              <span className="ml-2 rounded-full bg-ink-700 px-1.5 py-0.5 text-[11px] text-slate-300">
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------
export function StatTile({ label, value, hint, accent = 'arcane', onClick, title }) {
  const accents = {
    arcane: 'text-arcane-300',
    neon: 'text-neon-300',
    gold: 'text-gold',
    ember: 'text-ember',
    slate: 'text-slate-100',
  };
  const Component = onClick ? 'button' : 'div';
  return createElement(
    Component,
    {
      type: onClick ? 'button' : undefined,
      onClick,
      title,
      className: classNames('stat-tile', onClick && 'rollable'),
    },
    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>,
    <span className={classNames('font-display text-xl leading-tight', accents[accent] ?? accents.arcane)}>
      {value}
    </span>,
    hint ? <span className="text-[11px] text-slate-500">{hint}</span> : null,
  );
}

export function Badge({ tone = 'default', children, className }) {
  const tones = {
    default: 'chip',
    arcane: 'chip-arcane',
    neon: 'chip border-neon-500/40 bg-neon-500/10 text-neon-300',
    gold: 'chip border-gold/40 bg-gold/10 text-gold',
    ember: 'chip border-ember/40 bg-ember/10 text-ember',
  };
  return <span className={classNames(tones[tone] ?? tones.default, className)}>{children}</span>;
}

export function Avatar({ name, size = 40, className }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={classNames(
        'flex shrink-0 items-center justify-center rounded-full border border-arcane-500/35 bg-arcane-500/10 font-display text-arcane-200',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Alert({ tone = 'error', children, className }) {
  if (!children) return null;
  const tones = {
    error: 'border-ember/40 bg-ember/10 text-ember',
    info: 'border-arcane-500/40 bg-arcane-500/10 text-arcane-100',
    warn: 'border-gold/40 bg-gold/10 text-gold',
  };
  return (
    <div className={classNames('rounded-lg border px-3 py-2 text-sm', tones[tone] ?? tones.error, className)} role="alert">
      {children}
    </div>
  );
}

/** Barra de PV com cor por faixa (sangrando / ferido / saudável). */
export function HealthBar({ current, max, temp = 0, className }) {
  const safeMax = Math.max(1, Number(max) || 1);
  const percent = Math.max(0, Math.min(100, ((Number(current) || 0) / safeMax) * 100));
  const tone = percent <= 25 ? 'bg-ember' : percent <= 60 ? 'bg-gold' : 'bg-neon-500';
  return (
    <div className={classNames('h-2 w-full overflow-hidden rounded-full bg-ink-800', className)}>
      <div className={classNames('h-full rounded-full transition-all duration-300', tone)} style={{ width: `${percent}%` }} />
      {temp > 0 ? <span className="sr-only">{temp} PV temporários</span> : null}
    </div>
  );
}
