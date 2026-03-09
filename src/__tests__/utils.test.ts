import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  collapseHome,
  countItems,
  expandHome,
  formatBytes,
  getDirSize,
  pathExists,
  readJsonFile,
} from "../utils.js";

describe("getDirSize", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "footprint-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns 0 for non-existent path", () => {
    expect(getDirSize("/nonexistent/path/that/does/not/exist")).toBe(0);
  });

  it("returns 0 for an empty directory", () => {
    expect(getDirSize(tmpDir)).toBe(0);
  });

  it("sums file sizes in a flat directory", () => {
    fs.writeFileSync(path.join(tmpDir, "a.txt"), "hello"); // 5 bytes
    fs.writeFileSync(path.join(tmpDir, "b.txt"), "world!"); // 6 bytes
    expect(getDirSize(tmpDir)).toBe(11);
  });

  it("sums file sizes recursively", () => {
    const sub = path.join(tmpDir, "sub");
    fs.mkdirSync(sub);
    fs.writeFileSync(path.join(tmpDir, "a.txt"), "aaa"); // 3
    fs.writeFileSync(path.join(sub, "b.txt"), "bbbb"); // 4
    expect(getDirSize(tmpDir)).toBe(7);
  });
});

describe("countItems", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "footprint-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns 0 for non-existent path", () => {
    expect(countItems("/nonexistent/path")).toBe(0);
  });

  it("returns 0 for an empty directory", () => {
    expect(countItems(tmpDir)).toBe(0);
  });

  it("counts immediate children only", () => {
    fs.writeFileSync(path.join(tmpDir, "a.txt"), "");
    fs.writeFileSync(path.join(tmpDir, "b.txt"), "");
    const sub = path.join(tmpDir, "sub");
    fs.mkdirSync(sub);
    fs.writeFileSync(path.join(sub, "c.txt"), "");
    // 3 immediate items: a.txt, b.txt, sub/
    expect(countItems(tmpDir)).toBe(3);
  });
});

describe("formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats negative as 0 B", () => {
    expect(formatBytes(-100)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(4300)).toBe("4.2 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(201326592)).toBe("192 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1610612736)).toBe("1.5 GB");
  });

  it("formats exact kilobytes without decimal", () => {
    expect(formatBytes(1024)).toBe("1 KB");
  });

  it("formats terabytes", () => {
    expect(formatBytes(1099511627776)).toBe("1 TB");
  });

  it("formats 1 byte", () => {
    expect(formatBytes(1)).toBe("1 B");
  });
});

describe("expandHome", () => {
  const home = os.homedir();

  it("expands ~ to home directory", () => {
    expect(expandHome("~")).toBe(home);
  });

  it("expands ~/path to home/path", () => {
    expect(expandHome("~/Documents/test")).toBe(path.join(home, "Documents/test"));
  });

  it("does not expand paths without ~", () => {
    expect(expandHome("/usr/local/bin")).toBe("/usr/local/bin");
  });

  it("does not expand ~ in the middle of a path", () => {
    expect(expandHome("/some/~/path")).toBe("/some/~/path");
  });
});

describe("collapseHome", () => {
  const home = os.homedir();

  it("collapses home directory to ~", () => {
    expect(collapseHome(home)).toBe("~");
  });

  it("collapses paths under home", () => {
    expect(collapseHome(path.join(home, "Documents/test"))).toBe("~/Documents/test");
  });

  it("does not collapse paths outside home", () => {
    expect(collapseHome("/usr/local/bin")).toBe("/usr/local/bin");
  });

  it("does not collapse partial home matches", () => {
    // e.g., /Users/didiervanhooren2 should not match /Users/didiervanhooren
    expect(collapseHome(`${home}2`)).toBe(`${home}2`);
  });
});

describe("pathExists", () => {
  it("returns true for existing path", () => {
    expect(pathExists(os.tmpdir())).toBe(true);
  });

  it("returns false for non-existent path", () => {
    expect(pathExists("/this/definitely/does/not/exist")).toBe(false);
  });
});

describe("readJsonFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "footprint-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads and parses a valid JSON file", () => {
    const filePath = path.join(tmpDir, "test.json");
    fs.writeFileSync(filePath, JSON.stringify({ key: "value", num: 42 }));
    const result = readJsonFile<{ key: string; num: number }>(filePath);
    expect(result).toEqual({ key: "value", num: 42 });
  });

  it("returns null for non-existent file", () => {
    expect(readJsonFile("/nonexistent/file.json")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const filePath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(filePath, "not valid json {{{");
    expect(readJsonFile(filePath)).toBeNull();
  });

  it("returns null for empty file", () => {
    const filePath = path.join(tmpDir, "empty.json");
    fs.writeFileSync(filePath, "");
    expect(readJsonFile(filePath)).toBeNull();
  });
});
