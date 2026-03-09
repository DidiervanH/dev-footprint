import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// We mock the modules before importing the scanner
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      accessSync: vi.fn(),
      existsSync: vi.fn(),
      lstatSync: vi.fn(),
      readlinkSync: vi.fn(),
      readdirSync: vi.fn(),
    },
  };
});

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";
import fs from "node:fs";
import { scanInstallation } from "../scanners/installation.js";

const mockedFs = vi.mocked(fs);
const mockedExecSync = vi.mocked(execSync);

function resetAllMocks(): void {
  vi.resetAllMocks();
  // Default: nothing exists, all commands fail
  // pathExists uses fs.accessSync - throw to indicate path doesn't exist
  mockedFs.accessSync.mockImplementation(() => {
    throw new Error("ENOENT");
  });
  mockedFs.existsSync.mockReturnValue(false);
  mockedFs.lstatSync.mockImplementation(() => {
    throw new Error("ENOENT");
  });
  mockedFs.readlinkSync.mockImplementation(() => {
    throw new Error("ENOENT");
  });
  mockedFs.readdirSync.mockImplementation(() => {
    throw new Error("ENOENT");
  });
  mockedExecSync.mockImplementation(() => {
    throw new Error("command not found");
  });
}

/** Helper: make accessSync succeed for specific paths (simulates pathExists returning true) */
function mockPathExists(predicate: (path: string) => boolean): void {
  mockedFs.accessSync.mockImplementation((p) => {
    if (predicate(String(p))) {
      return undefined;
    }
    throw new Error("ENOENT");
  });
}

