# Dark Mode Visual QA Checklist

Status: operator browser smoke review completed before merge.

This file records the final visual QA gate for the dark-mode UI/UX pass. Automated tests cover theme persistence, route switching, share-link behavior, dialog focus, chart rendering smoke coverage, and representative responsive class contracts, but the final browser review is intentionally operator-gated.

## Operator Browser Checklist

- [x] Basic view reviewed in light mode.
- [x] Basic view reviewed in dark mode.
- [ ] Advanced view reviewed in light mode, including custom law, manual plan, planner controls, planning charts, and scenarios tabs.
- [x] Advanced view reviewed in dark mode, including the advanced tab shell.
- [ ] Compare view reviewed in light mode with two saved local scenarios.
- [x] Compare view reviewed in dark mode in the no-saved-scenarios state.
- [ ] Methodology view reviewed in light mode.
- [x] Methodology view reviewed in dark mode.
- [ ] Share-link privacy modal, JSON export, and post-copy status reviewed in both themes.
- [ ] Staleness/custom-law banners reviewed where applicable in both themes.
- [x] Charts reviewed for basic dark-mode rendering and console health.
- [x] Header controls, mode navigation, advanced tabs, and compare empty state checked around 320px and desktop widths.
- [ ] Full keyboard walk-through across every form, modal action, table tooltip, link, and share/export control.

## Agent Verification Notes

- Theme preference is stored in `fire-planner.ui.v1`; scenario data and local saved scenarios remain in their existing storage keys.
- Added a regression test that switches to dark mode from the advanced view and verifies the current mode, nominal/real display preference, active scenario, active plan, local saved scenarios, and share-link payload remain intact.
- No financial math, routing, backend service, analytics, login, cloud sync, component-library dependency, Storybook, or visual-regression service was added.

## Remaining Caveat

The operator browser pass before merge was a smoke review, not exhaustive design QA. It covered fresh Tailwind dark-mode CSS, basic/advanced/methodology/compare surfaces, mobile wrapping at 320px, and console errors. A deeper manual pass through every advanced tab, saved-scenario compare path, share/export flow, tooltip, and keyboard path can still happen as follow-up.
