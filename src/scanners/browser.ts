import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ScannedLocation } from "../types.js";
import { collapseHome, getDirSize, pathExists } from "../utils.js";

interface BrowserDef {
  name: string;
  nativeMessagingPath: string;
}

/**
 * Browser definitions with their NativeMessagingHosts paths on macOS.
 */
const BROWSERS: BrowserDef[] = [
  {
    name: "Chrome",
    nativeMessagingPath: path.join(
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "NativeMessagingHosts",
    ),
  },
  {
    name: "Arc",
    nativeMessagingPath: path.join(
      "Library",
      "Application Support",
      "Arc",
      "User Data",
      "NativeMessagingHosts",
    ),
  },
  {
    name: "Brave",
    nativeMessagingPath: path.join(
      "Library",
      "Application Support",
      "BraveSoftware",
      "Brave-Browser",
      "NativeMessagingHosts",
    ),
  },
  {
    name: "Edge",
    nativeMessagingPath: path.join(
      "Library",
      "Application Support",
      "Microsoft Edge",
      "NativeMessagingHosts",
    ),
  },
  {
    name: "Vivaldi",
    nativeMessagingPath: path.join(
      "Library",
      "Application Support",
      "Vivaldi",
      "NativeMessagingHosts",
    ),
  },
  {
    name: "Opera",
    nativeMessagingPath: path.join(
      "Library",
      "Application Support",
      "com.operasoftware.Opera",
      "NativeMessagingHosts",
    ),
  },
];

/**
 * Check if a NativeMessagingHosts directory contains Claude-related files
 * (files matching com.anthropic.*).
 */
function findClaudeNativeMessages(dirPath: string): {
  found: boolean;
  size: number;
  count: number;
} {
  try {
    if (!pathExists(dirPath)) {
      return { found: false, size: 0, count: 0 };
    }

    const entries = fs.readdirSync(dirPath);
    let totalSize = 0;
    let count = 0;

    for (const entry of entries) {
      if (entry.startsWith("com.anthropic.")) {
        const fullPath = path.join(dirPath, entry);
        try {
          const stat = fs.statSync(fullPath);
          totalSize += stat.isDirectory() ? getDirSize(fullPath) : stat.size;
          count++;
        } catch {
          // Skip files that can't be stat'd
        }
      }
    }

    return { found: count > 0, size: totalSize, count };
  } catch {
    return { found: false, size: 0, count: 0 };
  }
}

/**
 * Scan browser NativeMessagingHosts directories for Claude extensions.
 *
 * Checks Chrome, Arc, Brave, Edge, Vivaldi, and Opera for
 * com.anthropic.* files in their NativeMessagingHosts directories.
 */
export function scanBrowserExtensions(): ScannedLocation {
  const children: ScannedLocation[] = [];

  try {
    const home = os.homedir();

    for (const browser of BROWSERS) {
      const absPath = path.join(home, browser.nativeMessagingPath);
      const result = findClaudeNativeMessages(absPath);

      if (result.found) {
        children.push({
          path: `${browser.name} (${collapseHome(absPath)})`,
          category: "claude",
          size_bytes: result.size,
          status: "active",
          item_count: result.count,
        });
      }
    }
  } catch {
    // Gracefully handle any unexpected errors
  }

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "Browser extensions (NativeMessagingHosts)",
    category: "claude",
    size_bytes: totalSize,
    status: children.length > 0 ? "active" : "unknown",
    item_count: children.length,
    children,
  };
}