describe("scanInstallation", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns unknown when nothing is detected", async () => {
    const result = await scanInstallation();
    expect(result.method).toBe("unknown");
    expect(result.active_version).toBe("");
    expect(result.binary_path).toBe("");
    expect(result.binary_target).toBe("");
    expect(result.other_methods_detected).toEqual([]);
  });

  it("detects native installation via symlink", async () => {
    // ~/.local/bin/claude exists
    mockPathExists((p) => p.endsWith(".local/bin/claude"));

    mockedFs.lstatSync.mockImplementation(() => {
      return {
        isSymbolicLink: () => true,
        isFile: () => false,
      } as ReturnType<typeof fs.lstatSync>;
    });

    mockedFs.readlinkSync.mockImplementation(
      () => "/Users/test/.local/share/claude/versions/2.1.71/bin/claude",
    );

    // which claude -> native path
    mockedExecSync.mockImplementation((cmd) => {
      const s = String(cmd);
      if (s.includes("which claude")) {
        return "/Users/test/.local/bin/claude";
      }
      throw new Error("command not found");
    });

    const result = await scanInstallation();
    expect(result.method).toBe("native");
    expect(result.active_version).toBe("2.1.71");
    expect(result.binary_path).toBe("/Users/test/.local/bin/claude");
    expect(result.other_methods_detected).toEqual([]);
  });

  it("detects homebrew installation (ARM Mac)", async () => {
    mockPathExists((p) => p === "/opt/homebrew/Caskroom/claude-code");

    mockedFs.readdirSync.mockImplementation((p) => {
      const s = String(p);
      if (s === "/opt/homebrew/Caskroom/claude-code") {
        return [".metadata", "2.3.0"] as unknown as ReturnType<typeof fs.readdirSync>;
      }
      throw new Error("ENOENT");
    });

    mockedFs.lstatSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    // which claude -> homebrew path
    mockedExecSync.mockImplementation((cmd) => {
      const s = String(cmd);
      if (s.includes("which claude")) {
        return "/opt/homebrew/bin/claude";
      }
      throw new Error("command not found");
    });

    const result = await scanInstallation();
    expect(result.method).toBe("homebrew");
    expect(result.active_version).toBe("2.3.0");
    expect(result.binary_path).toBe("/opt/homebrew/bin/claude");
    expect(result.other_methods_detected).toEqual([]);
  });

  it("detects npm installation", async () => {
    // npm list succeeds
    mockedExecSync.mockImplementation((cmd) => {
      const s = String(cmd);
      if (s.includes("npm list -g @anthropic-ai/claude-code")) {
        return "/Users/test/.nvm/versions/node/v20.0.0/lib\n`-- @anthropic-ai/claude-code@1.5.2\n";
      }
      if (s.includes("npm bin -g")) {
        return "/Users/test/.nvm/versions/node/v20.0.0/bin";
      }
      if (s.includes("which claude")) {
        return "/Users/test/.nvm/versions/node/v20.0.0/bin/claude";
      }
      throw new Error("command not found");
    });

    mockedFs.lstatSync.mockImplementation(() => {
      return {
        isSymbolicLink: () => false,
      } as ReturnType<typeof fs.lstatSync>;
    });

    const result = await scanInstallation();
    expect(result.method).toBe("npm");
    expect(result.active_version).toBe("1.5.2");
    expect(result.binary_path).toBe("/Users/test/.nvm/versions/node/v20.0.0/bin/claude");
    expect(result.other_methods_detected).toEqual([]);
  });

  it("detects dual-install (native + homebrew)", async () => {
    // Both native and homebrew paths exist
    mockPathExists(
      (p) => p.endsWith(".local/bin/claude") || p === "/opt/homebrew/Caskroom/claude-code",
    );

    mockedFs.lstatSync.mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith(".local/bin/claude")) {
        return {
          isSymbolicLink: () => true,
          isFile: () => false,
        } as ReturnType<typeof fs.lstatSync>;
      }
      // which claude result
      if (s === "/opt/homebrew/bin/claude") {
        return {
          isSymbolicLink: () => false,
        } as ReturnType<typeof fs.lstatSync>;
      }
      throw new Error("ENOENT");
    });

    mockedFs.readlinkSync.mockImplementation(
      () => "/Users/test/.local/share/claude/versions/2.1.71/bin/claude",
    );

    mockedFs.readdirSync.mockImplementation((p) => {
      const s = String(p);
      if (s === "/opt/homebrew/Caskroom/claude-code") {
        return ["2.3.0"] as unknown as ReturnType<typeof fs.readdirSync>;
      }
      throw new Error("ENOENT");
    });

    // which claude -> homebrew path (active is homebrew)
    mockedExecSync.mockImplementation((cmd) => {
      const s = String(cmd);
      if (s.includes("which claude")) {
        return "/opt/homebrew/bin/claude";
      }
      throw new Error("command not found");
    });

    const result = await scanInstallation();
    expect(result.method).toBe("homebrew");
    expect(result.active_version).toBe("2.3.0");
    expect(result.other_methods_detected).toContain("native");
  });

  it("detects homebrew on Intel Mac", async () => {
    mockPathExists((p) => p === "/usr/local/Caskroom/claude-code");

    mockedFs.readdirSync.mockImplementation((p) => {
      const s = String(p);
      if (s === "/usr/local/Caskroom/claude-code") {
        return ["1.0.0"] as unknown as ReturnType<typeof fs.readdirSync>;
      }
      throw new Error("ENOENT");
    });

    mockedFs.lstatSync.mockImplementation((p) => {
      const s = String(p);
      if (s === "/usr/local/bin/claude") {
        return {
          isSymbolicLink: () => false,
        } as ReturnType<typeof fs.lstatSync>;
      }
      throw new Error("ENOENT");
    });

    mockedExecSync.mockImplementation((cmd) => {
      const s = String(cmd);
      if (s.includes("which claude")) {
        return "/usr/local/bin/claude";
      }
      throw new Error("command not found");
    });

    const result = await scanInstallation();
    expect(result.method).toBe("homebrew");
    expect(result.active_version).toBe("1.0.0");
    expect(result.binary_path).toBe("/usr/local/bin/claude");
  });
});
