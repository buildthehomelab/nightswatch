# Contributing to Nightswatch

Thanks for your interest. Nightswatch is a small, opinionated project. Contributions that sharpen its focus are welcome. Sprawl is not.

---

## Ground rules

- **Silence is the default.** New features should add information only when something needs attention, not always.
- **No new dependencies** without a strong reason. The stack is React 18 + Vite 5 + vanilla CSS. Keep it that way.
- **No Tailwind, no CSS-in-JS.** Styling lives in `src/index.css` as CSS custom properties.
- **No state management libraries.** `useState` / `useRef` / `useMemo` is the whole stack.
- **Services are pure.** Files in `src/services/` export data and hooks, with no JSX.

---

## Setup

**Docker:**
```sh
git clone https://github.com/your-username/nightswatch.git
cd nightswatch
cp .env.example .env.local
# fill in your values, or set DEMO=true
docker compose up
```

**Without Docker:**
```sh
git clone https://github.com/your-username/nightswatch.git
cd nightswatch
npm install
npm run setup    # installs git hooks
cp .env.example .env.local
# fill in your values, or set DEMO=true
npm run dev
```

---

## How to add a new integration

A "service" in Nightswatch is a file in `src/services/` that:
1. Fetches or derives data
2. Exports a `use<Name>()` hook that returns `{ data, err }`
3. Exports a `<name>Issues(data)` function that maps data → `Issue[]`

**The `Issue` shape:**

```js
{
  id:          string,          // unique, stable; used for ignore persistence
  severity:    'crit' | 'warn' | 'info',
  label:       string,          // short badge text (e.g. "pool degraded")
  headline:    string,          // one sentence, ends with a period
  source:      string,          // "service · subsystem"
  firstSeenTs: number | null,   // timestamp — drives age-based escalation
  when:        string,          // human-readable age (e.g. "2h unresolved")
  description: string,          // full detail, multi-line OK, \n respected
  logs:        { t: string, level: 'info'|'warn'|'err', text: string }[],
  ignoreKey:   string | null,   // null = not ignorable; string = persisted ignore key
  actions:     (string | { label: string, href: string })[],
}
```

**Wire it into `App.jsx`:**

```js
// 1. Import your hook and issues function
import { useMyService, myServiceIssues } from './services/myservice';

// 2. Call the hook (guarded by a setting toggle)
const { data: myData, err: myErr } = useMyService(t.enableMyService);

// 3. Add to the issues assembly in useMemo
const issues = useMemo(() => {
  const liveIssues = [
    ...nasIssues(nasData),
    ...myServiceIssues(myData),   // ← add here
    ...cveIssues(cveData, cveKeywords),
  ];
  // ...
}, [/* add myData, myErr to deps */]);
```

**Add a toggle in `CustomizePanel`** and a default in `CUSTOMIZE_DEFAULTS`.

Look at `src/services/cve.js` as the simplest complete example, and `src/services/truenas.js` for a more complex one with localStorage caching.

---

## Adding ambient popover content

Chips in the ambient strip that open popovers live in `src/components/AmbientPopover.jsx`. Each popover is a simple component using `Head`, `Row`, and `MiniBar` primitives already defined in that file.

---

## Phrases and copy

Phrases live in the `PHRASES` object in `src/App.jsx`. Each bucket is an array of strings — add to any bucket or add a new bucket (and a corresponding priority rule in `mastheadPhrase()`).

The project has a voice: dry, sardonic, a little tired. Keep it in that register.

---

## Code style

- No comments unless the *why* is non-obvious
- No TypeScript (plain JS)
- No default exports from services — named exports only
- Prefer editing existing files over adding new ones

Run `npm run lint` before submitting a PR. The pre-commit hook does this automatically.

---

## Pull requests

- One logical change per PR
- Include a short description of *why*, not just *what*
- If it changes visible UI, describe what to look for

---

## What we're not looking for

- New charting/graph libraries
- Real-time WebSocket streaming (polling is intentional)
- Mobile-first redesigns
- Dark-pattern alert noise (more always-visible widgets)
- Auth systems (use your reverse proxy)
