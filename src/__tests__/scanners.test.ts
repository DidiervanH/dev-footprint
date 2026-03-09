import type { Stats } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:fs before imports
vi.mock("node:fs", () => {
  return {
    default: {
      accessSync: vi.fn(),
      statSync: vi.fn(),
      lstatSync: vi.fn(),
      readdirSync: vi.fn(),
    },
  };
});

// Mock node:os to control homedir
vi.mock("node:os", () => {
  return {
    default: {
      homedir: vi.fn(() => "/home/testuser"),
    },
  };
});

import fs from "node:fs";
import { scanClaudeConfig } from "../scanners/claude-config.js";
import { scanCliVersions } from "../scanners/cli-versions.js";
import { scanTempFiles } from "../scanners/temp-files.js";

const mockFs = vi.mocked(fs);

function makeStat(overrides: {
  isDirectory?: boolean;
  isFile?: boolean;
  isSymbolicLink?: boolean;
  size?: number;
}): Stats {
  return {
    isDirectory: () => overrides.isDirectory ?? false,
    isFile: () => overrides.isFile ?? true,
    isSymbolicLink: () => overrides.isSymbolicLink ?? false,
    size: overrides.size ?? 0,
  } as Stats;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// scanClaudeConfig tests
// ============================================================
describe("scanClaudeConfig", () => {
  it("returns unknown status with size 0 when ~/.claude/ does not exist", () => {
    mockFs.accessSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const result = scanClaudeConfig();

    expect(result.path).toBe("~/.claude/");
    expect(result.category).toBe("claude");
    expect(result.size_bytes).toBe(0);
    expect(result.status).toBe("unknown");
    expect(result.children).toEqual([]);
  });

  it("scans files and directories in ~/.claude/", () => {
    const existingPaths = new Set([
      "/home/testuser/.claude/",
      "/home/testuser/.claude",
      "/home/testuser/.claude/settings.json",
      "/home/testuser/.claude/projects",
      "/home/testuser/.claude/telemetry",
    ]);

    mockFs.accessSync.mockImplementation((p) => {
      if (!existingPaths.has(String(p))) {
        throw new Error("ENOENT");
      }
    });

    mockFs.statSync.mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("settings.json")) {
        return makeStat({ isFile: true, size: 512 });
      }
      if (pathStr.endsWith("projects") || pathStr.endsWith("telemetry")) {
        return makeStat({ isDirectory: true, size: 4096 });
      }
      return makeStat({ isFile: true, size: 0 });
    });

    (mockFs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("projects")) return ["proj1", "proj2"] as unknown as string[];
      if (pathStr.endsWith("telemetry")) return ["log1.json"] as unknown as string[];
      return [] as unknown as string[];
    });

    const result = scanClaudeConfig();

    expect(result.path).toBe("~/.claude/");
    expect(result.category).toBe("claude");
    expect(result.status).toBe("active");
    expect(result.children).toBeDefined();
    expect(result.children?.length).toBe(3); // settings.json, projects, telemetry

    const settingsChild = result.children?.find((c) => c.path.includes("settings.json"));
    expect(settingsChild).toBeDefined();
    expect(settingsChild?.size_bytes).toBe(512);

    const projectsChild = result.children?.find((c) => c.path.includes("projects"));
    expect(projectsChild).toBeDefined();
    expect(projectsChild?.item_count).toBe(2);
  });

  it("handles permission errors gracefully on individual files", () => {
    const existingPaths = new Set([
      "/home/testuser/.claude/",
      "/home/testuser/.claude",
      "/home/testuser/.claude/settings.json",
    ]);

    mockFs.accessSync.mockImplementation((p) => {
      if (!existingPaths.has(String(p))) {
        throw new Error("ENOENT");
      }
    });

    mockFs.statSync.mockImplementation(() => {
      throw new Error("EACCES");
    });

    const result = scanClaudeConfig();

    // Should not crash, returns active with 0 children since stat fails
    expect(result.path).toBe("~/.claude/");
    expect(result.status).toBe("active");
    expect(result.size_bytes).toBe(0);
  });
});

