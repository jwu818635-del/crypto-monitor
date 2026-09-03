import { useEffect, useMemo, useState } from "react";

import { DataComponent, useDataApp } from "../../data-app-public.jsx";
import "./example.css";

const ASSETS = [
  { ticker: "BTC", asset: "Bitcoin", symbol: "BTCUSDT", category: "核心" },
  { ticker: "ETH", asset: "Ethereum", symbol: "ETHUSDT", category: "核心" },
  { ticker: "BNB", asset: "BNB", symbol: "BNBUSDT", category: "核心" },
  { ticker: "XRP", asset: "XRP", symbol: "XRPUSDT", category: "核心" },
  { ticker: "SOL", asset: "Solana", symbol: "SOLUSDT", category: "核心" },
  { ticker: "ADA", asset: "Cardano", symbol: "ADAUSDT", category: "公链" },
  { ticker: "SUI", asset: "Sui", symbol: "SUIUSDT", category: "公链" },
  { ticker: "AVAX", asset: "Avalanche", symbol: "AVAXUSDT", category: "公链" },
  { ticker: "NEAR", asset: "NEAR Protocol", symbol: "NEARUSDT", category: "公链" },
  { ticker: "APT", asset: "Aptos", symbol: "APTUSDT", category: "公链" },
  { ticker: "ATOM", asset: "Cosmos", symbol: "ATOMUSDT", category: "公链" },
  { ticker: "LINK", asset: "Chainlink", symbol: "LINKUSDT", category: "DeFi" },
  { ticker: "UNI", asset: "Uniswap", symbol: "UNIUSDT", category: "DeFi" },
  { ticker: "AAVE", asset: "Aave", symbol: "AAVEUSDT", category: "DeFi" },
  { ticker: "INJ", asset: "Injective", symbol: "INJUSDT", category: "DeFi" },
  { ticker: "ARB", asset: "Arbitrum", symbol: "ARBUSDT", category: "L2" },
  { ticker: "OP", asset: "Optimism", symbol: "OPUSDT", category: "L2" },
  { ticker: "DOT", asset: "Polkadot", symbol: "DOTUSDT", category: "基础设施" },
  { ticker: "FIL", asset: "Filecoin", symbol: "FILUSDT", category: "基础设施" },
  { ticker: "ICP", asset: "Internet Computer", symbol: "ICPUSDT", category: "基础设施" },
  { ticker: "TIA", asset: "Celestia", symbol: "TIAUSDT", category: "基础设施" },
  { ticker: "DOGE", asset: "Dogecoin", symbol: "DOGEUSDT", category: "支付与高波动" },
  { ticker: "TRX", asset: "TRON", symbol: "TRXUSDT", category: "支付与高波动" },
  { ticker: "XLM", asset: "Stellar", symbol: "XLMUSDT", category: "支付与高波动" },
  { ticker: "BCH", asset: "Bitcoin Cash", symbol: "BCHUSDT", category: "支付与高波动" },
  { ticker: "LTC", asset: "Litecoin", symbol: "LTCUSDT", category: "支付与高波动" },
];
const BINANCE_API = "https://api.binance.com/api/v3";

function average(values) { return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null; }
function movingAverage(values, index, period) { return index >= period - 1 ? average(values.slice(index - period + 1, index + 1)) : null; }
function round(value, digits = 2) { const factor = 10 ** digits; return Number.isFinite(value) ? Math.round(value * factor) / factor : null; }
function ema(values, period) { const multiplier = 2 / (period + 1); let prior = values[0] ?? 0; return values.map((value, index) => { prior = index ? value * multiplier + prior * (1 - multiplier) : value; return prior; }); }
function rsi(values, period = 14) {
  if (values.length <= period) return null;
  const changes = values.slice(1).map((value, index) => value - values[index]);
  let gains = average(changes.slice(0, period).map(value => Math.max(value, 0)));
  let losses = average(changes.slice(0, period).map(value => Math.max(-value, 0)));
  changes.slice(period).forEach(change => { gains = (gains * (period - 1) + Math.max(change, 0)) / period; losses = (losses * (period - 1) + Math.max(-change, 0)) / period; });
  return losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
}
function formatMoney(value) { if (!Number.isFinite(value)) return "—"; return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value >= 1000 ? 0 : value >= 1 ? 2 : 4 }).format(value); }
function formatPercent(value) { return Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : "—"; }
function formatNumber(value, digits = 2) { return Number.isFinite(value) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value) : "—"; }
function formatUpdated(value) { return value ? new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date(value)) : "离线快照"; }

