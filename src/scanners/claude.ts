import type { Installation, InstalledSkill, ScannedLocation } from "../types.js";
import { scanBrowserExtensions } from "./browser.js";
import { scanClaudeConfig } from "./claude-config.js";
import { scanCliVersions } from "./cli-versions.js";
import { scanDesktopApp } from "./desktop-app.js";
import { scanInstallation } from "./installation.js";
import { scanSkillsAndPlugins } from "./skills-plugins.js";
import { scanTempFiles } from "./temp-files.js";
import { scanVSCode } from "./vscode.js";

interface ClaudeScanResult {
  location: ScannedLocation;
  installation: Installation;
  skills: InstalledSkill[];
  plugins: string[];
  tempDetails: { path: string; count: number; size_bytes: number };
  tempLocation: ScannedLocation;
}

/**
 * Meta-scanner that runs all Claude-related sub-scanners and aggregates
 * them into a single "claude" category location.
 */
export async function scanClaude(): Promise<ClaudeScanResult> {
  const installation = await scanInstallation();

  const configLocation = scanClaudeConfig();
  const versionLocation = scanCliVersions(installation.active_version);
  const skillsResult = scanSkillsAndPlugins();
  const desktopLocation = scanDesktopApp();
  const vscodeLocation = scanVSCode();
  const browserLocation = scanBrowserExtensions();
  const tempResult = scanTempFiles();

  const children: ScannedLocation[] = [
    desktopLocation,
    configLocation,
    vscodeLocation,
    ...skillsResult.locations,
    browserLocation,
    versionLocation,
  ].filter((loc) => loc.size_bytes > 0);

  children.sort((a, b) => b.size_bytes - a.size_bytes);

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  const location: ScannedLocation = {
    path: "Claude Code",
    category: "claude",
    size_bytes: totalSize,
    status: "active",
    item_count: children.length,
    children,
  };

  return {
    location,
    installation,
    skills: skillsResult.skills,
    plugins: skillsResult.plugins,
    tempDetails: tempResult.details,
    tempLocation: tempResult.location,
  };
}
