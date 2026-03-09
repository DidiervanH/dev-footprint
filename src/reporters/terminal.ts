import chalk from "chalk";
import type { FootprintReport, ReclaimableItem } from "../types.js";
import { formatBytes, MINOR_CATEGORY_THRESHOLD } from "../utils.js";

const ONE_GB = 1024 * 1024 * 1024;

/**
 * Prints a colored terminal report of the footprint audit.
 * When staleOnly is true, only shows safe-to-clean items and summary.
 */
export function reportTerminal(report: FootprintReport, staleOnly: boolean): void {
  printBanner();

  if (!staleOnly) {
    printCategories(report);
    if (report.duplicate_packages && report.duplicate_packages.length > 0) {
      printDuplicates(report);
    }
  }

  printSafeToClean(report);
  printSummary(report);
}

function printBanner(): void {
  console.log();
  console.log(chalk.bold("╔══════════════════════════════════════╗"));
  console.log(chalk.bold("║        Dev Footprint Audit           ║"));
  console.log(chalk.bold("╚══════════════════════════════════════╝"));
  console.log();
}

function printCategories(report: FootprintReport): void {
  console.log(chalk.bold("DISK USAGE BY CATEGORY"));
  console.log();

  const major = report.categories.filter((cat) => cat.total_bytes >= MINOR_CATEGORY_THRESHOLD);
  const minor = report.categories.filter((cat) => cat.total_bytes < MINOR_CATEGORY_THRESHOLD);

  for (const cat of major) {
    const sizeStr = formatBytes(cat.total_bytes).padStart(10);
    const countStr = chalk.dim(`(${cat.location_count} items)`);
    console.log(chalk.bold(`  ${cat.label.padEnd(30)} ${sizeStr}  ${countStr}`));

    // Show top children (up to 5)
    const children = cat.locations
      .slice()
      .sort((a, b) => b.size_bytes - a.size_bytes)
      .slice(0, 5);

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const isLast = i === children.length - 1;
      const prefix = isLast ? "└── " : "├── ";
      const childSize = formatBytes(child.size_bytes).padStart(10);

      let displayPath = child.path;
      if (displayPath.length > 45) {
        displayPath = `...${displayPath.slice(displayPath.length - 42)}`;
      }

      console.log(`    ${prefix}${displayPath.padEnd(36)} ${childSize}`);
    }

    if (cat.locations.length > 5) {
      console.log(chalk.dim(`    ... and ${cat.locations.length - 5} more`));
    }

    console.log();
  }

  if (minor.length > 0) {
    const minorTotal = minor.reduce((sum, c) => sum + c.total_bytes, 0);
    console.log(
      chalk.dim(`  + ${minor.length} minor categories (${formatBytes(minorTotal)} total)`),
    );
    console.log();
  }
}

function printDuplicates(report: FootprintReport): void {
  if (!report.duplicate_packages) return;

  const dupes = report.duplicate_packages
    .slice()
    .sort((a, b) => b.total_wasted_bytes - a.total_wasted_bytes);

  const top = dupes.slice(0, 10);
  const totalDuplicated = dupes.reduce((sum, d) => sum + d.total_wasted_bytes, 0);

  console.log(chalk.bold("SHARED ACROSS REPOS (top 10)"));
  console.log(chalk.dim(`  ${dupes.length} packages duplicated across repos`));
  console.log();

  for (const dupe of top) {
    const dupeStr = formatBytes(dupe.total_wasted_bytes).padStart(10);
    console.log(
      chalk.yellow(
        `  ${(`${dupe.name}@${dupe.version}`).padEnd(40)} ${dupeStr} duplicated  (${dupe.locations.length} copies)`,
      ),
    );
    // Show which repos
    const repos = dupe.locations.map((loc) => {
      const parts = loc.replace(/\/node_modules$/, "").split("/");
      return parts[parts.length - 1];
    });
    const repoList =
      repos.length <= 4
        ? repos.join(", ")
        : `${repos.slice(0, 3).join(", ")} +${repos.length - 3} more`;
    console.log(chalk.dim(`    in: ${repoList}`));
  }

  if (dupes.length > 10) {
    console.log(chalk.dim(`  ... and ${dupes.length - 10} more`));
  }

  console.log(`  ${"─".repeat(55)}`);
  console.log(
    chalk.bold(`  ${"Total duplicated:".padEnd(40)} ${formatBytes(totalDuplicated).padStart(10)}`),
  );
  console.log(chalk.dim("  Tip: pnpm or bun can deduplicate via shared stores"));
  console.log();
}

function printSafeToClean(report: FootprintReport): void {
  const items = report.safe_to_clean.items;
  const totalBytes = report.safe_to_clean.total_bytes;

  console.log(chalk.bold("SAFE TO CLEAN"));

  if (items.length === 0) {
    console.log(chalk.dim("  No safe-to-clean items found."));
    console.log();
    return;
  }

  const sorted = [...items].sort((a, b) => b.size_bytes - a.size_bytes).slice(0, 15);

  for (const item of sorted) {
    const sizeStr = formatBytes(item.size_bytes).padStart(10);
    const reasonStr = formatReason(item);
    let displayPath = item.path;
    if (displayPath.length > 45) {
      displayPath = `...${displayPath.slice(displayPath.length - 42)}`;
    }
    console.log(chalk.yellow(`  ${displayPath.padEnd(40)} ${sizeStr}  ${reasonStr}`));
    if (item.suggestion) {
      console.log(chalk.dim(`    → ${item.suggestion}`));
    }
  }

  if (items.length > 15) {
    console.log(chalk.dim(`  ... and ${items.length - 15} more items`));
  }

  console.log(`  ${"─".repeat(55)}`);

  const totalStr = formatBytes(totalBytes).padStart(10);
  const colorFn = totalBytes > ONE_GB ? chalk.bold.red : chalk.bold;
  console.log(colorFn(`  ${"Safe to clean:".padEnd(40)} ${totalStr}`));
  console.log();
}

function formatReason(item: ReclaimableItem): string {
  switch (item.reason) {
    case "stale_version":
      return "stale version";
    case "old_extension":
      return "old extension";
    case "temp_file":
      return "temp files";
    case "debug_log":
      return "debug logs";
    case "cache":
      return "cache";
    case "derived_data":
      return "derived data";
    case "old_simulator":
      return "old simulator";
    case "duplicate_package":
      return "duplicate";
    case "docker_cache":
      return "Docker cache";
    case "brew_cache":
      return "Homebrew cache";
    case "system_cache":
      return "system cache";
    case "trash":
      return "trash";
    case "ios_backup":
      return "iOS backup";
    default:
      return String(item.reason);
  }
}

function printSummary(report: FootprintReport): void {
  console.log(chalk.bold("SUMMARY"));
  console.log(`  Total Dev Storage:  ${formatBytes(report.total_bytes).padStart(10)}`);
  console.log(
    `  Safe to clean:      ${formatBytes(report.safe_to_clean.total_bytes).padStart(10)}`,
  );
  console.log(`  Categories:         ${String(report.categories.length).padStart(10)}`);
  console.log();
}