function calculateTechnical(rows, asset) {
  const closes = rows.map(row => row.close); const volumes = rows.map(row => row.quoteVolume ?? row.volume * row.close); const latest = rows.at(-1); const previous = rows.at(-2);
  if (!latest || !previous || rows.length < 51) return null;
  const ma20 = average(closes.slice(-20)); const ma50 = average(closes.slice(-50)); const macdSeries = ema(closes, 12).map((value, index) => value - ema(closes, 26)[index]); const macd = macdSeries.at(-1); const macdSignal = ema(macdSeries, 9).at(-1);
  const rsi14 = rsi(closes); const prior20 = rows.slice(-21, -1); const support = Math.min(...prior20.map(row => row.low)); const resistance = Math.max(...prior20.map(row => row.high));
  const change24h = (latest.close / previous.close - 1) * 100; const change7d = (latest.close / rows.at(-8).close - 1) * 100; const change30d = (latest.close / rows.at(-31).close - 1) * 100; const volumeRatio = latest.quoteVolume / average(volumes.slice(-21, -1));
  const priorMa20 = average(closes.slice(-21, -1)); const trend = latest.close > ma20 && ma20 > ma50 && macd > macdSignal ? "趋势偏多" : latest.close < ma20 && ma20 < ma50 && macd < macdSignal ? "趋势偏弱" : "震荡等待";
  const alerts = [];
  if (rsi14 >= 70) alerts.push({ ticker: asset.ticker, level: "warning", label: "RSI 偏热", detail: `RSI(14) ${round(rsi14, 1)}；避免把强势直接等同于低风险。` });
  if (rsi14 <= 30) alerts.push({ ticker: asset.ticker, level: "watch", label: "RSI 偏低", detail: `RSI(14) ${round(rsi14, 1)}；先观察止跌确认。` });
  if ((previous.close > priorMa20) !== (latest.close > ma20)) alerts.push({ ticker: asset.ticker, level: "signal", label: "穿越 MA20", detail: latest.close > ma20 ? "日线重新站上 20 日均线。" : "日线跌破 20 日均线。" });
  if (latest.close >= resistance * 0.99) alerts.push({ ticker: asset.ticker, level: "signal", label: "接近阻力", detail: `接近前 20 个完整日线的阻力 ${formatMoney(resistance)}。` });
  if (latest.close <= support * 1.02) alerts.push({ ticker: asset.ticker, level: "watch", label: "接近支撑", detail: `接近前 20 个完整日线的支撑 ${formatMoney(support)}。` });
  return { ticker: asset.ticker, asset: asset.asset, category: asset.category, close: latest.close, change24h, change7d, change30d, ma20, ma50, rsi14, macd, macdSignal, support, resistance, volumeRatio, trend, alerts };
}
function normalizeCandles(candles, asset) { return candles.map(candle => ({ date: new Date(candle[0]).toISOString().slice(0, 10), ticker: asset.ticker, asset: asset.asset, category: asset.category, symbol: asset.symbol, open: Number(candle[1]), high: Number(candle[2]), low: Number(candle[3]), close: Number(candle[4]), volume: Number(candle[5]), quoteVolume: Number(candle[7]) })); }
async function fetchLiveRows() {
  const output = [];
  for (let index = 0; index < ASSETS.length; index += 6) {
    const batch = await Promise.all(ASSETS.slice(index, index + 6).map(async asset => { const response = await fetch(`${BINANCE_API}/klines?symbol=${asset.symbol}&interval=1d&limit=120`); if (!response.ok) throw new Error(`${asset.ticker} 请求失败`); return normalizeCandles(await response.json(), asset); }));
    output.push(...batch.flat());
  }
  return output;
}

