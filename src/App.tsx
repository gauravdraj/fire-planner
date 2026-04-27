import { BasicPlannerPage } from '@/components/BasicPlannerPage';
import { Disclaimer } from '@/components/Disclaimer';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { StalenessGate } from '@/components/StalenessGate';
import { useUiStore } from '@/store/uiStore';

export function App() {
  const mode = useUiStore((state) => state.mode);

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <Disclaimer />
      <StalenessGate />
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        {mode === 'advanced' ? <AdvancedPlaceholder /> : <BasicPlannerPage />}
      </main>
      <Footer />
    </div>
  );
}

function AdvancedPlaceholder() {
  return (
    <section aria-labelledby="advanced-placeholder-heading" className="rounded-lg border border-slate-200 p-5">
      <h2 className="text-xl font-semibold" id="advanced-placeholder-heading">
        Advanced mode
      </h2>
      <p className="mt-2 text-sm text-slate-600">Advanced controls arrive in Gate 4.</p>
    </section>
  );
}
