# fire-planner

A static, client-side FIRE (Financial Independence / Retire Early) withdrawal-strategy planner. Models year-by-year federal/SE/LTCG taxes, MAGI thresholds, ACA premium tax credits, IRMAA tiers, and tax-aware planner moves (Roth-conversion ladder targeting and 0%-LTCG harvesting) for U.S. filers.

**Live:** [fire.gauravraj.tech](https://fire.gauravraj.tech)

## Status

Pre-v1, in active development. The site is currently a placeholder with the persistent disclaimer; tax math and UI land incrementally.

## Disclaimer

Educational estimate only. Not tax, legal, investment, or filing advice. Do not make tax elections (Roth conversions, withdrawals, harvesting) from this output without verifying official IRS/state sources or a qualified professional.

## Stack

- **Vite + React 18 + TypeScript (strict)** — client-only, no backend, no auth, no data leaves the browser
- **Tailwind CSS** for styling
- **Recharts** for charts
- **Zustand** for state (with `localStorage` persistence and URL-hash sharing)
- **Vitest** + **@testing-library/react** for tests

All tax-math logic lives in `src/core/` as pure TypeScript with no React/DOM/I/O imports. Constants for 2026 are sealed, deep-frozen, and tagged with primary-source URLs in `src/core/constants/2026.ts`.

## Local development

```bash
npm install
npm run dev      # local dev server
npm test         # run all tests
npm run build    # production build (tsc --noEmit + vite build)
```

## Default layout

New browsers now open to the answer-first Verdict layout. The Classic/Verdict toggle remains in the header, so anyone who prefers the older detailed workstation can switch back to Classic; explicit saved layout preferences are preserved.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which runs the test suite, builds the site, and deploys `dist/` to GitHub Pages. The site is served from a custom domain via the `public/CNAME` file.

## License

[MIT](./LICENSE) © 2026 Gaurav Raj
