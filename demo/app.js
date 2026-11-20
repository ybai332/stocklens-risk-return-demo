"use strict";

// Keep all three parsed tables available for the next demo iteration.
const demo = window.team237Demo = {
  selectedYear: 2025,
  selectedTicker: "NVDA",
  data: { companies: [], stockRiskReturn: [], industryRiskReturn: [] }
};
const YEARS = [2024, 2025, 2026];
const sectorColors = new Map();
const stockSearch = { companies: [], matches: [], activeIndex: -1 };
const COMPANY_LOGOS = Object.freeze({
  AMD: "./assets/logos/AMD.png",
  BAC: "./assets/logos/BAC.png",
  CVX: "./assets/logos/CVX.png",
  NVDA: "./assets/logos/NVDA.png",
  TXN: "./assets/logos/TXN.png",
  XOM: "./assets/logos/XOM.png"
});
let logoRenderVersion = 0;

function renderCompanyLogo(ticker) {
  const slot = document.getElementById("summary-logo");
  const version = ++logoRenderVersion;
  slot.dataset.ticker = ticker;
  const fallback = document.createElement("span");
  fallback.className = "logo-fallback";
  fallback.textContent = ticker;
  slot.replaceChildren(fallback);
  const source = COMPANY_LOGOS[ticker];
  if (!source) return;
  const image = document.createElement("img");
  image.alt = "";
  image.width = image.height = 32;
  image.hidden = true;
  const isCurrent = () => version === logoRenderVersion && slot.dataset.ticker === ticker && slot.contains(image);
  image.addEventListener("load", () => {
    if (!isCurrent()) return;
    fallback.hidden = true;
    image.hidden = false;
  });
  image.addEventListener("error", () => {
    if (!isCurrent()) return;
    image.remove();
    fallback.hidden = false;
  });
  slot.append(image);
  image.src = source;
}

function stockLabel(company) {
  return `${company.ticker} · ${company.company_name || "Unavailable"}`;
}

function syncStockSearch() {
  const input = document.getElementById("stock-select");
  const company = demo.data.companies.find(row => row.ticker === demo.selectedTicker);
  input.value = company ? stockLabel(company) : demo.selectedTicker;
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");
  document.getElementById("stock-results").hidden = true;
  document.getElementById("stock-options").replaceChildren();
  document.getElementById("stock-search-status").hidden = true;
  stockSearch.matches = [];
  stockSearch.activeIndex = -1;
}

function showStockOptions(query) {
  const normalizedQuery = query.trim().toLowerCase();
  stockSearch.matches = stockSearch.companies.filter(company =>
    company.ticker.toLowerCase().includes(normalizedQuery) ||
    (company.company_name || "").toLowerCase().includes(normalizedQuery)
  );
  stockSearch.activeIndex = -1;
  const input = document.getElementById("stock-select");
  input.setAttribute("aria-expanded", "true");
  input.removeAttribute("aria-activedescendant");
  document.getElementById("stock-results").hidden = false;
  const status = document.getElementById("stock-search-status");
  status.textContent = stockSearch.matches.length ? "" : "No matching stocks";
  status.hidden = stockSearch.matches.length > 0;
  d3.select("#stock-options").selectAll("li").data(stockSearch.matches, company => company.ticker)
    .join("li").attr("class", "stock-option").attr("role", "option")
    .attr("id", company => `stock-option-${company.ticker}`)
    .attr("data-ticker", company => company.ticker)
    .attr("aria-selected", company => String(company.ticker === demo.selectedTicker))
    .text(stockLabel)
    .on("mousedown", event => event.preventDefault())
    .on("click", (event, company) => setSelection({ ticker: company.ticker }));
}

function setActiveStockOption(index) {
  stockSearch.activeIndex = index;
  const ticker = stockSearch.matches[index].ticker;
  document.getElementById("stock-select").setAttribute("aria-activedescendant", `stock-option-${ticker}`);
  d3.select("#stock-options").selectAll("li").classed("active", company => company.ticker === ticker);
  document.getElementById(`stock-option-${ticker}`).scrollIntoView?.({ block: "nearest" });
}

