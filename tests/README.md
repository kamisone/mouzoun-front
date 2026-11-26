# Front-end tests

| Suite | Where | Runs against | Command |
|---|---|---|---|
| Unit + component (vitest) | `tests/unit`, `tests/components` | happy-dom, mocked composables | `npm test` |
| Mocked Playwright | `tests/e2e` | the built front, API mocked with `page.route` | `npm run build && npm run test:e2e` |
| Full stack Playwright | `tests/fullstack` | the built front, the real API, Postgres, Redis, Mailpit | see below |

## Full-stack stack

The suite runs against a throwaway database, never the development one:

```sh
(cd ../back && cargo build --bin mouzoun-api --bin seed_dev)
export E2E_STAFF_EMAIL=e2e-staff@mouzoun.test E2E_STAFF_PASSWORD='…'
tests/fullstack/scripts/stack.sh prepare   # new database `mouzoun_e2e`, seed, staff account, empties Redis index 11
tests/fullstack/scripts/stack.sh api       # API on :18090 (leave it running)
npm run build
npx playwright test -c playwright.fullstack.config.ts
```

`stack.sh` sources `back/.env` without printing it, then overrides what the tests need: its own
database and Redis index, `PAYMENTS_FAKE`, CORS for :3210, and **blank `SMTP_USER` /
`SMTP_PASSWORD`**. Mailpit refuses SMTP authentication, so with the `.env` credentials every
email would fail. The overrides are exported, so the API's own `.env` loading never replaces
them.

## Cookie consent fixture

Both Playwright suites import `test` and `expect` from their `fixtures.ts`, never from
`@playwright/test`. The `consent` option (default `'granted'`) starts every browser context with
the cookie choice already made, written as the app writes it: local storage `mz-consent` +
`mz-consent-at` (`app/utils/consent.ts`; the choice is not a cookie). Pages therefore open without
the banner, and no spec clicks "Tout accepter" to get rid of it. `consent.spec.ts` is the only spec
about the banner. It uses `test.use({ consent: null })`.

## Dialog locators are named

A dialog is always located by its accessible name, never with a bare
`page.getByRole('dialog')`, which matches whatever dialog happens to be open (until recently the
cookie banner was one). Names come from the locale files through `tests/i18n.ts`, so a wording
change cannot break a test silently:

```ts
import { tr } from '../i18n'
const drawer = page.getByRole('dialog', { name: tr('fr', 'shop.cart.title') })
```

A dialog named after content uses that content: the slot picker of the funnel is named after
the activity, read from the row that opens it.

## Global state: declare it, the fixture restores it

The suite shares one database, so a spec that changes something global must leave it as it was.
The `shop` fixture (`tests/fullstack/fixtures.ts`) does this for the shop:

- `test.use({ shopMode: 'catalog_only' | 'open' | 'closed' })` at the top of a spec sets the
  mode before each test, through the admin API (so cache invalidation and outbox events run as
  for the admin screen). It then waits until the public API and the server-rendered `/boutique`
  show it (`expect.poll`, no sleep).
- `shop.mode('open')` mid-test does the same, after making the shop compliant (French legal
  entity, confirmed tax rates, card payments, mediator, food information).
- `shop.remember()` records the same state for a spec that edits it through the UI
  (`legal-entity.spec.ts`).
- After the test, even a failed one, everything recorded goes back: the mode, the legal entity,
  the tax-rate confirmations, the settings and the products' food information. So `shop.spec.ts`
  always starts from the seed's placeholders and can check that opening is refused.

Every spec that needs a shop mode declares it: `shop`, `shop-section`, `categories` and `seo`
(`catalog_only`). Data a spec creates uses names unique to the run (time-based stamps). The
purchase uses one unit of each Medjool variant, which the seed stocks plentifully. The database
is never reset between specs.

## Serial project

`playwright.fullstack.config.ts` keeps `workers: 1` for the whole suite: one database means specs
that publish the same builder page or change shop settings would race. The specs that change the
shop's global state also share one project, `shop-state` (`shop`, `shop-section`, `legal-entity`),
with `workers: 1` and `fullyParallel: false`, so they stay serial even if the global limit is
raised.

The setup project reuses the staff session saved by the previous run while the API still accepts
it, so several runs in a row do not hit the sign-in rate limit.

## Order check

A spec must pass alone and after any other one. `--repeat-each=2 --workers=1` runs the
`shop-state` files in both orders (shop-section → shop, then shop → shop-section). For the
other combinations, `tests/fullstack/scripts/order-check.mjs` runs the shop, shop-section,
guest-deposit and consent specs one per invocation against the same database. The sequence makes
every ordered pair of the four appear back to back (12 pairs, 13 runs):

```sh
E2E_STAFF_EMAIL=… E2E_STAFF_PASSWORD=… node tests/fullstack/scripts/order-check.mjs
```

It prints each run with the spec before it, and exits non-zero if any run failed.
