import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { InstalledSkill, ScannedLocation } from "../types.js";
import {
  collapseHome,
  countItems,
  getDirSize,
  getFileSize,
  pathExists,
  readJsonFile,
} from "../utils.js";

/** Shape of the .skill-lock.json file */
interface SkillLockFile {
  version: number;
  skills: Record<
    string,
    {
      source: string;
      sourceType: string;
      computedHash: string;
    }
  >;
}

/** Shape of installed_plugins.json (array of plugin name strings) */
type InstalledPluginsFile = string[];

/**
 * Scans for installed skills and plugins.
 *
 * 1. Skills from lock file: Parse ~/.agents/.skill-lock.json
 * 2. Skills directories: List ~/.agents/skills/ subdirectories
 * 3. Skill symlinks: Check ~/.claude/skills/ symlink targets
 * 4. Plugins: Parse ~/.claude/plugins/installed_plugins.json
 */
export function scanSkillsAndPlugins(): {
  skills: InstalledSkill[];
  plugins: string[];
  locations: ScannedLocation[];
} {
  const skills: InstalledSkill[] = [];
  const plugins: string[] = [];
  const locations: ScannedLocation[] = [];

  try {
    const home = os.homedir();
    const agentsDir = path.join(home, ".agents");
    const skillLockPath = path.join(agentsDir, ".skill-lock.json");
    const skillsDir = path.join(agentsDir, "skills");

    const agentsChildren: ScannedLocation[] = [];

    // -----------------------------------------------------------------------
    // 1. Parse skill lock file for metadata
    // -----------------------------------------------------------------------
    const lockData = readJsonFile<SkillLockFile>(skillLockPath);
    const lockSkillNames = new Set<string>();

    if (lockData?.skills) {
      for (const [name, entry] of Object.entries(lockData.skills)) {
        lockSkillNames.add(name);
        const skillDirPath = path.join(skillsDir, name);

        skills.push({
          name,
          source: entry.source,
          scope: "global",
          path: collapseHome(skillDirPath),
        });
      }
    }

    // -----------------------------------------------------------------------
    // 2. Scan skills directory for skills not in lock file
    // -----------------------------------------------------------------------
    if (pathExists(skillsDir)) {
      try {
        const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !lockSkillNames.has(entry.name)) {
            const skillDirPath = path.join(skillsDir, entry.name);
            skills.push({
              name: entry.name,
              source: "unknown",
              scope: "global",
              path: collapseHome(skillDirPath),
            });
          }
        }
      } catch {
        // Skip if we can't read the directory
      }
    }

    // Build children for ~/.agents/ location
    if (pathExists(skillLockPath)) {
      const lockSize = getFileSize(skillLockPath);
      agentsChildren.push({
        path: collapseHome(skillLockPath),
        category: "claude",
        size_bytes: lockSize,
        status: "active",
        item_count: 1,
      });
    }

    if (pathExists(skillsDir)) {
      const skillsDirSize = getDirSize(skillsDir);
      const skillCount = countItems(skillsDir);
      agentsChildren.push({
        path: collapseHome(skillsDir),
        category: "claude",
        size_bytes: skillsDirSize,
        status: "active",
        item_count: skillCount,
      });
    }

    if (pathExists(agentsDir) || agentsChildren.length > 0) {
      const totalSize = agentsChildren.reduce((sum, c) => sum + c.size_bytes, 0);
      locations.push({
        path: "~/.agents/",
        category: "claude",
        size_bytes: totalSize,
        status: agentsChildren.length > 0 ? "active" : "unknown",
        item_count: agentsChildren.length,
        children: agentsChildren,
      });
    }

    // -----------------------------------------------------------------------
    // 3. Plugins
    // -----------------------------------------------------------------------
    const pluginsDir = path.join(home, ".claude", "plugins");
    const pluginsJsonPath = path.join(pluginsDir, "installed_plugins.json");

    const pluginData = readJsonFile<InstalledPluginsFile>(pluginsJsonPath);
    if (Array.isArray(pluginData)) {
      for (const plugin of pluginData) {
        if (typeof plugin === "string") {
          plugins.push(plugin);
        }
      }
    }

    if (pathExists(pluginsDir)) {
      const pluginsDirSize = getDirSize(pluginsDir);
      const pluginItemCount = countItems(pluginsDir);
      locations.push({
        path: "~/.claude/plugins/",
        category: "claude",
        size_bytes: pluginsDirSize,
        status: plugins.length > 0 ? "active" : "unknown",
        item_count: pluginItemCount,
      });
    }
  } catch {
    // Gracefully handle any unexpected errors
  }

  return { skills, plugins, locations };
}
