# Multi-Tenant Isolation Demo

Two storefronts running on **one shopG41 instance**, side by side. Each tenant
gets its own subdomain, products, CMS, API keys and custom endpoints — fully
isolated on shared infrastructure. Signups auto-provision tenants.

## What this demonstrates

1. **Tenant provisioning**: signing up a user auto-creates their store + subdomain
2. **Subdomain tenancy**: `alpha-store.localhost:3001` and `beta-store.localhost:3001`
   resolve to completely separate tenants
3. **Per-tenant data**: products, CMS collections/entries and custom endpoints
   never cross tenant boundaries
4. **Per-tenant API keys**: a key minted for Alpha cannot read Beta's data
   (returns 401/403), and vice versa

```
   One shopG41 instance (localhost:3001)
   ├── Tenant: Alpha Store  → alpha-store.localhost:3001
   │     products · CMS · custom endpoint /api/e/announcements · API key A
   └── Tenant: Beta Store   → beta-store.localhost:3001
         products · CMS · custom endpoint /api/e/announcements · API key B
           │
           ▼
   This app (localhost:3008) — compares both storefronts, cross-checks keys
```

## Run the demo

```bash
cd demos/multi-tenant
bun install
bun run dev        # http://localhost:3008
```

## Wire it up

Requirements: shopG41 running on `:3001`, plans seeded (`bun run seed-plans`),
valid Stripe test keys (signup creates a Stripe customer), and **email
verification off** — with a mailer configured the platform deliberately hands out
no session until the address is confirmed, so signup + key mint cannot be scripted
in one go. Locally that means starting the platform without `EMAIL_FROM` /
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.

```bash
bun run wire
```

The script signs up two users (with `subdomain` set), which auto-provisions the
two tenants, then mints an admin API key per tenant with `X-Tenant` (the session
cookie is scoped to the host it was issued on, so it is not valid on the store's
subdomain), seeds each with a product + CMS entry + custom endpoint, and writes
`keys.json`.

Subdomains are run-scoped (`alpha-<run>`, `beta-<run>`): subdomains and store
names are unique with no cascade delete, so fixed names would make the second run
fail. The script reads back what the platform actually provisioned, which may be
suffixed if a name is taken.

Then open http://localhost:3008:

- Add products to either storefront — they stay in their own tenant
- Hit **Cross-tenant check** — each key against the other store's **admin** API is
  blocked (`401`). The check must be an admin route: `/api/products` is public and
  answers by host for anyone, so a `200` there proves nothing.

You can also open the raw storefronts printed by `wire` (e.g.
`http://alpha-store-ab12cd.localhost:3001`).

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Bun server — reads `keys.json`, proxies per-tenant product APIs + cross-check |
| `frontend.tsx` | React app — side-by-side storefronts + cross-tenant check |
| `index.html` | Entry point with styles |
| `wire.ts` | Script to create both tenants, mint keys, seed data, write `keys.json` |
