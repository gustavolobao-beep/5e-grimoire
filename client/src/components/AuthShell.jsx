/** Moldura das telas de entrada/registro (fundo arcano centralizado). */
import { Link } from 'react-router-dom';

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-arcane-radial px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p aria-hidden className="text-3xl text-arcane-400">✦</p>
          <h1 className="mt-2 font-display text-3xl tracking-wide text-slate-100">
            Grimório <span className="text-arcane-400">5e</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Fichas, campanhas e bestiário para D&amp;D 5e</p>
        </div>

        <div className="panel animate-fade-up p-6">
          <h2 className="font-display text-xl text-slate-100">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
          <div className="mt-5">{children}</div>
        </div>

        {footer ? <div className="mt-4 text-center text-sm text-slate-400">{footer}</div> : null}

        <p className="mt-6 text-center text-xs text-slate-600">
          <Link to="/entrar" className="hover:text-slate-400">Grimório 5e</Link> · projeto de mesa sem afiliação com a Wizards of the Coast
        </p>
      </div>
    </div>
  );
}
