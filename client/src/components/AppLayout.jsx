/** Layout principal: cabeçalho superior fixo + conteúdo + log de rolagens. */
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { classNames, initials } from '../lib/format.js';
import { DiceLog } from './DiceLog.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Início', end: true },
  { to: '/personagens', label: 'Personagens' },
  { to: '/campanhas', label: 'Campanhas' },
  { to: '/ameacas', label: 'Ameaças' },
  { to: '/homebrew', label: 'Homebrew' },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const { connected } = useRealtime();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/entrar', { replace: true });
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span aria-hidden className="text-lg text-arcane-400">✦</span>
            <span className="font-display text-lg tracking-wide text-slate-100">
              Grimório <span className="text-arcane-400">5e</span>
            </span>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  classNames(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-arcane-500/15 text-arcane-100'
                      : 'text-slate-400 hover:bg-ink-850 hover:text-slate-100',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span
              title={connected ? 'Tempo real ativo' : 'Tempo real desconectado'}
              className={classNames(
                'hidden h-2 w-2 rounded-full sm:block',
                connected ? 'bg-neon-400' : 'bg-ink-600',
              )}
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="flex items-center gap-2 rounded-full border border-ink-700 bg-ink-850/70 py-1 pl-1 pr-3 text-sm text-slate-300 transition-colors hover:border-arcane-500/50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-arcane-500/15 font-display text-xs text-arcane-200">
                  {initials(user?.name)}
                </span>
                <span className="hidden max-w-[10rem] truncate sm:block">{user?.name}</span>
              </button>

              {menuOpen ? (
                <>
                  <button
                    type="button"
                    aria-label="Fechar menu"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="panel absolute right-0 z-20 mt-2 w-56 animate-fade-up p-1.5">
                    <p className="px-3 py-2 text-xs text-slate-500">{user?.email}</p>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-ink-800 hover:text-white"
                    >
                      Sair da conta
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Navegação compacta no mobile */}
        <nav className="flex gap-1 overflow-x-auto border-t border-ink-800 px-2 py-1.5 md:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                classNames(
                  'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium',
                  isActive ? 'bg-arcane-500/15 text-arcane-100' : 'text-slate-400',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <DiceLog />
    </div>
  );
}
