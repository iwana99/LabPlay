import React from "react";

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("UI crashed", { error, componentStack: info.componentStack });
    // Production: send a sanitized event to your error monitoring provider.
  }

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen grid place-items-center p-8">
          <section className="max-w-xl rounded-2xl border p-6">
            <h1 className="text-xl font-bold">Nešto nije uspelo da se prikaže.</h1>
            <p className="mt-3">Tvoj rad u labu nije automatski obrisan. Osveži stranicu ili se vrati u lab.</p>
            <button className="mt-4 rounded-xl border px-4 py-2" onClick={() => location.reload()}>
              Osveži
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
