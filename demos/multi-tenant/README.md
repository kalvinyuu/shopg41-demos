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
and valid Stripe test keys (signup creates a Stripe customer).

```bash
bun run wire
```

The script signs up two users (with `subdomain` set), which auto-provisions
the two tenants, then mints an admin API key per tenant, seeds each with a
product + CMS entry + custom endpoint, and writes `keys.json`.

Then open http://localhost:3008:

- Add products to either storefront — they stay in their own tenant
- Hit **Cross-tenant check** — Alpha's key against Beta's host is blocked

You can also open the raw storefronts:
`http://alpha-store.localhost:3001` and `http://beta-store.localhost:3001`

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Bun server — reads `keys.json`, proxies per-tenant product APIs + cross-check |
| `frontend.tsx` | React app — side-by-side storefronts + cross-tenant check |
| `index.html` | Entry point with styles |
| `wire.ts` | Script to create both tenants, mint keys, seed data, write `keys.json` |
