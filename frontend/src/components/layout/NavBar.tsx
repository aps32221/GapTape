import { NavLink } from "react-router-dom";

import { ConnectWalletButton } from "./ConnectWalletButton";
import { OracleStatusPill } from "./OracleStatusPill";

const LINKS = [
  { to: "/", label: "Overview" },
  { to: "/lender", label: "Lender" },
  { to: "/borrower", label: "Short & Insure" },
  { to: "/underwriter", label: "Underwriter" },
  { to: "/demo", label: "Gap Simulator" },
  { to: "/risks", label: "Protocol Risks" },
];

export function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-mono text-sm font-bold text-ink-950">
            GT
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide text-ink-50">GapTape</div>
            <div className="text-[10px] uppercase tracking-widest text-ink-400">Weekend Short × Gap Insurance</div>
          </div>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-ink-800 text-brand-400" : "text-ink-300 hover:bg-ink-800 hover:text-ink-50"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <OracleStatusPill />
          <ConnectWalletButton />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-ink-800 px-4 py-2 lg:hidden">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                isActive ? "bg-ink-800 text-brand-400" : "text-ink-300"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
