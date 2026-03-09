import type { FootprintReport } from "../types.js";

/**
 * Generates a self-contained HTML report with tab navigation,
 * cleanup commands, and embedded Chart.js charts.
 */
export function reportHtml(report: FootprintReport): string {
  // Escape </script> sequences to prevent XSS when embedding JSON in <script> tags
  const dataJson = JSON.stringify(report).replace(/<\//g, "<\\/");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; img-src data:;">
<title>Dev Footprint Audit</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js" integrity="sha384-vsrfeLOOY6KuIYKDlmVH5UiBmgIdB1oEf7p01YgWHuqmOHfZr374+odEv96n9tNC" crossorigin="anonymous"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #f5f5f7;
  color: #1d1d1f;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.6;
  padding: 2rem;
}
.container { max-width: 1400px; margin: 0 auto; }
header {
  text-align: center;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  border-bottom: 1px solid #d2d2d7;
}
header h1 {
  font-size: 1.8rem;
  color: #1d1d1f;
  margin-bottom: 0.3rem;
  font-weight: 700;
  letter-spacing: -0.5px;
}
header .scan-date {
  font-size: 0.9rem;
  color: #86868b;
}

/* Tab navigation */
.tab-nav {
  display: flex;
  gap: 0;
  margin-bottom: 2rem;
  border-bottom: 2px solid #d2d2d7;
}
.tab-btn {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  padding: 0.7rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: #86868b;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.tab-btn:hover { color: #1d1d1f; }
.tab-btn.active {
  color: #007aff;
  border-bottom-color: #007aff;
  font-weight: 600;
}
.tab-section { display: none; }
.tab-section.active { display: block; }

/* KPI Cards */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}
.kpi-card {
  background: #ffffff;
  border: 1px solid #d2d2d7;
  border-radius: 12px;
  padding: 1.2rem;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.kpi-card .label {
  font-size: 0.75rem;
  color: #86868b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.3rem;
}
.kpi-card .value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1d1d1f;
}
.kpi-card .value.red { color: #ff3b30; }
.kpi-card .value.green { color: #34c759; }
.kpi-card .value.blue { color: #007aff; }

/* Charts */
.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}
.chart-box {
  background: #ffffff;
  border: 1px solid #d2d2d7;
  border-radius: 12px;
  padding: 1.2rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.chart-box h2 {
  font-size: 1rem;
  color: #1d1d1f;
  margin-bottom: 0.8rem;
  text-align: center;
  font-weight: 600;
}
.chart-container {
  position: relative;
  width: 100%;
  max-height: 350px;
}

/* Category cards */
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}
.category-card {
  background: #ffffff;
  border: 1px solid #d2d2d7;
  border-radius: 12px;
  padding: 1.2rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.category-card h3 {
  font-size: 0.95rem;
  color: #1d1d1f;
  font-weight: 600;
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.category-card h3 .cat-size {
  font-size: 0.9rem;
  color: #007aff;
  font-weight: 700;
}
.category-card .cat-items {
  font-size: 0.8rem;
  color: #86868b;
  margin-bottom: 0.5rem;
}
.category-card .cat-loc {
  display: flex;
  justify-content: space-between;
  padding: 0.2rem 0;
  font-size: 0.8rem;
  color: #3a3a3c;
}
.category-card .cat-loc .cat-loc-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  margin-right: 0.5rem;
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 0.75rem;
}
.category-card .cat-loc .cat-loc-size {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  font-weight: 500;
}
.claude-details {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #f0f0f0;
  font-size: 0.78rem;
  color: #3a3a3c;
}
.claude-details .detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.15rem 0;
}
.claude-details .detail-label { color: #86868b; }

/* Minor categories collapse */
.minor-categories {
  grid-column: 1 / -1;
}
.minor-categories summary {
  cursor: pointer;
  font-size: 0.85rem;
  color: #86868b;
  padding: 0.8rem;
  background: #ffffff;
  border: 1px solid #d2d2d7;
  border-radius: 12px;
  list-style: none;
}
.minor-categories summary::-webkit-details-marker { display: none; }
.minor-categories[open] summary { border-radius: 12px 12px 0 0; }
.minor-categories .minor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
  padding: 1rem;
  background: #ffffff;
  border: 1px solid #d2d2d7;
  border-top: none;
  border-radius: 0 0 12px 12px;
}

/* Duplicates */
.duplicates-section {
  background: #ffffff;
  border: 1px solid #d2d2d7;
  border-radius: 12px;
  padding: 1.2rem;
  margin-bottom: 2rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.duplicates-section h2 {
  font-size: 1rem;
  color: #1d1d1f;
  margin-bottom: 0.3rem;
  font-weight: 600;
}
.duplicates-section .context-note {
  font-size: 0.82rem;
  color: #86868b;
  margin-bottom: 0.8rem;
}
.dupe-row {
  border-bottom: 1px solid #f0f0f0;
}
.dupe-row:last-child { border-bottom: none; }
.dupe-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0;
  cursor: pointer;
  user-select: none;
}
.dupe-header:hover { background: #f5f5f7; margin: 0 -0.5rem; padding-left: 0.5rem; padding-right: 0.5rem; border-radius: 6px; }
.dupe-name {
  font-size: 0.85rem;
  color: #1d1d1f;
  font-weight: 500;
}
.dupe-chevron {
  font-size: 0.7rem;
  color: #86868b;
  margin-right: 0.4rem;
  transition: transform 0.15s ease;
  display: inline-block;
}
.dupe-chevron.open { transform: rotate(90deg); }
.dupe-meta {
  display: flex;
  gap: 1rem;
  align-items: center;
}
.dupe-meta .dupe-duplicated { color: #ff9500; font-weight: 600; font-size: 0.85rem; white-space: nowrap; }
.dupe-meta .dupe-copies { color: #86868b; font-size: 0.8rem; white-space: nowrap; }
.dupe-locations {
  display: none;
  padding: 0 0 0.6rem 1.4rem;
}
.dupe-locations.open { display: block; }
.dupe-loc {
  font-size: 0.78rem;
  color: #3a3a3c;
  font-family: 'SF Mono', Menlo, monospace;
  padding: 0.15rem 0;
}
.dupe-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 0 0.3rem;
  border-top: 2px solid #d2d2d7;
  margin-top: 0.3rem;
  font-weight: 700;
  font-size: 0.9rem;
}
.dupe-total .dupe-duplicated { color: #ff9500; }

/* Cleanup tab */
.cleanup-section {
  background: #ffffff;
  border: 1px solid #d2d2d7;
  border-radius: 12px;
  padding: 1.2rem;
  margin-bottom: 2rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.cleanup-section h2 {
  font-size: 1rem;
  color: #1d1d1f;
  margin-bottom: 0.8rem;
  font-weight: 600;
}
.cleanup-item {
  padding: 0.8rem 0;
  border-bottom: 1px solid #f0f0f0;
}
.cleanup-item:last-child { border-bottom: none; }
.cleanup-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.3rem;
}
.cleanup-path {
  font-size: 0.85rem;
  color: #1d1d1f;
  word-break: break-all;
  flex: 1;
}
.cleanup-size {
  color: #ff3b30;
  font-weight: 600;
  margin-left: 1rem;
  white-space: nowrap;
  font-size: 0.85rem;
}
.cleanup-reason {
  font-size: 0.78rem;
  color: #86868b;
  margin-bottom: 0.3rem;
}
.cleanup-cmd {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.3rem;
}
.cleanup-cmd code {
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 0.78rem;
  background: #f5f5f7;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  border: 1px solid #e8e8ed;
  flex: 1;
  color: #1d1d1f;
}
.copy-btn {
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.3rem 0.8rem;
  font-size: 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  font-weight: 500;
}
.copy-btn:hover { background: #0056cc; }
.copy-btn.copied { background: #34c759; }
.info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid #86868b;
  background: none;
  color: #86868b;
  font-size: 11px;
  font-weight: 700;
  font-style: italic;
  font-family: Georgia, serif;
  cursor: pointer;
  margin-left: 0.5rem;
  flex-shrink: 0;
  line-height: 1;
  padding: 0;
}
.info-btn:hover { border-color: #007aff; color: #007aff; }
.info-panel {
  display: none;
  margin-top: 0.4rem;
  padding: 0.7rem 0.8rem;
  background: #f5f5f7;
  border: 1px solid #e8e8ed;
  border-radius: 8px;
  font-size: 0.78rem;
  line-height: 1.5;
  color: #3a3a3c;
}
.info-panel.open { display: block; }
.info-panel strong { color: #1d1d1f; font-weight: 600; }
.info-panel .info-section { margin-bottom: 0.4rem; }
.info-panel .info-section:last-child { margin-bottom: 0; }
.info-panel .info-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #86868b;
  margin-bottom: 0.1rem;
}
.info-panel .info-caution {
  color: #ff9500;
  font-weight: 500;
}
.cleanup-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 0 0;
  border-top: 2px solid #d2d2d7;
  margin-top: 0.3rem;
  font-weight: 700;
  font-size: 0.95rem;
}
.cleanup-total .cleanup-size { color: #ff3b30; font-size: 0.95rem; }

@media (max-width: 800px) {
  .charts-row { grid-template-columns: 1fr; }
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .category-grid { grid-template-columns: 1fr; }
  .minor-categories .minor-grid { grid-template-columns: 1fr; }
  body { padding: 1rem; }
}
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>Dev Footprint Audit</h1>
    <div class="scan-date" id="scanDate"></div>
  </header>

  <nav class="tab-nav">
    <button class="tab-btn active" data-tab="overview">Overview</button>
    <button class="tab-btn" data-tab="categories">Categories</button>
    <button class="tab-btn" data-tab="shared">Shared Packages</button>
    <button class="tab-btn" data-tab="cleanup">Cleanup</button>
  </nav>

  <!-- Overview Tab -->
  <section class="tab-section active" id="tab-overview">
    <div class="kpi-grid" id="kpiGrid"></div>
    <div class="charts-row">
      <div class="chart-box">
        <h2>Disk Usage by Category</h2>
        <div class="chart-container"><canvas id="categoryChart"></canvas></div>
      </div>
      <div class="chart-box">
        <h2>Top 10 Largest Locations</h2>
        <div class="chart-container"><canvas id="topLocationsChart"></canvas></div>
      </div>
    </div>
  </section>

  <!-- Categories Tab -->
  <section class="tab-section" id="tab-categories">
    <div class="category-grid" id="categoryGrid"></div>
  </section>

  <!-- Shared Packages Tab -->
  <section class="tab-section" id="tab-shared">
    <div class="duplicates-section" id="duplicatesSection">
      <h2>Shared Across Repos</h2>
      <div class="context-note">These packages appear in multiple repos. pnpm or bun can deduplicate via shared stores.</div>
      <div id="duplicatesList"></div>
    </div>
  </section>

  <!-- Cleanup Tab -->
  <section class="tab-section" id="tab-cleanup">
    <div class="cleanup-section">
      <h2>Safe to Clean</h2>
      <div id="cleanupList"></div>
    </div>
  </section>
</div>

<script>
var DATA = ${dataJson};
var MINOR_THRESHOLD = 100 * 1024 * 1024;

function formatBytes(bytes) {
  if (bytes <= 0) return "0 B";
  var units = ["B", "KB", "MB", "GB", "TB"];
  var base = 1024;
  var exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(base)),
    units.length - 1
  );
  var value = bytes / Math.pow(base, exponent);
  if (exponent === 0) return Math.round(value) + " B";
  var formatted = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  return formatted + " " + units[exponent];
}

function formatReason(reason) {
  var map = {
    stale_version: "Stale version",
    old_extension: "Old extension",
    temp_file: "Temp files",
    debug_log: "Debug logs",
    cache: "Cache",
    derived_data: "Derived data",
    old_simulator: "Old simulator",
    duplicate_package: "Duplicate",
    docker_cache: "Docker cache",
    brew_cache: "Homebrew cache",
    system_cache: "System cache",
    trash: "Trash",
    ios_backup: "iOS backup"
  };
  return map[reason] || reason;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Tab navigation
document.querySelectorAll(".tab-btn").forEach(function(btn) {
  btn.addEventListener("click", function() {
    document.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
    document.querySelectorAll(".tab-section").forEach(function(s) { s.classList.remove("active"); });
    btn.classList.add("active");
    document.getElementById("tab-" + btn.getAttribute("data-tab")).classList.add("active");
  });
});

// Scan date
document.getElementById("scanDate").textContent = "Scanned: " + new Date(DATA.scan_date).toLocaleString();

// Support both safe_to_clean (v3) and reclaimable (v2 fallback)
var safeToClean = DATA.safe_to_clean || DATA.reclaimable || { total_bytes: 0, items: [] };

// Categories
var categories = DATA.categories || [];

// KPI Cards
(function renderKpi() {
  var grid = document.getElementById("kpiGrid");
  var safeClass = safeToClean.total_bytes > 500 * 1024 * 1024 ? "value red" : "value green";
  var topCat = categories.length > 0 ? categories[0] : null;
  var cards = [
    { label: "Total Dev Storage", value: formatBytes(DATA.total_bytes), cls: "value blue" },
    { label: "Safe to Clean", value: formatBytes(safeToClean.total_bytes), cls: safeClass },
    { label: "Top Category", value: topCat ? topCat.label + " (" + formatBytes(topCat.total_bytes) + ")" : "—", cls: "value" },
    { label: "Categories Scanned", value: String(categories.length), cls: "value" }
  ];
  cards.forEach(function(c) {
    var div = document.createElement("div");
    div.className = "kpi-card";
    div.innerHTML = '<div class="label">' + escapeHtml(c.label) + '</div><div class="' + c.cls + '">' + escapeHtml(c.value) + '</div>';
    grid.appendChild(div);
  });
})();

// Flatten all category locations
var allRows = [];
categories.forEach(function(cat) {
  (cat.locations || []).forEach(function(loc) {
    allRows.push({ path: loc.path, catLabel: cat.label, category: cat.category, size_bytes: loc.size_bytes, status: loc.status, item_count: loc.item_count });
    if (loc.children) {
      loc.children.forEach(function(child) {
        allRows.push({ path: child.path, catLabel: cat.label, category: cat.category, size_bytes: child.size_bytes, status: child.status, item_count: child.item_count });
      });
    }
  });
});

// Charts (wrapped in try-catch — Chart.js may fail to load on file:// URLs)
try {
  if (typeof Chart === "undefined") throw new Error("Chart.js not loaded");
  var chartColors = [
    "#007aff", "#34c759", "#ff9500", "#ff3b30", "#af52de",
    "#5856d6", "#ff2d55", "#00c7be", "#a2845e", "#8e8e93",
    "#30b0c7", "#ac8e68", "#636366", "#48484a", "#d1d1d6"
  ];
  new Chart(document.getElementById("categoryChart"), {
    type: "doughnut",
    data: {
      labels: categories.map(function(c) { return c.label; }),
      datasets: [{
        data: categories.map(function(c) { return c.total_bytes; }),
        backgroundColor: chartColors.slice(0, categories.length),
        borderColor: "#ffffff",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { color: "#3a3a3c", font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) { return ctx.label + ": " + formatBytes(ctx.parsed); }
          }
        }
      }
    }
  });
  var top10 = allRows.slice().sort(function(a, b) { return b.size_bytes - a.size_bytes; }).slice(0, 10);
  new Chart(document.getElementById("topLocationsChart"), {
    type: "bar",
    data: {
      labels: top10.map(function(loc) {
        var p = loc.path;
        if (p.length > 45) p = "..." + p.slice(p.length - 42);
        return p;
      }),
      datasets: [{
        label: "Size",
        data: top10.map(function(d) { return d.size_bytes; }),
        backgroundColor: "#007aff",
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(ctx) { return formatBytes(ctx.parsed.x); } } }
      },
      scales: {
        x: {
          ticks: { color: "#86868b", callback: function(v) { return formatBytes(v); } },
          grid: { color: "#e8e8ed" }
        },
        y: {
          ticks: { color: "#3a3a3c", font: { size: 10, family: "'SF Mono', Menlo, monospace" } },
          grid: { display: false }
        }
      }
    }
  });
} catch(e) {
  // Charts unavailable — show fallback message in chart boxes
  document.querySelectorAll(".chart-container").forEach(function(el) {
    el.innerHTML = '<div style="text-align:center;color:#86868b;padding:2rem 0;font-size:0.85rem;">Charts unavailable (offline?)</div>';
  });
}

// Category detail cards with minor collapse
(function renderCategoryCards() {
  var grid = document.getElementById("categoryGrid");
  var majorCats = categories.filter(function(c) { return c.total_bytes >= MINOR_THRESHOLD; });
  var minorCats = categories.filter(function(c) { return c.total_bytes < MINOR_THRESHOLD; });

  majorCats.forEach(function(cat) {
    grid.appendChild(buildCategoryCard(cat));
  });

  if (minorCats.length > 0) {
    var minorTotal = minorCats.reduce(function(sum, c) { return sum + c.total_bytes; }, 0);
    var details = document.createElement("details");
    details.className = "minor-categories";
    var summary = document.createElement("summary");
    summary.textContent = minorCats.length + " minor categories (" + formatBytes(minorTotal) + " total)";
    details.appendChild(summary);
    var minorGrid = document.createElement("div");
    minorGrid.className = "minor-grid";
    minorCats.forEach(function(cat) {
      minorGrid.appendChild(buildCategoryCard(cat));
    });
    details.appendChild(minorGrid);
    grid.appendChild(details);
  }
})();

function buildCategoryCard(cat) {
  var card = document.createElement("div");
  card.className = "category-card";
  var locs = (cat.locations || []).slice().sort(function(a,b) { return b.size_bytes - a.size_bytes; }).slice(0, 6);
  var locsHtml = locs.map(function(loc) {
    var p = loc.path;
    if (p.length > 50) p = "..." + p.slice(p.length - 47);
    return '<div class="cat-loc"><span class="cat-loc-path">' + escapeHtml(p) + '</span><span class="cat-loc-size">' + formatBytes(loc.size_bytes) + '</span></div>';
  }).join("");
  if (cat.locations && cat.locations.length > 6) {
    locsHtml += '<div class="cat-loc" style="color:#86868b;font-size:0.75rem;">... and ' + (cat.locations.length - 6) + ' more</div>';
  }

  var cleanLabel = cat.reclaimable_bytes > 0 ? ' &middot; ' + formatBytes(cat.reclaimable_bytes) + ' safe to clean' : '';

  // Claude category: include installation details
  var claudeHtml = '';
  if (cat.category === 'claude' && DATA.claude) {
    var inst = DATA.claude.installation;
    var skills = DATA.claude.skills || [];
    var plugins = DATA.claude.plugins || [];
    claudeHtml = '<div class="claude-details">';
    if (inst) {
      claudeHtml += '<div class="detail-row"><span class="detail-label">Method</span><span>' + escapeHtml(inst.method) + '</span></div>';
      if (inst.active_version) {
        claudeHtml += '<div class="detail-row"><span class="detail-label">Version</span><span>' + escapeHtml(inst.active_version) + '</span></div>';
      }
    }
    if (skills.length > 0) {
      claudeHtml += '<div class="detail-row"><span class="detail-label">Skills</span><span>' + skills.length + '</span></div>';
    }
    if (plugins.length > 0) {
      claudeHtml += '<div class="detail-row"><span class="detail-label">Plugins</span><span>' + plugins.length + '</span></div>';
    }
    claudeHtml += '</div>';
  }

  card.innerHTML =
    '<h3>' + escapeHtml(cat.label) + ' <span class="cat-size">' + formatBytes(cat.total_bytes) + '</span></h3>' +
    '<div class="cat-items">' + cat.location_count + ' items' + cleanLabel + '</div>' +
    locsHtml + claudeHtml;
  return card;
}

// Shared packages (duplicates)
(function renderDuplicates() {
  var dupes = DATA.duplicate_packages || [];
  if (dupes.length === 0) {
    document.getElementById("duplicatesList").innerHTML = '<div style="color:#86868b;padding:0.5rem 0;">No shared packages detected.</div>';
    return;
  }
  var container = document.getElementById("duplicatesList");
  var sorted = dupes.slice().sort(function(a,b) { return b.total_wasted_bytes - a.total_wasted_bytes; });
  var totalDuplicated = sorted.reduce(function(sum, d) { return sum + d.total_wasted_bytes; }, 0);

  var INITIAL_LIMIT = 20;

  function renderDupeRow(d) {
    var row = document.createElement("div");
    row.className = "dupe-row";

    var header = document.createElement("div");
    header.className = "dupe-header";
    header.innerHTML =
      '<div class="dupe-name"><span class="dupe-chevron">&#9654;</span>' + escapeHtml(d.name + "@" + d.version) + '</div>' +
      '<div class="dupe-meta"><span class="dupe-duplicated">' + formatBytes(d.total_wasted_bytes) + ' duplicated</span><span class="dupe-copies">' + d.locations.length + ' copies</span></div>';

    var locsDiv = document.createElement("div");
    locsDiv.className = "dupe-locations";
    d.locations.forEach(function(loc) {
      var locEl = document.createElement("div");
      locEl.className = "dupe-loc";
      locEl.textContent = loc;
      locsDiv.appendChild(locEl);
    });

    header.addEventListener("click", function() {
      locsDiv.classList.toggle("open");
      header.querySelector(".dupe-chevron").classList.toggle("open");
    });

    row.appendChild(header);
    row.appendChild(locsDiv);
    return row;
  }

  sorted.slice(0, INITIAL_LIMIT).forEach(function(d) {
    container.appendChild(renderDupeRow(d));
  });

  if (sorted.length > INITIAL_LIMIT) {
    var showAllBtn = document.createElement("div");
    showAllBtn.style.cssText = "text-align:center;padding:0.8rem 0;";
    showAllBtn.innerHTML = '<button style="background:#007aff;color:#fff;border:none;border-radius:6px;padding:0.4rem 1.2rem;font-size:0.85rem;cursor:pointer;">Show all ' + sorted.length + ' packages</button>';
    container.appendChild(showAllBtn);

    showAllBtn.querySelector("button").addEventListener("click", function() {
      showAllBtn.remove();
      sorted.slice(INITIAL_LIMIT).forEach(function(d) {
        totalDiv.parentNode.insertBefore(renderDupeRow(d), totalDiv);
      });
    });
  }

  var totalDiv = document.createElement("div");
  totalDiv.className = "dupe-total";
  totalDiv.innerHTML =
    '<span>Total duplicated (' + sorted.length + ' packages)</span>' +
    '<span class="dupe-duplicated">' + formatBytes(totalDuplicated) + '</span>';
  container.appendChild(totalDiv);
})();

// Cleanup info knowledge base
var CLEANUP_INFO = {
  // Key patterns matched against lowercase path + category
  entries: [
    {
      match: function(p, cat) { return cat === "homebrew" && p.includes("cache"); },
      what: "Downloaded .tar.gz and .bottle archives that Homebrew fetched when installing or upgrading formulae. Once a formula is installed, these archives are no longer needed.",
      safe: "Homebrew will re-download any archive it needs on the next install/upgrade. This is purely a download cache.",
      caution: "If you're on a slow or metered connection, keeping the cache avoids re-downloading packages you upgrade frequently."
    },
    {
      match: function(p, cat) { return cat === "package_caches" && p.includes(".npm"); },
      what: "npm's local cache of downloaded package tarballs and metadata. npm uses this to avoid re-downloading packages you've installed before.",
      safe: "npm will re-download packages as needed. The cache is rebuilt automatically on the next install.",
      caution: "Clearing this means your next npm install will be slower as it fetches everything from the registry again."
    },
    {
      match: function(p, cat) { return cat === "package_caches" && p.includes("yarn"); },
      what: "Yarn's cache of downloaded packages. Works like npm's cache — stores tarballs so repeated installs are faster.",
      safe: "Yarn re-downloads packages on demand. The cache is purely for speed.",
      caution: "Offline installs won't work until the cache is rebuilt."
    },
    {
      match: function(p, cat) { return cat === "system_caches" && p.includes("pnpm"); },
      what: "pnpm metadata and HTTP cache. Unlike the pnpm content store (which is a hardlink source), this is temporary cache data.",
      safe: "This is metadata/HTTP cache only. pnpm will rebuild it automatically.",
      caution: "The pnpm content store (~/.pnpm-store) is NOT included here — that's kept because it uses hardlinks to save disk space across projects."
    },
    {
      match: function(p, cat) { return cat === "vscode" && (p.includes("cachedextensionvsix") || p.includes("vsix")); },
      what: "Previously downloaded VS Code extension installers (.vsix files). VS Code keeps old versions around after updates.",
      safe: "VS Code re-downloads extensions when needed. These are leftover installers from past updates.",
      caution: "None — these are purely redundant copies of already-installed extensions."
    },
    {
      match: function(p, cat) { return cat === "vscode" && p.includes("log"); },
      what: "VS Code diagnostic and extension log files. These are written during each session for debugging purposes.",
      safe: "Log files are recreated each session. Old logs have no functional purpose.",
      caution: "If you're debugging a VS Code issue, you may want to keep recent logs until the issue is resolved."
    },
    {
      match: function(p, cat) { return cat === "system_caches" && p.includes("typescript"); },
      what: "TypeScript compiler cache used by tools like ts-server and VS Code for faster type checking.",
      safe: "The cache is rebuilt automatically the next time you open a TypeScript project.",
      caution: "Your first TypeScript project open after clearing may be slightly slower."
    },
    {
      match: function(p, cat) { return cat === "system_caches" && p.includes("playwright"); },
      what: "Cached Playwright browser binaries and test artifacts used for end-to-end testing.",
      safe: "Playwright re-downloads browsers when you run npx playwright install. This is a download cache.",
      caution: "You'll need to run playwright install again before your next test run."
    },
    {
      match: function(p, cat) { return cat === "python" && p.includes("pip"); },
      what: "pip's download cache — stores wheels and source distributions of Python packages you've installed.",
      safe: "pip re-downloads packages as needed. The cache exists purely to speed up repeated installs.",
      caution: "Next pip install will be slower as packages are fetched from PyPI again."
    },
    {
      match: function(p, cat) { return cat === "trash"; },
      what: "Files in your macOS Trash (Finder's recycle bin). These are files you've previously deleted but haven't emptied yet.",
      safe: "You already chose to delete these files. Emptying trash is the final step.",
      caution: "Double-check Trash in Finder first if you're unsure whether you deleted something important recently."
    },
    {
      match: function(p, cat) { return cat === "system_caches" && p.includes("node-gyp"); },
      what: "node-gyp compilation cache — stores headers and compiled native addon artifacts used when installing npm packages with C++ bindings.",
      safe: "node-gyp re-downloads Node.js headers and recompiles on the next native module install.",
      caution: "Next npm install of a native module (like sharp, sqlite3) will take longer as it recompiles."
    },
    {
      match: function(p, cat) { return cat === "xcode" && p.includes("deriveddata"); },
      what: "Xcode's build artifacts — compiled binaries, indexes, and intermediate build products for every project you've opened.",
      safe: "Xcode regenerates DerivedData on the next build. It's a build cache, not source code.",
      caution: "Your first build after clearing will be a full (non-incremental) build, which takes longer."
    },
    {
      match: function(p, cat) { return cat === "xcode" && p.includes("cache"); },
      what: "Xcode caches including simulator data, asset caches, and SwiftPM resolved packages.",
      safe: "These are regenerated automatically. Xcode fetches what it needs on next launch.",
      caution: "Simulators may need to re-download runtimes. SwiftPM packages will re-resolve."
    },
    {
      match: function(p, cat) { return cat === "docker"; },
      what: "Docker build cache, dangling images, and stopped containers. Accumulates over time as you build and run containers.",
      safe: "docker system prune only removes unused data — running containers and tagged images are kept.",
      caution: "Build cache speeds up repeated docker build. After pruning, the next build may take longer."
    },
    {
      match: function(p, cat) { return cat === "temp"; },
      what: "Temporary files created by dev tools in /tmp. These are session artifacts that were not cleaned up.",
      safe: "Temp files are meant to be disposable. macOS also clears /tmp on reboot.",
      caution: "Ensure no running process is actively using these files."
    },
    {
      match: function(p, cat) { return cat === "cocoapods" && p.includes("cache"); },
      what: "CocoaPods spec repo cache and downloaded pod sources. Used to speed up pod install.",
      safe: "CocoaPods re-downloads specs and sources as needed. This is a download cache.",
      caution: "Next pod install will be slower as it re-fetches the spec repo and pod sources."
    },
    {
      match: function(p, cat) { return cat === "ios_backups"; },
      what: "Local iOS device backups created by Finder or iTunes. These can be very large (multiple GB per device).",
      safe: "If you use iCloud Backup, local backups may be redundant.",
      caution: "If you don't use iCloud Backup, deleting these means you lose your only device backup. Check before deleting."
    }
  ],
  // Fallback
  fallback: {
    what: "Cached or temporary data created by developer tools.",
    safe: "This data is regenerated automatically when the tool needs it again.",
    caution: "The next operation that needs this data may be slightly slower as it rebuilds the cache."
  }
};

function getCleanupInfo(item) {
  var p = (item.path || "").toLowerCase();
  var cat = item.category || "";
  for (var i = 0; i < CLEANUP_INFO.entries.length; i++) {
    if (CLEANUP_INFO.entries[i].match(p, cat)) return CLEANUP_INFO.entries[i];
  }
  return CLEANUP_INFO.fallback;
}

// Cleanup tab
(function renderCleanup() {
  var container = document.getElementById("cleanupList");
  var items = (safeToClean.items || []).slice().sort(function(a, b) { return b.size_bytes - a.size_bytes; });
  if (items.length === 0) {
    container.innerHTML = '<div style="color:#86868b;padding:0.5rem 0;">Nothing to clean up — your system is tidy!</div>';
    return;
  }

  items.forEach(function(item, idx) {
    var div = document.createElement("div");
    div.className = "cleanup-item";
    var info = getCleanupInfo(item);
    var panelId = "info-panel-" + idx;

    var html =
      '<div class="cleanup-item-header">' +
        '<span class="cleanup-path">' + escapeHtml(item.path) + '</span>' +
        '<button class="info-btn" data-panel="' + panelId + '" title="What is this?">i</button>' +
        '<span class="cleanup-size">' + formatBytes(item.size_bytes) + '</span>' +
      '</div>' +
      '<div class="info-panel" id="' + panelId + '">' +
        '<div class="info-section"><div class="info-label">What lives here</div>' + escapeHtml(info.what) + '</div>' +
        '<div class="info-section"><div class="info-label">Why it is safe to delete</div>' + escapeHtml(info.safe) + '</div>' +
        '<div class="info-section"><div class="info-label">When you might want to keep it</div><span class="info-caution">' + escapeHtml(info.caution) + '</span></div>' +
      '</div>' +
      '<div class="cleanup-reason">' + escapeHtml(formatReason(item.reason)) + '</div>';

    if (item.suggestion) {
      html +=
        '<div class="cleanup-cmd">' +
          '<code>' + escapeHtml(item.suggestion) + '</code>' +
          '<button class="copy-btn" data-cmd="' + escapeHtml(item.suggestion) + '">Copy</button>' +
        '</div>';
    }
    div.innerHTML = html;
    container.appendChild(div);
  });

  // Info button toggle handlers
  container.querySelectorAll(".info-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var panel = document.getElementById(btn.getAttribute("data-panel"));
      if (panel) panel.classList.toggle("open");
    });
  });

  // Copy button handlers
  container.querySelectorAll(".copy-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var cmd = btn.getAttribute("data-cmd");
      navigator.clipboard.writeText(cmd).then(function() {
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(function() {
          btn.textContent = "Copy";
          btn.classList.remove("copied");
        }, 1500);
      });
    });
  });

  // Total row
  var totalDiv = document.createElement("div");
  totalDiv.className = "cleanup-total";
  totalDiv.innerHTML =
    '<span>Total Safe to Clean</span>' +
    '<span class="cleanup-size">' + formatBytes(safeToClean.total_bytes) + '</span>';
  container.appendChild(totalDiv);
})();
</script>
</body>
</html>`;
}
