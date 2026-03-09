import { describe, expect, it } from "vitest";
import { analyzeDiskUsage, getTotalSize } from "../analyzers/disk-usage.js";
import { analyzeDuplicates } from "../analyzers/duplicates.js";
import { analyzeStale, getReclaimableTotal } from "../analyzers/stale.js";
import type { Installation, InstalledSkill, ScannedLocation } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers — reusable test fixtures
// ---------------------------------------------------------------------------

function makeLocation(
  overrides: Partial<ScannedLocation> & Pick<ScannedLocation, "path" | "size_bytes">,
): ScannedLocation {
  return {
    category: "claude",
    status: "active",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// disk-usage tests
// ---------------------------------------------------------------------------

describe("analyzeDiskUsage", () => {
  it("sorts locations by size_bytes descending (largest first)", () => {
    const locations: ScannedLocation[] = [
      makeLocation({ path: "~/.claude/settings.json", size_bytes: 500 }),
      makeLocation({
        path: "~/.local/share/claude/versions/",
        size_bytes: 1_500_000_000,
        category: "claude",
      }),
      makeLocation({
        path: "~/.agents/skills/",
        size_bytes: 492_000,
        category: "claude",
      }),
    ];

    const sorted = analyzeDiskUsage(locations);

    expect(sorted[0].size_bytes).toBe(1_500_000_000);
    expect(sorted[1].size_bytes).toBe(492_000);
    expect(sorted[2].size_bytes).toBe(500);
  });

  it("does not mutate the original array", () => {
    const locations: ScannedLocation[] = [
      makeLocation({ path: "/a", size_bytes: 10 }),
      makeLocation({ path: "/b", size_bytes: 100 }),
    ];

    const sorted = analyzeDiskUsage(locations);
    expect(sorted).not.toBe(locations);
    expect(locations[0].size_bytes).toBe(10); // original order preserved
  });

  it("returns an empty array when given an empty array", () => {
    const sorted = analyzeDiskUsage([]);
    expect(sorted).toEqual([]);
  });
});

describe("getTotalSize", () => {
  it("sums all top-level sizes", () => {
    const locations: ScannedLocation[] = [
      makeLocation({ path: "/a", size_bytes: 701_000_000 }),
      makeLocation({
        path: "/b",
        size_bytes: 1_500_000_000,
        category: "claude",
      }),
      makeLocation({
        path: "/c",
        size_bytes: 492_000,
        category: "claude",
      }),
    ];

    expect(getTotalSize(locations)).toBe(701_000_000 + 1_500_000_000 + 492_000);
  });

  it("returns 0 for an empty array", () => {
    expect(getTotalSize([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// stale tests
// ---------------------------------------------------------------------------

describe("analyzeStale", () => {
  it("collects stale items from top-level locations", () => {
    const locations: ScannedLocation[] = [
      makeLocation({
        path: "~/.claude/settings.json",
        size_bytes: 500,
        status: "active",
      }),
      makeLocation({
        path: "~/.local/share/claude/versions/2.1.68",
        size_bytes: 200_000_000,
        category: "claude",
        status: "stale",
      }),
    ];

    const reclaimable = analyzeStale(locations);

    expect(reclaimable).toHaveLength(1);
    expect(reclaimable[0].path).toBe("~/.local/share/claude/versions/2.1.68");
    expect(reclaimable[0].reason).toBe("stale_version");
    expect(reclaimable[0].size_bytes).toBe(200_000_000);
  });

  it("recursively walks children to find stale items", () => {
    const locations: ScannedLocation[] = [
      makeLocation({
        path: "~/.vscode/extensions",
        size_bytes: 300_000_000,
        category: "claude",
        status: "partial_stale",
        children: [
          makeLocation({
            path: "~/.vscode/extensions/anthropic.claude-code-1.0.0",
            size_bytes: 20_000_000,
            category: "claude",
            status: "stale",
          }),
          makeLocation({
            path: "~/.vscode/extensions/anthropic.claude-code-2.0.0",
            size_bytes: 25_000_000,
            category: "claude",
            status: "active",
          }),
        ],
      }),
    ];

    const reclaimable = analyzeStale(locations);

    expect(reclaimable).toHaveLength(1);
    expect(reclaimable[0].path).toBe("~/.vscode/extensions/anthropic.claude-code-1.0.0");
    expect(reclaimable[0].reason).toBe("old_extension");
  });

  it("classifies debug logs correctly", () => {
    const locations: ScannedLocation[] = [
      makeLocation({
        path: "~/.claude/debug/log-2024-01-01.txt",
        size_bytes: 50_000,
        status: "stale",
      }),
    ];

    const reclaimable = analyzeStale(locations);

    expect(reclaimable).toHaveLength(1);
    expect(reclaimable[0].reason).toBe("debug_log");
  });

  it("classifies cache directories correctly", () => {
    const locations: ScannedLocation[] = [
      makeLocation({
        path: "~/.claude/cache/old-data",
        size_bytes: 100_000,
        category: "claude",
        status: "stale",
      }),
    ];

    const reclaimable = analyzeStale(locations);

    expect(reclaimable).toHaveLength(1);
    expect(reclaimable[0].reason).toBe("cache");
  });

  it("classifies temp files by category", () => {
    const locations: ScannedLocation[] = [
      makeLocation({
        path: "~/.claude/session-env-snapshots",
        size_bytes: 30_000,
        category: "temp",
        status: "stale",
      }),
    ];

    const reclaimable = analyzeStale(locations);

    expect(reclaimable).toHaveLength(1);
    expect(reclaimable[0].reason).toBe("temp_file");
  });

  it("returns an empty array when no items are stale", () => {
    const locations: ScannedLocation[] = [
      makeLocation({
        path: "~/.claude/settings.json",
        size_bytes: 500,
        status: "active",
      }),
      makeLocation({
        path: "~/.local/share/claude/versions/2.1.71",
        size_bytes: 400_000_000,
        category: "claude",
        status: "active",
      }),
    ];

    const reclaimable = analyzeStale(locations);
    expect(reclaimable).toHaveLength(0);
  });

  it("handles deeply nested children", () => {
    const locations: ScannedLocation[] = [
      makeLocation({
        path: "~/.claude",
        size_bytes: 701_000_000,
        status: "partial_stale",
        children: [
          makeLocation({
            path: "~/.claude/projects",
            size_bytes: 500_000_000,
            status: "partial_stale",
            children: [
              makeLocation({
                path: "~/.claude/projects/old-project/versions/1.0",
                size_bytes: 10_000_000,
                status: "stale",
              }),
            ],
          }),
        ],
      }),
    ];

    const reclaimable = analyzeStale(locations);

    expect(reclaimable).toHaveLength(1);
    expect(reclaimable[0].path).toBe("~/.claude/projects/old-project/versions/1.0");
    expect(reclaimable[0].reason).toBe("stale_version");
  });
});

describe("getReclaimableTotal", () => {
  it("sums all reclaimable item sizes", () => {
    const items = [
      { path: "/a", size_bytes: 200_000_000, reason: "stale_version" as const },
      { path: "/b", size_bytes: 20_000_000, reason: "old_extension" as const },
      { path: "/c", size_bytes: 50_000, reason: "debug_log" as const },
    ];

    expect(getReclaimableTotal(items)).toBe(220_050_000);
  });

  it("returns 0 for an empty array", () => {
    expect(getReclaimableTotal([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// duplicates tests
// ---------------------------------------------------------------------------

describe("analyzeDuplicates", () => {
  it("detects dual installation methods", () => {
    const installation: Installation = {
      method: "native",
      active_version: "2.1.71",
      binary_path: "~/.local/bin/claude",
      binary_target: "~/.local/share/claude/versions/2.1.71/bin/claude",
      other_methods_detected: ["homebrew"],
    };

    const skills: InstalledSkill[] = [];

    const warnings = analyzeDuplicates(installation, skills);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toBe("Dual install detected: active via native, also found: homebrew");
  });

  it("detects multiple other installation methods", () => {
    const installation: Installation = {
      method: "native",
      active_version: "2.1.71",
      binary_path: "~/.local/bin/claude",
      binary_target: "",
      other_methods_detected: ["homebrew", "npm"],
    };

    const warnings = analyzeDuplicates(installation, []);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toBe("Dual install detected: active via native, also found: homebrew, npm");
  });

  it("detects duplicate skills across global and project scope", () => {
    const installation: Installation = {
      method: "native",
      active_version: "2.1.71",
      binary_path: "~/.local/bin/claude",
      binary_target: "",
      other_methods_detected: [],
    };

    const skills: InstalledSkill[] = [
      {
        name: "code-review",
        source: "anthropics/code-review",
        scope: "global",
        path: "~/.agents/skills/code-review",
      },
      {
        name: "code-review",
        source: "anthropics/code-review",
        scope: "project",
        path: ".claude/skills/code-review",
      },
      {
        name: "dashboard-builder",
        source: "anthropics/dashboard-builder",
        scope: "global",
        path: "~/.agents/skills/dashboard-builder",
      },
    ];

    const warnings = analyzeDuplicates(installation, skills);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toBe("Skill 'code-review' installed both globally and in project");
  });

  it("detects both dual install and duplicate skills", () => {
    const installation: Installation = {
      method: "homebrew",
      active_version: "2.1.70",
      binary_path: "/opt/homebrew/bin/claude",
      binary_target: "",
      other_methods_detected: ["npm"],
    };

    const skills: InstalledSkill[] = [
      {
        name: "formatter",
        source: "anthropics/formatter",
        scope: "global",
        path: "~/.agents/skills/formatter",
      },
      {
        name: "formatter",
        source: "anthropics/formatter",
        scope: "project",
        path: ".claude/skills/formatter",
      },
    ];

    const warnings = analyzeDuplicates(installation, skills);

    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("Dual install detected");
    expect(warnings[1]).toContain("Skill 'formatter'");
  });

  it("returns an empty array when no duplicates exist", () => {
    const installation: Installation = {
      method: "native",
      active_version: "2.1.71",
      binary_path: "~/.local/bin/claude",
      binary_target: "",
      other_methods_detected: [],
    };

    const skills: InstalledSkill[] = [
      {
        name: "code-review",
        source: "anthropics/code-review",
        scope: "global",
        path: "~/.agents/skills/code-review",
      },
      {
        name: "dashboard-builder",
        source: "anthropics/dashboard-builder",
        scope: "project",
        path: ".claude/skills/dashboard-builder",
      },
    ];

    const warnings = analyzeDuplicates(installation, skills);
    expect(warnings).toHaveLength(0);
  });
});