function configureStockSearch() {
  stockSearch.companies = [...demo.data.companies].sort((first, second) => first.ticker.localeCompare(second.ticker));
  const input = document.getElementById("stock-select");
  syncStockSearch();
  input.addEventListener("focus", () => {
    showStockOptions("");
    input.select?.();
  });
  input.addEventListener("click", () => {
    if (document.getElementById("stock-results").hidden) showStockOptions("");
  });
  input.addEventListener("input", () => showStockOptions(input.value));
  input.addEventListener("blur", syncStockSearch);
  input.addEventListener("keydown", event => {
    if (event.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (document.getElementById("stock-results").hidden) showStockOptions("");
      const count = stockSearch.matches.length;
      if (!count) return;
      const index = event.key === "ArrowDown"
        ? (stockSearch.activeIndex + 1) % count
        : (stockSearch.activeIndex < 0 ? count - 1 : (stockSearch.activeIndex - 1 + count) % count);
      setActiveStockOption(index);
    } else if (event.key === "Enter" && !document.getElementById("stock-results").hidden) {
      const company = stockSearch.matches[Math.max(0, stockSearch.activeIndex)];
      if (company) {
        event.preventDefault();
        setSelection({ ticker: company.ticker });
      }
    } else if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      syncStockSearch();
    }
  });
}

function configureSectorColors() {
  const sectors = [...new Set([
    ...demo.data.companies.map(row => row.sector),
    ...demo.data.stockRiskReturn.map(row => row.sector)
  ].filter(Boolean))].sort((first, second) => first.localeCompare(second));
  sectors.forEach((sector, index) => sectorColors.set(sector, d3.schemeTableau10[index % 10]));
}

function sectorColor(sector) {
  return sectorColors.get(sector) || "#808080";
}

function renderSectorLegend(points) {
  const visibleSectors = new Set(points.map(row => row.sector || ""));
  const sectors = [...sectorColors.keys(), ""].filter(sector => visibleSectors.has(sector));
  const items = d3.select("#sector-legend").selectAll(".sector-legend-item")
    .data(sectors, sector => sector).join(enter => {
      const item = enter.append("li").attr("class", "sector-legend-item");
      item.append("span").attr("class", "sector-swatch").attr("aria-hidden", "true");
      item.append("span").attr("class", "sector-name");
      return item;
    });
  items.select(".sector-swatch").style("background-color", sector => sectorColor(sector));
  items.select(".sector-name").text(sector => sector || "Sector unavailable");
}

function updateStatus(id, message = "", state = "missing") {
  const status = document.getElementById(id);
  status.textContent = message;
  status.dataset.state = message ? state : "ready";
  status.hidden = !message;
}

function formatPercent(value) {
  return Number.isFinite(value) ? d3.format(".2%")(value) : "Unavailable";
}

function industryKey(row) {
  return JSON.stringify([row.sector, row.industry]);
}

function getViewData() {
  const { selectedYear: year, selectedTicker: ticker } = demo;
  const points = demo.data.stockRiskReturn.filter(row =>
    row.year === year &&
    Number.isFinite(row.annualized_volatility) && row.annualized_volatility >= 0 &&
    Number.isFinite(row.annualized_return)
  );
  const industries = demo.data.industryRiskReturn.filter(row => row.year === year)
    .sort((a, b) => a.industry.localeCompare(b.industry) || a.sector.localeCompare(b.sector));
  // Company metadata remains available even when the selected stock has no annual point.
  const company = demo.data.companies.find(row => row.ticker === ticker);
  const selectedAnnualRow = demo.data.stockRiskReturn.find(row =>
    row.year === year && row.ticker === ticker
  );
  const selectedPoint = points.find(row => row.ticker === ticker);
  const selectedIndustry = company?.sector && company?.industry
    ? industries.find(row => row.sector === company.sector && row.industry === company.industry)
    : undefined;
  return { year, ticker, points, industries, company, selectedAnnualRow, selectedPoint, selectedIndustry };
}

function renderStockSummary({ year, ticker, company, selectedAnnualRow }) {
  const values = {
    "stock-summary-title": `Selected Stock Summary · ${year}`,
    "summary-company": company?.company_name || "Unavailable",
    "summary-ticker": ticker,
    "summary-industry": company?.industry || "Unavailable",
    "summary-annualized-return": formatPercent(selectedAnnualRow?.annualized_return),
    "summary-annualized-volatility": formatPercent(selectedAnnualRow?.annualized_volatility),
    "summary-period-return": formatPercent(selectedAnnualRow?.period_return),
    "summary-period-start": selectedAnnualRow?.period_start || "Unavailable",
    "summary-period-end": selectedAnnualRow?.period_end || "Unavailable",
    "summary-observations": Number.isFinite(selectedAnnualRow?.trading_returns)
      ? String(selectedAnnualRow.trading_returns) : "Unavailable"
  };
  for (const [id, value] of Object.entries(values)) document.getElementById(id).textContent = value;
  document.getElementById("stock-summary").setAttribute("aria-busy", "false");
}

