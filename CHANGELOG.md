# Changelog

## [0.1.0] - 2026-03-08

### Added
- Natural language flight search powered by LLM (Anthropic, OpenAI, Google AI)
- Automated price tracking via Google Flights scraping (Playwright + headless Chromium)
- Interactive Plotly.js price evolution charts with airline colors and click-to-book
- Self-hosted Docker installer (`curl -fsSL https://fairtrail.org/install.sh | sh`)
- `fairtrail` CLI for managing self-hosted instances (start, stop, logs, search)
- Multi-currency support with locale auto-detection
- Multiple travel date support with date grouping in charts
- Price drop alerts on home page
- Share links, CSV export, and price calendar on chart pages
- Community route sharing between self-hosted instances
- Explore page with seed routes and popular destinations
- Admin dashboard with query management, LLM config, and cost tracking
- PWA support with auto-update banner
- Configurable scrape interval (default 3h)
- GitHub Actions CI/CD with Docker image publishing to GHCR