function TrendBadge({ trend }) { const tone = trend === "趋势偏多" ? "positive" : trend === "趋势偏弱" ? "negative" : "neutral"; return <span className="crypto-trend-badge" data-tone={tone}>{trend}</span>; }
function MarketStats({ indicators }) {
  const rising = indicators.filter(item => item.change24h > 0).length; const trendUp = indicators.filter(item => item.trend === "趋势偏多").length; const hot = indicators.filter(item => item.rsi14 >= 70).length; const active = indicators.filter(item => item.volumeRatio >= 1.2).length;
  return <div className="crypto-stat-grid" data-reviewed-rows><div><span>监控资产</span><strong>{indicators.length}</strong><small>不含稳定币</small></div><div><span>24h 上涨</span><strong data-tone={rising >= indicators.length / 2 ? "positive" : "negative"}>{rising}/{indicators.length}</strong><small>市场广度</small></div><div><span>趋势偏多</span><strong data-tone="positive">{trendUp}</strong><small>MA + MACD 同向</small></div><div><span>成交放大</span><strong>{active}</strong><small>≥ 20 日均值 1.2×</small></div><div><span>RSI 偏热</span><strong data-tone={hot ? "warning" : "neutral"}>{hot}</strong><small>RSI ≥ 70</small></div></div>;
}
function RadarTiles({ indicators, selectedTicker, onSelect }) {
  return <div className="crypto-radar-grid" data-reviewed-rows>{indicators.map(item => { const heat = Math.min(Math.abs(item.change24h) / 6, 1); return <button type="button" key={item.ticker} onClick={() => onSelect(item.ticker)} aria-pressed={selectedTicker === item.ticker} data-direction={item.change24h >= 0 ? "up" : "down"} style={{ "--heat": heat }}><div><strong>{item.ticker}</strong><small>{item.category}</small></div><span>{formatMoney(item.close)}</span><b>{formatPercent(item.change24h)}</b><em>RSI {formatNumber(item.rsi14, 0)}</em></button>; })}</div>;
}
function StrengthList({ indicators, title, negative = false, onSelect }) {
  const values = [...indicators].sort((a, b) => negative ? a.change7d - b.change7d : b.change7d - a.change7d).slice(0, 5); const scale = Math.max(...values.map(item => Math.abs(item.change7d)), 1);
  return <section className="crypto-strength-list"><header><h3>{title}</h3><span>近 7 日</span></header>{values.map(item => <button type="button" key={item.ticker} data-negative={item.change7d < 0 || undefined} onClick={() => onSelect(item.ticker)}><span>{item.ticker}</span><i><b style={{ width: `${Math.abs(item.change7d) / scale * 100}%` }} /></i><strong>{formatPercent(item.change7d)}</strong></button>)}</section>;
}
function PriceChart({ rows, timeframe }) {
  const tagged = useMemo(() => { const closes = rows.map(row => row.close); return rows.map((row, index) => ({ ...row, ma20: movingAverage(closes, index, 20), ma50: movingAverage(closes, index, 50) })); }, [rows]); const visible = tagged.slice(-Number(timeframe));
  if (!visible.length) return <div className="crypto-empty">暂无可用的价格数据。</div>;
  const width = 900; const height = 410; const margin = { top: 18, right: 70, bottom: 30, left: 8 }; const volumeHeight = 54; const priceHeight = height - margin.top - margin.bottom - volumeHeight - 18; const overlays = visible.flatMap(row => [row.ma20, row.ma50].filter(Number.isFinite));
  const minimum = Math.min(...visible.map(row => row.low), ...overlays); const maximum = Math.max(...visible.map(row => row.high), ...overlays); const padding = Math.max((maximum - minimum) * 0.08, maximum * 0.01); const low = minimum - padding; const high = maximum + padding; const plotWidth = width - margin.left - margin.right; const step = plotWidth / visible.length; const candleWidth = Math.max(1, Math.min(8, step * 0.62));
  const x = index => margin.left + step * (index + .5); const y = value => margin.top + (high - value) / (high - low) * priceHeight; const volumeTop = margin.top + priceHeight + 18; const maxVolume = Math.max(...visible.map(row => row.quoteVolume || 0), 1); const yVolume = value => volumeTop + volumeHeight - value / maxVolume * volumeHeight;
  const pathFor = field => visible.reduce((path, row, index) => Number.isFinite(row[field]) ? `${path}${path ? "L" : "M"}${x(index)} ${y(row[field])} ` : path, ""); const ticks = Array.from({ length: 5 }, (_, index) => low + (high - low) * index / 4).reverse(); const dates = [0, Math.floor((visible.length - 1) / 2), visible.length - 1]; const latest = visible.at(-1);
  return <div className="crypto-chart-wrap" data-reviewed-rows><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="日线 K 线图，包含 MA20、MA50 和成交额"><defs><linearGradient id="volume-gradient" x1="0" x2="0" y1="0" y2="1"><stop stopColor="currentColor" stopOpacity=".35" /><stop offset="1" stopColor="currentColor" stopOpacity=".04" /></linearGradient></defs>{ticks.map(tick => <g key={tick}><line className="crypto-grid" x1={margin.left} x2={width - margin.right + 2} y1={y(tick)} y2={y(tick)} /><text className="crypto-axis" x={width - margin.right + 10} y={y(tick) + 4}>{formatMoney(tick)}</text></g>)}{visible.map((row, index) => { const up = row.close >= row.open; const top = Math.min(y(row.open), y(row.close)); const body = Math.max(1.5, Math.abs(y(row.open) - y(row.close))); return <g key={row.date} className="crypto-candle" data-positive={up || undefined}><line x1={x(index)} x2={x(index)} y1={y(row.high)} y2={y(row.low)} /><rect x={x(index) - candleWidth / 2} y={top} width={candleWidth} height={body} rx="1" /><rect className="crypto-volume-bar" x={x(index) - candleWidth / 2} y={yVolume(row.quoteVolume || 0)} width={candleWidth} height={volumeTop + volumeHeight - yVolume(row.quoteVolume || 0)} rx="1" /></g>; })}<path className="crypto-ma20" d={pathFor("ma20")} /><path className="crypto-ma50" d={pathFor("ma50")} /><line className="crypto-last-line" x1={margin.left} x2={width - margin.right + 2} y1={y(latest.close)} y2={y(latest.close)} />{dates.map(index => <text className="crypto-axis" key={index} x={x(index)} y={height - 6} textAnchor="middle">{new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${visible[index].date}T00:00:00Z`))}</text>)}</svg><div className="crypto-chart-legend"><span><i data-series="ma20" />MA20</span><span><i data-series="ma50" />MA50</span><span><i data-series="volume" />成交额</span></div></div>;
}
function TechnicalGrid({ indicator }) { if (!indicator) return null; const items = [["收盘 / MA20", `${formatMoney(indicator.close)} / ${formatMoney(indicator.ma20)}`, indicator.close > indicator.ma20 ? "positive" : "negative"], ["MA20 / MA50", `${formatMoney(indicator.ma20)} / ${formatMoney(indicator.ma50)}`, indicator.ma20 > indicator.ma50 ? "positive" : "negative"], ["RSI (14)", formatNumber(indicator.rsi14, 1), indicator.rsi14 >= 70 ? "warning" : indicator.rsi14 <= 30 ? "watch" : "neutral"], ["MACD", `${formatNumber(indicator.macd, 3)} / ${formatNumber(indicator.macdSignal, 3)}`, indicator.macd > indicator.macdSignal ? "positive" : "negative"], ["20 日支撑", formatMoney(indicator.support), "neutral"], ["20 日阻力", formatMoney(indicator.resistance), "neutral"], ["成交额比", `${formatNumber(indicator.volumeRatio, 2)}×`, indicator.volumeRatio >= 1.2 ? "positive" : "neutral"]]; return <dl className="crypto-technical-grid" data-reviewed-rows>{items.map(([label, value, tone]) => <div key={label}><dt>{label}</dt><dd data-tone={tone}>{value}</dd></div>)}</dl>; }
function AlertList({ alerts }) { if (!alerts.length) return <div className="crypto-clear"><span>✓</span><div><strong>当前没有触发的技术阈值</strong><p>这不代表没有风险，只表示未命中本监控的规则。</p></div></div>; return <div className="crypto-alert-list" data-reviewed-rows>{alerts.map((alert, index) => <article key={`${alert.ticker}-${alert.label}-${index}`} data-level={alert.level}><span>{alert.ticker}</span><div><strong>{alert.label}</strong><p>{alert.detail}</p></div></article>)}</div>; }

export function DashboardContent() {
  const { reviewedRows, snapshot } = useDataApp(); const seededRows = useMemo(() => reviewedRows("market_prices", ["ticker", "date"]), [reviewedRows]); const reviewedAlerts = useMemo(() => reviewedRows("watch_alerts", ["ticker", "label"]), [reviewedRows]); const reviewedSignals = useMemo(() => reviewedRows("technical_signals", ["ticker"]), [reviewedRows]);
  const [liveRows, setLiveRows] = useState(null); const [selectedTicker, setSelectedTicker] = useState("BTC"); const [timeframe, setTimeframe] = useState("90"); const [category, setCategory] = useState("全部"); const [search, setSearch] = useState(""); const [updatedAt, setUpdatedAt] = useState(null); const [refreshing, setRefreshing] = useState(false); const [refreshError, setRefreshError] = useState(null);
  async function refresh() { setRefreshing(true); try { setLiveRows(await fetchLiveRows()); setUpdatedAt(new Date().toISOString()); setRefreshError(null); } catch { setRefreshError("实时连接暂不可用，当前继续显示上次成功加载的数据。"); } finally { setRefreshing(false); } }
  useEffect(() => { let active = true; const run = async () => { if (active) await refresh(); }; run(); const timer = window.setInterval(run, 60_000); return () => { active = false; window.clearInterval(timer); }; }, []);
  const marketRows = liveRows?.length ? liveRows : seededRows; const rowsByTicker = useMemo(() => new Map(ASSETS.map(asset => [asset.ticker, marketRows.filter(row => row.ticker === asset.ticker).sort((a, b) => a.date.localeCompare(b.date))])), [marketRows]);
  const technical = useMemo(() => ASSETS.map(asset => calculateTechnical(rowsByTicker.get(asset.ticker) ?? [], asset)).filter(Boolean), [rowsByTicker]); const technicalByTicker = useMemo(() => new Map(technical.map(item => [item.ticker, item])), [technical]); const selectedRows = rowsByTicker.get(selectedTicker) ?? []; const selected = technicalByTicker.get(selectedTicker); const alerts = technical.flatMap(item => item.alerts); const categories = ["全部", ...new Set(ASSETS.map(asset => asset.category))];
  const visibleAssets = technical.filter(item => (category === "全部" || item.category === category) && `${item.ticker} ${item.asset}`.toLowerCase().includes(search.toLowerCase())); const dataTimestamp = updatedAt ?? snapshot?.generatedAt;
  return <article className="crypto-dashboard"><h1 className="crypto-sr-only">加密资产技术雷达</h1>
    <section className="crypto-intro" aria-label="监控状态"><div><p className="crypto-eyebrow">LIQUID CRYPTO UNIVERSE · {technical.length} ASSETS</p><h2>全市场技术雷达</h2><p>先看市场广度和资金强弱，再下钻到单币日线结构。</p></div><div className="crypto-connection"><span data-live={Boolean(updatedAt) || undefined}>{updatedAt ? "实时来源已连接" : "已载入快照"}</span><small>更新：{formatUpdated(dataTimestamp)}（日本时间）</small><button type="button" onClick={refresh} disabled={refreshing}>{refreshing ? "刷新中…" : "立即刷新"}</button></div></section>
    {refreshError && <p className="crypto-connection-note" role="status">{refreshError}</p>}
    <DataComponent id="crypto-market-overview" queryId="technical_signals" kind="custom" variant="card" title="市场广度" description="按 26 个已选择、高流动性的 USDT 现货交易对统计；它不是整体加密市场总市值。" sourceRows={technical} displayRows={technical}><MarketStats indicators={technical} /></DataComponent>
    <DataComponent id="crypto-market-radar" queryId="technical_signals" kind="custom" variant="card" title="价格热力图" description="颜色表示 24 小时涨跌幅的相对强弱。点击卡片可查看该资产的日线与技术结构。" sourceRows={visibleAssets} displayRows={visibleAssets}><div className="crypto-radar-controls"><div className="crypto-category-pills" role="group" aria-label="资产分类">{categories.map(value => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div><label className="crypto-search"><span>筛选</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="BTC、LINK…" /></label></div><RadarTiles indicators={visibleAssets} selectedTicker={selectedTicker} onSelect={setSelectedTicker} /></DataComponent>
    <section className="crypto-analysis-grid" aria-label="强弱排行与单币分析">
      <DataComponent id="crypto-strength-ranking" queryId="technical_signals" kind="custom" variant="card" title="7 日相对强弱" description="按近 7 日价格变化排名，便于识别相对强势与弱势资产；不代表未来走势。" sourceRows={visibleAssets} displayRows={visibleAssets}><div className="crypto-strength-columns"><StrengthList indicators={visibleAssets} title="领涨" onSelect={setSelectedTicker} /><StrengthList indicators={visibleAssets} title="领跌" negative onSelect={setSelectedTicker} /></div></DataComponent>
      <DataComponent id="crypto-alerts" queryId="watch_alerts" queryIds={["watch_alerts", "technical_signals"]} kind="custom" variant="card" title="需留意的信号" description="仅在命中既定技术规则时显示；不把任何信号视为买卖指令。" sourceRows={reviewedAlerts} sourceRowsByQuery={{ watch_alerts: reviewedAlerts, technical_signals: reviewedSignals }} displayRows={alerts}><AlertList alerts={alerts} /></DataComponent>
    </section>
    <section className="crypto-detail-grid" aria-label="所选资产技术详情">
      <DataComponent id="crypto-price-chart" queryId="market_prices" kind="custom" variant="card" title={`${selected?.asset ?? selectedTicker} · 日线价格`} description="日线 OHLCV，叠加 20 日与 50 日简单移动平均线。最后一根日线在 UTC 收盘前可能变化。" sourceRows={selectedRows} displayRows={selectedRows}><div className="crypto-price-toolbar"><div><strong>{formatMoney(selected?.close)}</strong><span data-negative={selected?.change24h < 0 || undefined}>{formatPercent(selected?.change24h)}</span><small>{selected?.category}</small></div><div className="crypto-timeframes" role="group" aria-label="图表周期">{["30", "90", "120"].map(value => <button type="button" key={value} aria-pressed={timeframe === value} onClick={() => setTimeframe(value)}>{value}D</button>)}</div></div><PriceChart rows={selectedRows} timeframe={timeframe} /></DataComponent>
      <DataComponent id="crypto-signal-summary" queryId="technical_signals" kind="custom" variant="card" title="技术状态" description="技术指标是对已加载价格和成交额的描述，不预测未来价格。" sourceRows={[selected].filter(Boolean)} displayRows={[selected].filter(Boolean)}><div className="crypto-status-line"><TrendBadge trend={selected?.trend ?? "—"} /><span>1D {formatPercent(selected?.change24h)}</span></div><TechnicalGrid indicator={selected} /></DataComponent>
    </section>
    <DataComponent id="crypto-technical-table" queryId="technical_signals" kind="custom" variant="card" title="全量技术清单" description="筛选后的资产使用相同日线规则计算；支撑和阻力为此前 20 个完整日线的极值。" sourceRows={visibleAssets} displayRows={visibleAssets}><div className="crypto-overview-table-wrap" data-reviewed-rows><table className="crypto-overview-table"><thead><tr><th>资产</th><th>类别</th><th>1D</th><th>7D</th><th>30D</th><th>趋势</th><th>RSI</th><th>支撑</th><th>阻力</th></tr></thead><tbody>{visibleAssets.map(indicator => <tr key={indicator.ticker} data-coin={indicator.ticker}><th>{indicator.ticker}</th><td>{indicator.category}</td><td data-positive={indicator.change24h >= 0 || undefined}>{formatPercent(indicator.change24h)}</td><td data-positive={indicator.change7d >= 0 || undefined}>{formatPercent(indicator.change7d)}</td><td data-positive={indicator.change30d >= 0 || undefined}>{formatPercent(indicator.change30d)}</td><td><TrendBadge trend={indicator.trend} /></td><td>{formatNumber(indicator.rsi14, 1)}</td><td>{formatMoney(indicator.support)}</td><td>{formatMoney(indicator.resistance)}</td></tr>)}</tbody></table></div></DataComponent>
    <p className="crypto-footnote">数据源：Binance 公共市场数据接口。覆盖范围为选定的高流动性资产，不含稳定币；页面打开后每 60 秒尝试刷新。技术指标仅用于研究与风险管理，不构成投资建议。</p>
  </article>;
}