function setSelection({ year = demo.selectedYear, ticker = demo.selectedTicker } = {}) {
  const selectedYear = parseNumber(year);
  if (!YEARS.includes(selectedYear) || !demo.data.companies.some(row => row.ticker === ticker)) return;
  demo.selectedYear = selectedYear;
  demo.selectedTicker = ticker;
  document.getElementById("year-select").value = String(selectedYear);
  syncStockSearch();
  renderCharts();
}

function configureControls() {
  const yearSelect = document.getElementById("year-select");
  const stockSelect = document.getElementById("stock-select");
  const option = (value, label) => {
    const element = document.createElement("option");
    element.value = value;
    element.textContent = label;
    return element;
  };
  yearSelect.replaceChildren(...YEARS.map(year => option(String(year), String(year))));
  yearSelect.value = String(demo.selectedYear);
  configureStockSearch();
  yearSelect.addEventListener("change", event => setSelection({ year: event.target.value }));
  yearSelect.disabled = stockSelect.disabled = false;
}

function parseNumber(value) {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseNumericFields(row, fields) {
  const parsed = { ...row };
  for (const field of fields) parsed[field] = parseNumber(row[field]);
  return parsed;
}

async function loadCsv(filename, numericFields = []) {
  try {
    return await d3.csv(`../demo-data/${filename}`, row => parseNumericFields(row, numericFields));
  } catch (error) {
    throw new Error(`${filename}: ${error.message}`);
  }
}

function renderFigure1({ points, selectedPoint }) {
  if (points.length === 0) throw new Error(`No valid stock-year metrics for ${demo.selectedYear}.`);

  const width = 920;
  const height = 540;
  const margin = { top: 32, right: 48, bottom: 72, left: 88 };
  const percent = d3.format(".0%");
  const xMax = d3.max(points, row => row.annualized_volatility);
  const [yMin, yMax] = d3.extent(points, row => row.annualized_return);
  const yLow = Math.min(0, yMin);
  const yHigh = Math.max(0, yMax);
  const yPadding = (yHigh - yLow || 0.1) * 0.08;
  const x = d3.scaleLinear()
    .domain([0, xMax > 0 ? xMax * 1.08 : 0.1]).nice()
    .range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain([yLow - yPadding, yHigh + yPadding]).nice()
    .range([height - margin.bottom, margin.top]);

  const svg = d3.select("#chart-1");
  if (svg.empty()) throw new Error("Chart SVG #chart-1 is missing.");
  svg.selectAll("*").remove();
  svg.append("title").attr("id", "chart-title")
    .text(`${demo.selectedYear} annualized return versus volatility`);
  svg.append("desc").attr("id", "chart-description")
    .text(`${demo.selectedYear}. ${points.length} stock-year points. X: annualized volatility. Y: annualized return. ${selectedPoint ? `${demo.selectedTicker} is outlined and labeled.` : `${demo.selectedTicker} has no eligible annual point.`} Stocks with missing classifications are included.`);

  svg.append("line").attr("class", "zero-line")
    .attr("x1", margin.left).attr("x2", width - margin.right)
    .attr("y1", y(0)).attr("y2", y(0));
  svg.append("g").attr("class", "axis x-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(7).tickFormat(percent));
  svg.append("g").attr("class", "axis y-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(7).tickFormat(percent));
  svg.append("text").attr("class", "axis-label")
    .attr("x", (margin.left + width - margin.right) / 2).attr("y", height - 16)
    .attr("text-anchor", "middle").text("Annualized volatility");
  svg.append("text").attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -(margin.top + height - margin.bottom) / 2).attr("y", 24)
    .attr("text-anchor", "middle").text("Annualized return");

  // Classification is optional metadata, never a condition for plotting a stock.
  svg.append("g").attr("class", "stock-points")
    .selectAll("circle").data(points, row => row.ticker).join("circle")
    .attr("data-ticker", row => row.ticker)
    .attr("cx", row => x(row.annualized_volatility))
    .attr("cy", row => y(row.annualized_return))
    .attr("r", row => row.ticker === demo.selectedTicker ? 8 : 6)
    .attr("fill", row => sectorColor(row.sector))
    .attr("stroke", row => row.ticker === demo.selectedTicker ? "#182536" : "white")
    .attr("stroke-width", row => row.ticker === demo.selectedTicker ? 3 : 1.5)
    .attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", row => `Select ${row.ticker}`)
    .attr("aria-pressed", row => String(row.ticker === demo.selectedTicker))
    .on("click", (event, row) => setSelection({ ticker: row.ticker }))
    .on("keydown", (event, row) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setSelection({ ticker: row.ticker });
      }
    })
    .append("title").text(row => [
      `${row.ticker} · ${row.company_name || "Unavailable"}`,
      `Sector: ${row.sector || "Unavailable"}`,
      `Industry: ${row.industry || "Unavailable"}`,
      `Annualized volatility: ${formatPercent(row.annualized_volatility)}`,
      `Annualized return: ${formatPercent(row.annualized_return)}`,
      `Period return: ${formatPercent(row.period_return)}`,
      `${row.period_start} to ${row.period_end}`
    ].join("\n"));

  svg.append("g").selectAll("text")
    .data(points.filter(row => row.ticker === demo.selectedTicker)).join("text")
    .attr("class", "ticker-label")
    .attr("x", row => x(row.annualized_volatility) + 12)
    .attr("y", row => y(row.annualized_return) - 12)
    .text(row => row.ticker);

  renderSectorLegend(points);
  document.getElementById("chart-1-context").textContent = `Demo sample · ${points.length} stocks shown.`;
  updateStatus("chart-status", selectedPoint ? "" : `No annual data for ${demo.selectedTicker} in ${demo.selectedYear}.`);
}

