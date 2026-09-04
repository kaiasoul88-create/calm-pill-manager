import { createFileRoute, Link } from "@tanstack/react-router";
import { APP_TAGLINE } from "@/lib/pastillero";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pastillero Digital — Recuerda tus medicamentos a tiempo" },
      {
        name: "description",
        content:
          "Pastillero Digital te ayuda a recordar qué medicamento debes tomar y cuándo. Sencillo, claro y pensado para todas las edades.",
      },
      { property: "og:title", content: "Pastillero Digital — Recuerda tus medicamentos a tiempo" },
      {
        property: "og:description",
        content: "Tus medicamentos. En orden. Sin complicaciones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-4xl px-6 py-6">
        <span className="text-lg font-semibold text-primary">Pastillero Digital</span>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-20">
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          Tus medicamentos. En orden. Sin complicaciones.
        </h1>
        <p className="mt-5 max-w-2xl text-xl text-muted-foreground">
          Pastillero Digital te ayuda a recordar qué medicamento debes tomar y cuándo hacerlo.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/auth"
            search={{ modo: "registro" }}
            className="inline-flex min-h-16 items-center justify-center rounded-2xl bg-primary px-8 text-xl font-semibold text-primary-foreground hover:opacity-95"
          >
            COMENZAR GRATIS
          </Link>
          <Link
            to="/auth"
            search={{ modo: "entrar" }}
            className="inline-flex min-h-16 items-center justify-center rounded-2xl border-2 border-primary px-8 text-xl font-semibold text-primary hover:bg-accent"
          >
            YA TENGO CUENTA
          </Link>
        </div>

        <p className="mt-6 text-lg text-muted-foreground">
          Una herramienta para organizar y registrar tus medicamentos.
        </p>

        <section aria-label="Así se ve la pantalla principal" className="mt-12">
          <div className="card-surface mx-auto max-w-md p-6">
            <p className="text-lg">Hola, María 👋</p>
            <p className="mt-4 text-base font-semibold uppercase tracking-wide text-muted-foreground">
              Tu próxima toma
            </p>
            <p className="mt-2 text-3xl font-bold">08:00 a. m.</p>
            <p className="mt-1 text-2xl font-semibold">💊 Metformina</p>
            <p className="text-lg text-muted-foreground">500 mg</p>
            <div className="mt-5 space-y-3">
              <div className="flex min-h-16 items-center justify-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground">
                YA LO TOMÉ
              </div>
              <div className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-primary text-lg font-semibold text-primary">
                RECORDAR MÁS TARDE
              </div>
            </div>
            <ul className="mt-6 space-y-2 text-base">
              <li>07:00 a. m. ✅ Losartán — Tomado</li>
              <li>12:00 p. m. 🔔 Metformina — Pendiente</li>
              <li>04:00 p. m. 🔔 Vitamina D — Pendiente</li>
            </ul>
          </div>
        </section>

        <p className="mt-12 text-base text-muted-foreground">{APP_TAGLINE}</p>
      </main>
    </div>
  );
}
