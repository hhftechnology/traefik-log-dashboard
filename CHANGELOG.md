# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- Management routes under `/api/dashboard/agents` require `DASHBOARD_API_TOKEN`. API responses no longer include stored agent tokens.
- The dashboard proxies and stores agent URLs only when they match `DASHBOARD_PROXY_ALLOWLIST`.
- `GET` and `HEAD` `/api/dashboard/alerts` require `ALERTS_API_KEY` and fail closed when it is unset.
- The agent rejects protected requests when `TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN` is empty. Log filenames cannot leave the configured directory.
- body-parser is pinned to 1.20.9 (GHSA-27r3-jxmh-p828).
- http-proxy-middleware is pinned to 3.0.7 (GHSA-gcq2-9pq2-cxqm, GHSA-64mm-vxmg-q3vj).
- The TanStack Router dependency seroval is pinned to 1.6.12.
- The agent and CLI build with Go 1.26.10. `golang.org/x/sys` is v0.49.0.
- qs is pinned to 6.16.2. Non-breaking dependency updates are in the dashboard lockfile.

### Fixed

- Fully written IPv6 client addresses keep every hextet during lookup (Refs #232).
- The geographic map uses OpenStreetMap tiles instead of CARTO (Refs #229).
- `TRAEFIK_LOG_DASHBOARD_PORT` and `DASHBOARD_PORT` can be set without sharing `PORT` (Refs #217).
- `GET /health` reports dashboard process health without an agent id (Refs #216).

### Added

- Pull requests into `dev-fix` run the agent, CLI, and dashboard tests.
- Pull requests into `dev-fix` must keep an `Unreleased` section in this file unless they have the `skip-changelog` label.
- Version tags draft GitHub release notes from this file.
