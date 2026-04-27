import { ModeToggle } from './ModeToggle';
import { RealNominalToggle } from './RealNominalToggle';
import { ShareButton } from './ShareButton';

export function Header() {
  return (
    <header className="border-b border-slate-200 px-4 py-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-700">Browser-only planner</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Fire Planner</h1>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <ModeToggle />
          <RealNominalToggle />
          <ShareButton />
        </div>
      </div>
    </header>
  );
}
