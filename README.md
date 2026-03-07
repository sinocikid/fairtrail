<div align="center">

# Fairtrail

**The price trail airlines don't show you.**

Track flight prices over time with shareable charts. Type where you're going in plain English, get a live-updating dashboard with price evolution, airline comparisons, and direct booking links.

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/affromero/fairtrail/pulls)

</div>

---

## Why Fairtrail?

Every flight price tracker gives you the same thing: "Alert me when it's cheap." But none of them let you *see* how prices evolve over time for your specific trip — and none give you a shareable link with that data.

**This isn't an accident.** The tools that have the data don't want you to see it:

1. **Aggregators want you inside their app.** Google Flights, Hopper, and Kayak all track price history internally — but lock the charts behind your account. A shareable link sends users to a page that isn't theirs. They lose the affiliate click.

2. **"Buy or Wait" is more profitable than transparency.** Hopper makes money when you book through them. Giving you a chart with direct airline links means they earn nothing. A black-box "95% accurate" prediction keeps you dependent on their platform.

3. **Airlines don't want price transparency.** If you can see that JFK → CDG always dips 3 weeks before departure, that undermines their dynamic pricing. That's partly why there's no public API for flight prices.

**Fairtrail exists because the data is useful to *you* — just not to the companies that have it.**

### What you get

- **Natural language search** — type `"NYC to Paris around June 15 ± 3 days"` and Fairtrail understands
- **Price evolution chart** — see exactly how fares move over days and weeks
- **Shareable link** — send `/q/abc123` to anyone, view on any device, no login required
- **Direct booking links** — click any data point to go straight to the airline
- **Airline comparison** — see which carriers are cheapening vs. getting more expensive
- **Auto-expiry** — tracker links expire after the last travel date

## How It Works

```
You type: "SFO to Tokyo sometime in July ± 5 days"
                        │
                        ▼
              ┌─────────────────┐
              │   LLM Parser    │  Extracts origin, destination,
              │  (Claude/GPT)   │  date range, flexibility
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Playwright    │  Navigates Google Flights
              │   (headless)    │  with your exact query
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  LLM Extractor  │  Reads the page, extracts
              │  (configurable) │  structured price data
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   PostgreSQL    │  Stores price snapshots
              │   + Prisma     │  with timestamps
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Plotly.js      │  Interactive chart at
              │  /q/[id]       │  a shareable public URL
              └─────────────────┘
```

The scraper runs on a configurable interval (1h–24h, set via admin panel). Each run captures prices across all active queries, stores snapshots, and the chart page updates automatically.

## Tech Stack

| Layer | Technology | Cost |
|-------|------------|------|
| Frontend | Next.js 15, App Router, TypeScript, CSS Modules | Free |
| Database | PostgreSQL 16 + Prisma ORM | Free (self-hosted) |
| Cache | Redis 7 | Free (self-hosted) |
| Browser | Playwright (headless Chromium) | Free |
| Extraction | LLM — Anthropic, OpenAI, Google, or Claude Code | **Only cost** |
| Charts | Plotly.js (interactive) | Free |
| Cron | systemd timer | Free |
| Hosting | Docker + Caddy @ [fairtrail.org](https://fairtrail.org) | Free (existing VPS) |
| Secrets | Doppler | Free tier |

## Quick Start

```bash
# Clone
git clone git@github.com:affromero/fairtrail.git
cd fairtrail

# Install
npm install

# Database + cache
docker compose -f docker-compose.prod.yml up -d db redis

# Schema
npx prisma db push --schema=apps/web/prisma/schema.prisma
npx prisma generate --schema=apps/web/prisma/schema.prisma

# Run (requires Doppler — or copy .env.example to .env)
npm run dev
```

## Architecture

```
fairtrail/
├── apps/web/                 # Next.js 15 app (@fairtrail/web)
│   ├── src/app/              # Pages + API routes
│   │   ├── page.tsx          # Landing — natural language search bar
│   │   ├── q/[id]/           # Public shareable chart page
│   │   ├── admin/            # Admin panel (LLM config, queries, costs)
│   │   └── api/              # REST endpoints
│   ├── src/components/       # UI components (SearchBar, PriceChart, etc.)
│   ├── src/lib/              # Core logic
│   │   ├── scraper/          # Playwright + LLM extraction pipeline
│   │   ├── prisma.ts         # Database client
│   │   ├── redis.ts          # Cache client
│   │   └── admin-auth.ts     # Session management
│   └── prisma/schema.prisma  # Database models
├── infra/                    # systemd timer + service
├── Dockerfile                # Multi-stage build with Chromium
├── docker-compose.prod.yml   # PostgreSQL, Redis, web
├── Caddyfile                 # Reverse proxy config
└── README.md
```

## Environment Variables

All secrets managed via **Doppler** (project: `fairtrail`, config: `dev`). Shared LLM keys from `pricetoken` project.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection |
| `ANTHROPIC_API_KEY` | Claude API key (shared with pricetoken) |
| `OPENAI_API_KEY` | GPT API key (shared with pricetoken) |
| `GOOGLE_AI_API_KEY` | Gemini API key (shared with pricetoken) |
| `CLAUDE_CODE_ENABLED` | Enable Claude Code CLI extraction |
| `ADMIN_PASSWORD` | Admin panel login |
| `ADMIN_SESSION_SECRET` | HMAC session signing (32-byte hex) |
| `CRON_SECRET` | Bearer token for cron endpoint |

## Admin Panel

Access at `/admin` to:

- **Manage queries** — pause, resume, delete, adjust scrape frequency per query
- **Configure LLM** — choose extraction provider and model (Anthropic, OpenAI, Google, Claude Code)
- **Monitor costs** — see LLM API usage per scrape run
- **View fetch history** — success/failure status, errors, snapshot counts

## License

MIT