function renderFigure2({ industries, company, selectedIndustry }) {
  if (industries.length === 0) throw new Error(`No industry data for ${demo.selectedYear}.`);
  const metrics = ["mean_annualized_return", "mean_annualized_volatility"];
  if (industries.some(row => metrics.some(field => !Number.isFinite(row[field])) || row.mean_annualized_volatility < 0)) {
    throw new Error(`Missing or invalid industry metrics for ${demo.selectedYear}.`);
  }
  const svg = d3.select("#chart-2");
  if (svg.empty()) throw new Error("Chart SVG #chart-2 is missing.");
  svg.selectAll("*").remove();
  svg.append("title").attr("id", "industry-title").text(`${demo.selectedYear} industry comparison`);
  svg.append("desc").attr("id", "industry-description")
    .text(`${demo.selectedYear}. ${industries.length} industries. Aligned annualized return and volatility means for all eligible stocks in the project universe. ${selectedIndustry ? `${selectedIndustry.industry} is highlighted for ${demo.selectedTicker}.` : "No industry highlighted."}`);

  const top = 84;
  const bottom = 450;
  const y = d3.scaleBand().domain(industries.map(industryKey)).range([top, bottom]).padding(0.25);
  const panels = [
    { field: metrics[0], label: "Mean annualized return", range: [360, 670], color: "#3475ae", className: "return-bar" },
    { field: metrics[1], label: "Mean annualized volatility", range: [810, 1110], color: "#26858a", className: "volatility-bar" }
  ];
  for (const panel of panels) {
    const [minimum, maximum] = d3.extent(industries, row => row[panel.field]);
    panel.scale = d3.scaleLinear()
      .domain([Math.min(0, minimum) * 1.15, Math.max(0, maximum) * 1.15 || 0.1]).nice()
      .range(panel.range);
    svg.append("text").attr("class", "axis-label")
      .attr("x", (panel.range[0] + panel.range[1]) / 2).attr("y", 36)
      .attr("text-anchor", "middle").text(panel.label);
    svg.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${bottom + 12})`)
      .call(d3.axisBottom(panel.scale).ticks(5).tickFormat(d3.format(".0%")));
    svg.append("line").attr("class", "zero-line")
      .attr("x1", panel.scale(0)).attr("x2", panel.scale(0))
      .attr("y1", top - 12).attr("y2", bottom);
  }

  const rows = svg.append("g").selectAll("g").data(industries, industryKey).join("g")
    .attr("class", row => `industry-row${row === selectedIndustry ? " selected" : ""}`)
    .attr("data-sector", row => row.sector).attr("data-industry", row => row.industry)
    .attr("transform", row => `translate(0,${y(industryKey(row)) + y.bandwidth() / 2})`);
  rows.append("rect").attr("x", 0).attr("y", -25).attr("width", 1160).attr("height", 50)
    .attr("fill", row => row === selectedIndustry ? "#fff0df" : "transparent");
  rows.append("text").attr("class", "industry-name").attr("x", 18).attr("y", -3)
    .attr("font-weight", row => row === selectedIndustry ? 700 : 400).text(row => row.industry);
  rows.append("text").attr("class", "industry-count").attr("x", 18).attr("y", 16)
    .text(row => `${row.sector} · n = ${row.company_count ?? "Unavailable"}`);
  for (const panel of panels) {
    rows.append("rect").attr("class", `industry-bar ${panel.className}`)
      .attr("data-value", row => row[panel.field])
      .attr("x", row => panel.scale(Math.min(0, row[panel.field])))
      .attr("y", -12).attr("height", 24)
      .attr("width", row => Math.abs(panel.scale(row[panel.field]) - panel.scale(0)))
      .attr("fill", row => row === selectedIndustry ? "#e57617" : panel.color)
      .append("title").text(row => [
        `${row.sector} · ${row.industry}`,
        `Eligible stocks: ${row.company_count ?? "Unavailable"}`,
        `${panel.label}: ${formatPercent(row[panel.field])}`,
        `${row.period_start} to ${row.period_end}`,
        "Official mean of all eligible stocks in this industry within the project stock universe."
      ].join("\n"));
    rows.append("text").attr("class", `bar-value ${panel.className}-value`)
      .attr("x", row => panel.scale(row[panel.field]) + (row[panel.field] < 0 ? -6 : 6))
      .attr("y", 5).attr("text-anchor", row => row[panel.field] < 0 ? "end" : "start")
      .text(row => formatPercent(row[panel.field]));
  }
  updateStatus("industry-status", selectedIndustry ? "" : company?.sector && company?.industry
    ? `No industry data for ${company.industry} in ${demo.selectedYear}.`
    : `Industry classification unavailable for ${demo.selectedTicker}.`);
}

function renderCharts() {
  const view = getViewData();
  renderStockSummary(view);
  document.getElementById("year-cutoff").hidden = demo.selectedYear !== 2026;
  // Each chart reports its own failure so one failure does not suppress the other.
  for (const chart of [
    { id: "chart-1", statusId: "chart-status", name: "Figure 1", render: renderFigure1 },
    { id: "chart-2", statusId: "industry-status", name: "Figure 2", render: renderFigure2 }
  ]) {
    try {
      chart.render(view);
    } catch (error) {
      document.getElementById(chart.id)?.replaceChildren();
      if (chart.id === "chart-1") document.getElementById("sector-legend").replaceChildren();
      updateStatus(chart.statusId, `${chart.name} rendering failed: ${error.message}`, "error");
      console.error(`${chart.name} rendering failed:`, error);
    }
  }
}

// One startup entry point, one parallel request per table, no diagnostic fetches.
async function initializeDemo() {
  try {
    if (!window.d3) throw new Error("D3 v7 did not load. Check the CDN script request.");
    const [companies, stockRiskReturn, industryRiskReturn] = await Promise.all([
      loadCsv("companies.csv"),
      loadCsv("stock_risk_return.csv", [
        "year", "trading_returns", "period_return", "annualized_return", "annualized_volatility"
      ]),
      loadCsv("industry_risk_return.csv", [
        "year", "company_count", "mean_period_return", "mean_annualized_return", "mean_annualized_volatility"
      ])
    ]);
    Object.assign(demo.data, { companies, stockRiskReturn, industryRiskReturn });
    configureSectorColors();
    document.getElementById("data-counts").textContent = `Companies: ${companies.length} | Stock-year: ${stockRiskReturn.length} | Industry-year: ${industryRiskReturn.length}`;
    configureControls();
    updateStatus("data-status");
  } catch (error) {
    updateStatus("data-status", `Data loading failed: ${error.message}`, "error");
    document.getElementById("stock-summary").setAttribute("aria-busy", "false");
    document.getElementById("data-counts").textContent = "Data unavailable.";
    console.error("Demo data loading failed:", error);
    return;
  }

  renderCharts();
}

demo.setSelection = setSelection;
initializeDemo();
