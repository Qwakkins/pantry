import { ENGINE_VERSION } from '@other-half/engine';

export default function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 p-6">
      <h1 className="text-3xl font-semibold text-lime-900">Other Half</h1>
      <p className="text-stone-600">Never waste the other half.</p>
      <p className="text-xs text-stone-400">engine {ENGINE_VERSION}</p>
    </main>
  );
}
