#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

import { analyzeStale, getReclaimableTotal } from "./analyzers/stale.js";
import { reportHtml } from "./reporters/html.js";
import { reportJson } from "./reporters/json.js";
import { reportTerminal } from "./reporters/terminal.js";
import { scanAndroid } from "./scanners/android.js";
import { scanBunDeno } from "./scanners/bun-deno.js";
import { scanClaude } from "./scanners/claude.js";
import { scanCocoaPods } from "./scanners/cocoapods.js";
import { scanDocker } from "./scanners/docker.js";
import { scanGitRepos } from "./scanners/git-repos.js";
import { scanGo } from "./scanners/go.js";
import { scanHomebrew } from "./scanners/homebrew.js";
import { scanIOSBackups } from "./scanners/ios-backups.js";
import { scanNodeModules } from "./scanners/node-modules.js";
import { scanPackageCaches } from "./scanners/package-caches.js";
import { scanProject } from "./scanners/project.js";
import { scanPython } from "./scanners/python.js";
import { scanRuby } from "./scanners/ruby.js";
import { scanRust } from "./scanners/rust.js";
import { scanSystemCaches } from "./scanners/system-caches.js";
import { scanTrash } from "./scanners/trash.js";
import { scanVSCodeFull } from "./scanners/vscode-full.js";
import { scanXcode } from "./scanners/xcode.js";
import type { CategorySummary, FootprintReport, ScannedLocation } from "./types.js";
import { formatBytes, getDefaultScanRoots } from "./utils.js";

// ── Progress indicator ──────────────────────────────────────────────
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerIdx = 0;

function progress(step: number, total: number, label: string, silent: boolean): void {
  if (silent) return;
  const frame = SPINNER[spinnerIdx % SPINNER.length];
  spinnerIdx++;
  const pad = String(step).padStart(String(total).length, " ");
  process.stderr.write(`\r\x1b[K${frame} [${pad}/${total}] Scanning ${label}...`);
}

function progressDone(silent: boolean): void {
  if (silent) return;
  process.stderr.write("\r\x1b[K");
}

