import { Link, Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <aside className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 lg:w-56 lg:flex-col lg:items-stretch lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <span className="grid h-8 w-8 place-items-center rounded-sm border border-border">
              <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden>
                <rect x="4" y="11" width="24" height="2" fill="currentColor" />
                <rect x="4" y="19" width="24" height="2" fill="currentColor" />
                <rect x="9" y="11" width="2" height="10" className="text-signal" fill="currentColor" />
                <rect x="21" y="11" width="2" height="10" className="text-signal" fill="currentColor" />
              </svg>
            </span>
            <span>
              <span className="block font-display text-lg font-semibold leading-none tracking-tight">
                CausalRail
              </span>
              <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Dispatch
              </span>
            </span>
          </Link>
          <nav className="hidden lg:block">
            <Link to="/" className="block rounded-sm px-2 py-2 text-sm text-fg no-underline hover:bg-raised">
              Board
            </Link>
            <p className="mt-4 px-2 text-sm leading-snug text-muted">
              Attribute CI failures. Skip paying for noise.
            </p>
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