// ============================================================
// scanCliVersions tests
// ============================================================
describe("scanCliVersions", () => {
  it("returns unknown status when versions directory does not exist", () => {
    mockFs.accessSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const result = scanCliVersions("2.1.71");

    expect(result.path).toBe("~/.local/share/claude/versions/");
    expect(result.category).toBe("claude");
    expect(result.size_bytes).toBe(0);
    expect(result.status).toBe("unknown");
  });

  it("marks active and stale versions correctly", () => {
    const existingPaths = new Set([
      "/home/testuser/.local/share/claude/versions/",
      "/home/testuser/.local/share/claude/versions",
      "/home/testuser/.local/share/claude/versions/2.1.68",
      "/home/testuser/.local/share/claude/versions/2.1.71",
    ]);

    mockFs.accessSync.mockImplementation((p) => {
      if (!existingPaths.has(String(p))) {
        throw new Error("ENOENT");
      }
    });

    mockFs.statSync.mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("2.1.68")) {
        return makeStat({ isDirectory: true, size: 4096 });
      }
      if (pathStr.endsWith("2.1.71")) {
        return makeStat({ isDirectory: true, size: 4096 });
      }
      return makeStat({ isFile: true, size: 0 });
    });

    (mockFs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((p) => {
      const pathStr = String(p).replace(/\/$/, "");
      if (pathStr.endsWith("versions")) {
        return ["2.1.68", "2.1.71"] as unknown as string[];
      }
      // Subdirectories of each version: return some files for size calculation
      if (pathStr.endsWith("2.1.68")) {
        return ["claude-bin"] as unknown as string[];
      }
      if (pathStr.endsWith("2.1.71")) {
        return ["claude-bin"] as unknown as string[];
      }
      return [] as unknown as string[];
    });

    const result = scanCliVersions("2.1.71");

    expect(result.status).toBe("partial_stale");
    expect(result.children).toBeDefined();

    // Filter to version children only (not symlink/state)
    const versionChildren = result.children?.filter((c) =>
      c.path.startsWith("~/.local/share/claude/versions/"),
    );
    expect(versionChildren?.length).toBe(2);

    const activeChild = versionChildren?.find((c) => c.path.includes("2.1.71"));
    expect(activeChild).toBeDefined();
    expect(activeChild?.status).toBe("active");

    const staleChild = versionChildren?.find((c) => c.path.includes("2.1.68"));
    expect(staleChild).toBeDefined();
    expect(staleChild?.status).toBe("stale");
  });

  it("returns stale when all versions are stale", () => {
    const existingPaths = new Set([
      "/home/testuser/.local/share/claude/versions/",
      "/home/testuser/.local/share/claude/versions",
      "/home/testuser/.local/share/claude/versions/2.1.68",
      "/home/testuser/.local/share/claude/versions/2.1.69",
    ]);

    mockFs.accessSync.mockImplementation((p) => {
      if (!existingPaths.has(String(p))) {
        throw new Error("ENOENT");
      }
    });

    mockFs.statSync.mockImplementation(() => {
      return makeStat({ isDirectory: true, size: 4096 });
    });

    (mockFs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((p) => {
      const pathStr = String(p).replace(/\/$/, "");
      if (pathStr.endsWith("versions")) {
        return ["2.1.68", "2.1.69"] as unknown as string[];
      }
      return [] as unknown as string[];
    });

    const result = scanCliVersions("2.1.71");
    expect(result.status).toBe("stale");
  });

  it("returns active when only the active version exists", () => {
    const existingPaths = new Set([
      "/home/testuser/.local/share/claude/versions/",
      "/home/testuser/.local/share/claude/versions",
      "/home/testuser/.local/share/claude/versions/2.1.71",
    ]);

    mockFs.accessSync.mockImplementation((p) => {
      if (!existingPaths.has(String(p))) {
        throw new Error("ENOENT");
      }
    });

    mockFs.statSync.mockImplementation(() => {
      return makeStat({ isDirectory: true, size: 4096 });
    });

    (mockFs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((p) => {
      const pathStr = String(p).replace(/\/$/, "");
      if (pathStr.endsWith("versions")) {
        return ["2.1.71"] as unknown as string[];
      }
      return [] as unknown as string[];
    });

    const result = scanCliVersions("2.1.71");
    expect(result.status).toBe("active");
  });

  it("includes symlink and state directory when they exist", () => {
    const existingPaths = new Set([
      "/home/testuser/.local/share/claude/versions/",
      "/home/testuser/.local/share/claude/versions",
      "/home/testuser/.local/bin/claude",
      "/home/testuser/.local/state/claude/",
      "/home/testuser/.local/state/claude",
    ]);

    mockFs.accessSync.mockImplementation((p) => {
      if (!existingPaths.has(String(p))) {
        throw new Error("ENOENT");
      }
    });

    mockFs.lstatSync.mockImplementation(() => {
      return makeStat({ isFile: true, size: 128 });
    });

    mockFs.statSync.mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("claude") && pathStr.includes("state")) {
        return makeStat({ isDirectory: true, size: 2048 });
      }
      return makeStat({ isFile: true, size: 0 });
    });

    (mockFs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      return [] as unknown as string[];
    });

    const result = scanCliVersions("2.1.71");

    const symlinkChild = result.children?.find((c) => c.path === "~/.local/bin/claude");
    expect(symlinkChild).toBeDefined();
    expect(symlinkChild?.size_bytes).toBe(128);

    const stateChild = result.children?.find((c) => c.path === "~/.local/state/claude/");
    expect(stateChild).toBeDefined();
  });
});

