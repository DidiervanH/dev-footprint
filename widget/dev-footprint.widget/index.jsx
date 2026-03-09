import { run } from "uebersicht";

export const command = `cat ~/.dev-footprint/cache.json 2>/dev/null || echo '{}'`;

export const refreshFrequency = 60000; // read cache file every 60s

export const className = `
  bottom: 80px;
  right: 10px;
  width: 340px;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  font-size: 12px;
  color: #1d1d1f;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 10px;
  padding: 14px 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08), 0 0.5px 1px rgba(0, 0, 0, 0.05);

  * { margin: 0; padding: 0; box-sizing: border-box; }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }

  .title {
    font-size: 13px;
    font-weight: 600;
    color: #1d1d1f;
    letter-spacing: -0.2px;
  }

  .total-badge {
    font-size: 10px;
    color: #6e6e73;
    background: rgba(0, 0, 0, 0.04);
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;
  }

  .category-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .category-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .category-label {
    font-size: 11px;
    color: #3a3a3c;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1;
  }

  .category-size {
    font-size: 11px;
    color: #1d1d1f;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .footer {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-label {
    font-size: 11px;
    color: #6e6e73;
  }

  .footer-value {
    font-size: 11px;
    font-weight: 500;
    color: #1d1d1f;
    font-variant-numeric: tabular-nums;
  }

  .footer-value.warn {
    color: #e8420a;
  }

  .scan-time {
    font-size: 9px;
    color: #aeaeb2;
    text-align: right;
    margin-top: 6px;
  }

  .widget-clickable {
    cursor: pointer;
    background: none;
    border: none;
    font: inherit;
    color: inherit;
    text-align: inherit;
    width: 100%;
    display: block;
  }

  .widget-clickable:active {
    opacity: 0.7;
  }

  .click-hint {
    font-size: 9px;
    color: #aeaeb2;
    text-align: center;
    margin-top: 4px;
  }
`;

function formatBytes(bytes) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const base = 1024;
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
  const value = bytes / base ** exponent;
  if (exponent === 0) return `${Math.round(value)} B`;
  const formatted = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[exponent]}`;
}

export const render = ({ output, error }) => {
  const handleClick = () => {
    run("open $HOME/.dev-footprint/report.html");
  };
  if (error) {
    return (
      <div>
        <div className="header">
          <span className="title">Dev Footprint</span>
        </div>
        <div className="footer-label">Error loading data</div>
      </div>
    );
  }

  let data;
  try {
    data = JSON.parse(output);
  } catch {
    data = null;
  }

  if (!data || !data.scan_date) {
    return (
      <div>
        <div className="header">
          <span className="title">Dev Footprint</span>
        </div>
        <div className="footer-label">
          Run <code>dev-footprint</code> to scan
        </div>
      </div>
    );
  }

  const totalBytes = data.total_bytes || 0;
  // Support both safe_to_clean (v3) and reclaimable (v2 fallback)
  const safeToClean = data.safe_to_clean || data.reclaimable;
  const safeToCleanBytes = safeToClean?.total_bytes ? safeToClean.total_bytes : 0;
  const safeToCleanWarn = safeToCleanBytes > 500 * 1024 * 1024;

  // Top 3 categories by size
  const categories = (data.categories || []).filter((cat) => cat.total_bytes > 0).slice(0, 3);

  let scanTime = "";
  try {
    const d = new Date(data.scan_date);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    scanTime = `${hh}:${mm}`;
  } catch {
    scanTime = "--:--";
  }

  return (
    <button type="button" className="widget-clickable" onClick={handleClick}>
      <div className="header">
        <span className="title">Dev Footprint</span>
        <span className="total-badge">{formatBytes(totalBytes)}</span>
      </div>

      {categories.length > 0 && (
        <div className="category-list">
          {categories.map((cat, i) => (
            <div key={i}>
              <div className="category-row">
                <span className="category-label">{cat.label}</span>
                <span className="category-size">{formatBytes(cat.total_bytes)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="footer">
        <span className="footer-label">Safe to Clean</span>
        <span className={`footer-value${safeToCleanWarn ? " warn" : ""}`}>
          {formatBytes(safeToCleanBytes)}
        </span>
      </div>
      <div className="scan-time">Last scan {scanTime} · Click for details</div>
    </button>
  );
};
