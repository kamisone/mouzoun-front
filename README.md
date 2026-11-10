# Mouzoun — front (Vue / Nuxt 4)

Nuxt 4 (Vue 3) · Tailwind CSS 4 · @nuxtjs/i18n (fr default, en)

One app, two parts:

- **Public site**: `/fr/...`, `/en/...`, server-rendered for SEO, HTML cached with stale-while-revalidate (`routeRules` in `nuxt.config.ts`).
- **Admin**: `/admin/...`, client-rendered SPA, not localized, noindex, protected by the `admin-auth` middleware (JWT from the API).

## Run locally

```bash
cp .env.example .env
npm install
npm run dev            # http://localhost:3001  (needs the back API on :8080)
```

Admin login: http://localhost:3001/admin/login with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` set in `back/.env`.

## Structure

```
app/
  pages/            public pages (localized) + pages/admin/* (definePageMeta({ i18n: false }))
  layouts/          default (site) and admin
  components/       SiteHeader, SiteFooter, ActivityCard, AdminActivityForm
  composables/      useApiBase, useActivities, useAuth / useAdminApi
  middleware/       admin-auth
  utils/types.ts    API types
i18n/locales/       fr.json, en.json
```

Requires Node `^22.21 || ^24.11 || >=26`.

## CI/CD — push to `dev` = deployed

`.github/workflows/deploy-dev.yml`: typecheck + build → image `<DOCKER_HUB_USERNAME>/mouzoun_front:v<run_number>`
→ `deploy/deploy.sh` on the VPS: zero-downtime blue/green (127.0.0.1:13001 / :13002), health gate on
`/healthz` plus a real server-side render of `/fr`, then both colors serve for 15 s and the old one is
stopped. The front never touches nginx (owned by the back repo, which lists both front ports).

Server-side rendering calls the API through nginx's loopback listener `127.0.0.1:18080`, so it always
reaches the live back release. The front can be deployed before or after the back.

GitHub → Settings → Environments → `dev`: existing secrets `SERVER_HOST`, `SERVER_USER`,
`SERVER_SSH_PRIVATE_KEY`, `SERVER_USER_PASSWORD`, `DOCKER_HUB_USERNAME`, `DOCKER_HUB_PASSWORD`;
**to add**: `APP_URL` (e.g. `https://mouzoun.com`). The front has no secrets and no env file:
`deploy.sh <image> <APP_URL>` derives the public URLs and the API URL (`<APP_URL>/api`)
and passes them to the container.
Rollback: Actions → "CI/CD - DEV - FRONT" → Run workflow → `image_tag: v41`.
Full server setup: see the back README.