interface CliOptions {
  json?: boolean;
  terminal?: boolean;
  stale?: boolean;
  project?: string;
  scanDirs?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  claude: "Claude Code",
  node_modules: "Node Modules",
  xcode: "Xcode & Simulators",
  python: "Python",
  vscode: "VS Code",
  git: "Git Repositories",
  homebrew: "Homebrew",
  docker: "Docker",
  temp: "Temp Files",
  package_caches: "Package Manager Caches",
  cocoapods: "CocoaPods",
  rust: "Rust / Cargo",
  go: "Go",
  ruby: "Ruby / Gems",
  android: "Android / Gradle",
  ios_backups: "iOS Backups",
  bun_deno: "Bun / Deno",
  system_caches: "System Caches",
  trash: "Trash",
};

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("dev-footprint")
    .description(
      "Audit developer tool disk usage on macOS — see what's stored where and what's safe to clean",
    )
    .version(packageJson.version)
    .option("--json", "Output report as JSON to stdout")
    .option("--terminal", "Show full terminal report")
    .option("--stale", "Only show stale items and safe-to-clean summary")
    .option("--project <path>", "Scan a specific project directory")
    .option(
      "--scan-dirs <paths>",
      "Comma-separated root directories to scan for repos (default: auto-detect)",
    );

  program.parse();

  const opts = program.opts<CliOptions>();

  // Determine scan roots for repo-level scanners
  const scanRoots = opts.scanDirs
    ? opts.scanDirs.split(",").map((s) => s.trim())
    : getDefaultScanRoots();

  const silent = !!opts.json;
  const total = 18;
  let step = 0;

  // Step 1: Run all scanners with progress
  progress(++step, total, "Claude Code", silent);
  const claudeResult = await scanClaude();
  progress(++step, total, "node_modules", silent);
  const nodeModulesResult = scanNodeModules(scanRoots);
  progress(++step, total, "Xcode", silent);
  const xcodeLocation = scanXcode();
  progress(++step, total, "Python", silent);
  const pythonLocation = scanPython(scanRoots);
  progress(++step, total, "VS Code", silent);
  const vscodeLocation = scanVSCodeFull();
  progress(++step, total, "Git repos", silent);
  const gitLocation = scanGitRepos(scanRoots);
  progress(++step, total, "Docker", silent);
  const dockerLocation = scanDocker();
  progress(++step, total, "Homebrew", silent);
  const homebrewLocation = scanHomebrew();
  progress(++step, total, "package caches", silent);
  const packageCachesLocation = scanPackageCaches();
  progress(++step, total, "CocoaPods", silent);
  const cocoapodsLocation = scanCocoaPods(scanRoots);
  progress(++step, total, "Rust", silent);
  const rustLocation = scanRust();
  progress(++step, total, "Go", silent);
  const goLocation = scanGo();
  progress(++step, total, "Ruby", silent);
  const rubyLocation = scanRuby();
  progress(++step, total, "Android", silent);
  const androidLocation = scanAndroid();
  progress(++step, total, "iOS backups", silent);
  const iosBackupsLocation = scanIOSBackups();
  progress(++step, total, "Bun & Deno", silent);
  const bunDenoLocation = scanBunDeno();
  progress(++step, total, "system caches", silent);
  const systemCachesLocation = scanSystemCaches();
  progress(++step, total, "Trash", silent);
  const trashLocation = scanTrash();
  progressDone(silent);

  // Collect all top-level category locations
  const categoryLocations: ScannedLocation[] = [
    claudeResult.location,
    nodeModulesResult.location,
    xcodeLocation,
    pythonLocation,
    vscodeLocation,
    gitLocation,
    homebrewLocation,
    dockerLocation,
    claudeResult.tempLocation,
    packageCachesLocation,
    cocoapodsLocation,
    rustLocation,
    goLocation,
    rubyLocation,
    androidLocation,
    iosBackupsLocation,
    bunDenoLocation,
    systemCachesLocation,
    trashLocation,
  ];

  // Handle project scanner if --project is given
  if (opts.project) {
    const projectResult = scanProject(opts.project);
    if (projectResult) {
      categoryLocations.push(projectResult);
    }
  }

  // Step 2: Build category summaries
  const allLocations = categoryLocations.filter((loc) => loc.size_bytes > 0);
  allLocations.sort((a, b) => b.size_bytes - a.size_bytes);

  const safeToCleanItems = analyzeStale(categoryLocations);
  const safeToCleanTotal = getReclaimableTotal(safeToCleanItems);

  // Build per-category safe-to-clean map
  const cleanByCategory = new Map<string, number>();
  for (const item of safeToCleanItems) {
    const cat = item.category || "unknown";
    cleanByCategory.set(cat, (cleanByCategory.get(cat) || 0) + item.size_bytes);
  }

  const categories: CategorySummary[] = categoryLocations
    .filter((loc) => loc.size_bytes > 0)
    .sort((a, b) => b.size_bytes - a.size_bytes)
    .map((loc) => ({
      category: loc.category,
      label: CATEGORY_LABELS[loc.category] || loc.category,
      total_bytes: loc.size_bytes,
      reclaimable_bytes: cleanByCategory.get(loc.category) || 0,
      location_count: loc.children?.length || 1,
      locations: loc.children || [loc],
    }));

  const totalBytes = categoryLocations.reduce((sum, loc) => sum + loc.size_bytes, 0);

  // Step 3: Build the report
  const report: FootprintReport = {
    scan_date: new Date().toISOString(),
    total_bytes: totalBytes,
    categories,
    claude: {
      installation: claudeResult.installation,
      skills: claudeResult.skills,
      plugins: claudeResult.plugins,
    },
    duplicate_packages: nodeModulesResult.duplicates,
    locations: allLocations,
    temp_files: claudeResult.tempDetails,
    safe_to_clean: {
      total_bytes: safeToCleanTotal,
      items: safeToCleanItems,
    },
  };

  // Write cache files for the Übersicht widget
  const cacheDir = path.join(os.homedir(), ".dev-footprint");
  const cachePath = path.join(cacheDir, "cache.json");
  const htmlCachePath = path.join(cacheDir, "report.html");
  try {
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(cachePath, reportJson(report), {
      encoding: "utf-8",
      mode: 0o600,
    });
    fs.writeFileSync(htmlCachePath, reportHtml(report), {
      encoding: "utf-8",
      mode: 0o600,
    });
  } catch {
    // non-fatal — widget cache is best-effort
  }

  // Step 4: Output
  if (opts.json) {
    console.log(reportJson(report));
  } else if (opts.stale) {
    reportTerminal(report, true);
  } else if (opts.terminal) {
    reportTerminal(report, false);
  } else {
    // Default: write HTML report, open in browser, print one-line summary
    const html = reportHtml(report);
    const outputPath = htmlCachePath;
    fs.writeFileSync(outputPath, html, { encoding: "utf-8", mode: 0o600 });
    try {
      execFileSync("open", [outputPath]);
    } catch {
      // non-fatal if open fails
    }
    console.log(
      `Dev Storage: ${formatBytes(totalBytes)} total, ${formatBytes(safeToCleanTotal)} safe to clean — report opened in browser`,
    );
  }

  // Step 5: Exit code based on safe-to-clean space
  const ONE_GB = 1_073_741_824;
  if (safeToCleanTotal >= ONE_GB) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