// ============================================================
// scanTempFiles tests
// ============================================================
describe("scanTempFiles", () => {
  it("returns empty results when /tmp/ does not exist", () => {
    mockFs.accessSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const result = scanTempFiles();

    expect(result.location.path).toBe("/tmp/claude-*");
    expect(result.location.category).toBe("temp");
    expect(result.location.size_bytes).toBe(0);
    expect(result.location.status).toBe("stale");
    expect(result.location.item_count).toBe(0);
    expect(result.details.count).toBe(0);
    expect(result.details.size_bytes).toBe(0);
  });

  it("scans claude- prefixed entries in /tmp/", () => {
    mockFs.accessSync.mockImplementation((p) => {
      const pathStr = String(p);
      if (
        pathStr === "/tmp/" ||
        pathStr === "/tmp" ||
        pathStr === "/tmp/claude-session-abc" ||
        pathStr === "/tmp/claude-upload-xyz"
      ) {
        return;
      }
      throw new Error("ENOENT");
    });

    (mockFs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === "/tmp/" || pathStr === "/tmp") {
        return [
          "claude-session-abc",
          "claude-upload-xyz",
          "other-file",
          "systemd-private",
        ] as unknown as string[];
      }
      return [] as unknown as string[];
    });

    mockFs.lstatSync.mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr.includes("claude-session-abc")) {
        return makeStat({ isDirectory: true, size: 4096 });
      }
      if (pathStr.includes("claude-upload-xyz")) {
        return makeStat({ isFile: true, size: 1024 });
      }
      return makeStat({ isFile: true, size: 0 });
    });

    const result = scanTempFiles();

    expect(result.location.item_count).toBe(2);
    expect(result.details.count).toBe(2);
    // claude-upload-xyz is a file with size 1024
    // claude-session-abc is a directory, getDirSize will recurse (readdirSync returns [])
    // so total should be 1024 (file) + 0 (empty dir)
    expect(result.details.size_bytes).toBe(1024);
  });

  it("handles permission errors on individual entries gracefully", () => {
    mockFs.accessSync.mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === "/tmp/" || pathStr === "/tmp") return;
      throw new Error("ENOENT");
    });

    (mockFs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === "/tmp/" || pathStr === "/tmp") {
        return ["claude-locked"] as unknown as string[];
      }
      return [] as unknown as string[];
    });

    mockFs.lstatSync.mockImplementation(() => {
      throw new Error("EACCES");
    });

    const result = scanTempFiles();

    // Should not crash
    expect(result.location.item_count).toBe(0);
    expect(result.details.count).toBe(0);
    expect(result.details.size_bytes).toBe(0);
  });

  it("handles permission error reading /tmp/ directory", () => {
    mockFs.accessSync.mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === "/tmp/" || pathStr === "/tmp") return;
      throw new Error("ENOENT");
    });

    (mockFs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("EACCES");
    });

    const result = scanTempFiles();

    expect(result.location.size_bytes).toBe(0);
    expect(result.details.count).toBe(0);
  });

  it("ignores entries not starting with claude-", () => {
    mockFs.accessSync.mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === "/tmp/" || pathStr === "/tmp" || pathStr === "/tmp/claude-test") {
        return;
      }
      throw new Error("ENOENT");
    });

    (mockFs.readdirSync as ReturnType<typeof vi.fn>).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === "/tmp/" || pathStr === "/tmp") {
        return ["not-claude", "claude-test", "my-claude-stuff"] as unknown as string[];
      }
      return [] as unknown as string[];
    });

    mockFs.lstatSync.mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr.includes("claude-test")) {
        return makeStat({ isFile: true, size: 256 });
      }
      return makeStat({ isFile: true, size: 100 });
    });

    const result = scanTempFiles();

    // Only "claude-test" should match (not "not-claude" or "my-claude-stuff")
    expect(result.details.count).toBe(1);
    expect(result.details.size_bytes).toBe(256);
  });
});
