import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, Pill, ClipboardList, User } from "lucide-react";

const NAV = [
  { to: "/inicio", label: "Inicio", Icon: Home },
  { to: "/medicamentos", label: "Medicamentos", Icon: Pill },
  { to: "/historial", label: "Historial", Icon: ClipboardList },
  { to: "/perfil", label: "Perfil", Icon: User },
] as const;

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-28">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <span className="text-base font-semibold text-primary">Pastillero Digital</span>
          <span className="text-base text-muted-foreground">{title}</span>
        </div>
      </header>

      <main id="contenido" className="mx-auto max-w-3xl px-5 py-6">
        {children}
      </main>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 border-t border-border bg-card"
      >
        <ul className="mx-auto flex max-w-3xl">
          {NAV.map(({ to, label, Icon }) => (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className="flex min-h-20 flex-col items-center justify-center gap-1 py-3 text-sm font-medium text-muted-foreground"
                activeProps={{ className: "text-primary bg-accent" }}
              >
                <Icon aria-hidden="true" className="size-7" />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
