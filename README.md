# dev-footprint

> Audit developer tool disk usage on macOS — find what's eating your disk and reclaim space safely.

[![npm version](https://img.shields.io/npm/v/dev-footprint)](https://www.npmjs.com/package/dev-footprint)
[![license](https://img.shields.io/npm/l/dev-footprint)](LICENSE)
![macOS only](https://img.shields.io/badge/platform-macOS-lightgrey)

<!-- Screenshot of the HTML report (Overview tab) -->
<!-- ![dev-footprint report](docs/screenshot.png) -->

## Highlights

- **Read-only by design** — scans and reports, never modifies your filesystem
- **18 scanner categories** covering dev tools most cleanup utilities miss (Rust, Ruby, Go, Bun/Deno, iOS backups, VS Code internals)
- **Cross-repo duplicate detection** — finds identical packages installed across multiple projects
- **Interactive HTML report** — 4-tab dashboard (Overview, Categories, Shared Packages, Cleanup) with charts, shareable as a standalone file
- **Deep Claude Code audit** — Desktop app, CLI, VS Code extension, browser extensions, skills, plugins, config, temp files
- **Safe-to-clean suggestions** with copy-paste commands — you decide what to run
- **CI-friendly** — structured JSON output and exit codes for automation
- **Ubersicht desktop widget** — always-visible footprint summary on your desktop

## Prerequisites

- **macOS** (the tool scans macOS-specific paths)
- **Node.js >= 18**

## Install

```bash
npm install -g dev-footprint
```

## Usage

```bash
dev-footprint                                     # open HTML report in browser
dev-footprint --terminal                          # full terminal report
dev-footprint --json                              # JSON output to stdout
dev-footprint --stale                             # only show stale/safe-to-clean items
dev-footprint --scan-dirs ~/work,~/personal       # custom scan roots
dev-footprint --project ./my-app                  # scan a single project
```

The default command scans your system, generates an HTML report, and opens it in your browser.

## What it scans

| Category | What's scanned |
|----------|----------------|
| **Claude Code** | Config, Desktop app, CLI binaries, VS Code extension, browser extensions, skills, plugins, temp files |
| **Node Modules** | All `node_modules/` directories + cross-repo duplicate detection |
| **Xcode** | DerivedData, Archives, CoreSimulator devices and caches |
| **VS Code** | Extensions, workspace storage, caches, logs |
| **Python** | Virtual environments, pip cache, conda envs, pyenv versions |
| **Git** | `.git/` directories across all repos |
| **Homebrew** | Cellar (installed formulas), download cache |
| **Docker** | Docker Desktop data, `~/.docker/` config |
| **Package Caches** | npm, Yarn, pnpm store |
| **CocoaPods** | Pods cache and repo specs |
| **Rust** | Cargo registry, target directories |
| **Go** | GOPATH, module cache |
| **Ruby** | Gems, rbenv/rvm versions |
| **Android** | Android SDK, AVD emulators, Gradle cache |
| **Bun & Deno** | Bun install cache, Deno cache |
| **iOS Backups** | `~/Library/Application Support/MobileSync/Backup/` |
| **System Caches** | `~/Library/Caches/` entries |
| **Trash** | `~/.Trash/` contents |

## Scan roots

By default, dev-footprint scans directories that exist from: `~/Repositories`, `~/Projects`, `~/Developer`, `~/Code`, `~/workspace`, `~/repos`, `~/src`.

Override with `--scan-dirs`:

```bash
dev-footprint --scan-dirs ~/work,~/personal
```

## Ubersicht widget

An [Ubersicht](https://tracesof.net/uebersicht/) desktop widget that shows your footprint summary at a glance.

**Setup:**

1. Install [Ubersicht](https://tracesof.net/uebersicht/) if you haven't already
2. Symlink the widget:
   ```bash
   ln -s "$(pwd)/widget/dev-footprint.widget" \
     "$HOME/Library/Application Support/Übersicht/widgets/dev-footprint.widget"
   ```
3. Run `dev-footprint` to populate the cache — the widget reads `~/.dev-footprint/cache.json`
4. Click the widget to open the full HTML report

## Exit codes

| Code | Meaning |
|------|---------|
| `0`  | Reclaimable space under 1 GB |
| `1`  | Reclaimable space is 1 GB or more |

Useful for CI or scripted checks. Use `--json` for machine-readable output.

## FAQ

**Does this delete anything?**
No. dev-footprint is strictly read-only — it never modifies, moves, or deletes files. Cleanup commands are shown as suggestions you can review and run yourself. This makes it safe to use in CI pipelines, shared environments, or anywhere you want visibility without risk.

**How is this different from system cleanup tools?**
Most cleanup tools focus on action — they find files and delete them. dev-footprint focuses on *understanding*. It gives you a detailed breakdown of where your disk space is going across your entire dev environment, with per-location sizes, cross-repo duplicate analysis, and a persistent HTML report you can share or revisit. You stay in control of what gets cleaned.

**What does "shared packages" mean?**
dev-footprint detects identical packages (same name and version) installed in `node_modules/` across 3 or more projects. This helps you understand how much disk space is used by redundant copies and whether a monorepo or shared cache strategy could help.

**Can I use this in CI?**
Yes. Use `--json` for structured output. The process exits with code `1` when reclaimable space exceeds 1 GB, making it easy to set up alerts or quality gates.

**Does it work on Linux or Windows?**
No. It scans macOS-specific paths (`~/Library/`, Xcode, Homebrew, etc.).

**How long does a scan take?**
A few seconds on most machines.

**Where is the cache stored?**
`~/.dev-footprint/cache.json` (scan data) and `~/.dev-footprint/report.html` (last report). Both are readable only by your user account.

## License

[MIT](LICENSE)
