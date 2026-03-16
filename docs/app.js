// Theme management
const body = document.body;
const themeToggle = document.getElementById("themeToggle");

// Load saved theme
const savedTheme = localStorage.getItem("theme") || "light";
body.setAttribute("data-theme", savedTheme);

// Category color mapping
const categoryColors = {
  "股指": "#DC2626",
  "加密货币": "#0891B2",
  "货币": "#2563EB",
  "能源": "#EA580C",
  "贵金属": "#B45309",
  "金属": "#7C3AED",
};
const defaultColor = "#64748B";

// State
let usStocksData = null;
let chinaStocksData = null;
let usStocksSortBy = "marketCap";
let chinaStocksSortBy = "marketCap";

// Theme toggle
themeToggle.addEventListener("click", () => {
  const currentTheme = body.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  body.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);

  // Re-render chart
  if (myChart && window.chartData) {
    renderChart(window.chartData);
  }
});

// Chart configuration
let myChart;

// Fetch data
async function fetchData(url) {
  try {
    const response = await fetch(`${url}?t=${Date.now()}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to load data from", url, error);
    return null;
  }
}

// Format market cap
function formatMarketCap(value) {
  if (value === null || value === undefined) return "-";
  const val = parseFloat(value);
  if (val >= 1e8) return Math.round(val / 1e8) + "亿";
  if (val >= 1e4) return Math.round(val / 1e4) + "万";
  return Math.round(val).toString();
}

// Get heatmap style with intensity
function getHeatmapStyle(change, maxChange) {
  if (change === null || change === undefined || change === 0) {
    return "neutral";
  }
  return change > 0 ? "positive" : "negative";
}

// Sort stocks
function sortStocks(stocks, sortBy) {
  return [...stocks].sort((a, b) => {
    if (sortBy === "change") {
      return (b.change || 0) - (a.change || 0);
    } else if (sortBy === "marketCap") {
      return (b.market_cap || 0) - (a.market_cap || 0);
    }
    return 0;
  });
}

// Render heatmap
function renderHeatmap(data, contentId, sortBy) {
  const container = document.getElementById(contentId);

  if (!data || !data.stocks || data.stocks.length === 0) {
    container.innerHTML = "<div class='loading'>暂无数据</div>";
    return;
  }

  const maxChange = Math.max(...data.stocks.map((s) => Math.abs(s.change || 0)));
  const scaleMax = Math.min(Math.max(maxChange, 3), 10);
  const sortedStocks = sortStocks(data.stocks, sortBy);

  let html = '<div class="heatmap-grid">';

  sortedStocks.forEach((stock) => {
    const isPositive = stock.change >= 0;
    const changeClass = getHeatmapStyle(stock.change, scaleMax);
    const sign = isPositive ? "+" : "";

    const priceStr = stock.price != null ? "$" + stock.price.toFixed(2) : "-";
    const changeAmountStr = stock.change_amount != null ? sign + stock.change_amount.toFixed(2) : "-";
    const changeStr = sign + stock.change.toFixed(2) + "%";
    const marketCapStr = formatMarketCap(stock.market_cap);

    html += `<div class="heatmap-item ${changeClass}" tabindex="0" role="button" aria-label="${stock.name}: ${changeStr}">
      <div class="stock-name">${stock.name}</div>
      <div class="stock-market-cap">${marketCapStr}</div>
      <div class="stock-price">${priceStr}</div>
      <div class="stock-change">${changeAmountStr} (${changeStr})</div>
    </div>`;
  });

  html += "</div>";
  container.innerHTML = html;
}

// Render chart
function renderChart(data) {
  const theme = body.getAttribute("data-theme");
  const chartDom = document.getElementById("chart");

  window.chartData = data;

  if (myChart) {
    myChart.dispose();
  }

  const echartsTheme = theme === "dark" ? "dark" : null;
  myChart = echarts.init(chartDom, echartsTheme);

  const assetData = data.assets[0];
  const items = assetData.data;

  const sortedItems = [...items].sort((a, b) => a.value - b.value);
  const yAxisData = sortedItems.map((item) => item.name);
  const categories = [...new Set(sortedItems.map((item) => item.category).filter(Boolean))];

  const series = categories.map((category) => {
    const seriesData = sortedItems.map((item) => {
      if (item.category === category) {
        const sign = item.value >= 0 ? "+" : "";
        return {
          name: item.name,
          value: Math.abs(item.value),
          originalValue: item.value,
          category: item.category,
          itemStyle: {
            color: item.value >= 0 ? "#DC2626" : "#22C55E",
          },
          label: {
            show: true,
            position: "right",
            formatter: sign + item.value.toFixed(2) + "%",
            color: item.value >= 0 ? "#DC2626" : "#22C55E",
          },
        };
      }
      return { name: "", value: null, itemStyle: { opacity: 0 } };
    });

    return {
      name: category,
      type: "bar",
      stack: "total",
      barWidth: "60%",
      itemStyle: {
        color: categoryColors[category] || defaultColor,
        borderRadius: [0, 8, 8, 0],
      },
      data: seriesData,
    };
  });

  const genTime = new Date(data.generated_at);

  // Calculate grid left based on screen width
  const isMobile = window.innerWidth < 768;
  const gridLeft = isMobile ? "22%" : "15%";
  const gridRight = isMobile ? "5%" : "12%";
  const yAxisFontSize = isMobile ? 10 : 13;
  const chartTop = isMobile ? "80" : "90";

  const option = {
    backgroundColor: "transparent",
    textStyle: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display"',
    },
    title: {
      text: assetData.title,
      left: "center",
      textStyle: { fontSize: 18, fontWeight: 600 },
    },
    legend: {
      show: true,
      type: "scroll",
      top: 50,
      data: categories.map((category) => ({
        name: category,
        textStyle: { color: categoryColors[category] || defaultColor },
      })),
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: function (params) {
        const dataParam = params.find(
          (p) => p.data && p.data.originalValue !== undefined && p.data.name
        );
        if (!dataParam || !dataParam.data.name) return "";
        const originalValue = dataParam.data.originalValue;
        const sign = originalValue >= 0 ? "+" : "";
        const category = dataParam.data.category ? `【${dataParam.data.category}】` : "";
        return `<strong>${category}${dataParam.name}</strong><br/>涨跌幅: ${sign}${originalValue.toFixed(2)}%`;
      },
    },
    grid: { left: gridLeft, right: gridRight, bottom: "3%", top: chartTop, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: { formatter: "{value}%" },
      splitLine: { lineStyle: { type: "dashed" } },
    },
    yAxis: {
      type: "category",
      data: yAxisData,
      axisLabel: {
        color: function (value, index) {
          const item = sortedItems[index];
          if (item && item.category) return categoryColors[item.category] || defaultColor;
          return null;
        },
        fontSize: yAxisFontSize,
        overflow: isMobile ? "truncate" : "none",
        width: isMobile ? 75 : null,
        ellipsis: "...",
        margin: isMobile ? 6 : 8,
        interval: 0,
      },
      axisTick: {
        interval: 0,
        inside: isMobile,
      },
      z: 10,
    },
    series: series,
  };

  myChart.setOption(option);
  window.addEventListener("resize", () => {
    if (myChart) myChart.resize();
  });
}

// Render global review
function renderGlobalReview(data) {
  const container = document.getElementById("review-content");

  if (!data || !data.regions) {
    container.innerHTML = "<div class='loading'>暂无数据</div>";
    return;
  }

  let html = "";
  const regions = ["A股", "亚太", "欧股", "美股"];

  regions.forEach((region) => {
    const indices = data.regions[region];
    if (!indices || indices.length === 0) return;

    html += `<div class="region-section"><div class="region-title">${region}</div>`;

    indices.forEach((index) => {
      const isPositive = index.change >= 0;
      const sign = isPositive ? "+" : "";
      const changeAmountStr = index.change_amount ? `${sign}${index.change_amount}` : "-";
      const closeStr = index.close ? index.close.toFixed(2) : "-";
      const changeValueClass = isPositive ? "positive" : "negative";

      const amountHtml = index.amount
        ? `<div class="data-group"><span class="label">成交</span><span class="value">${index.amount}</span></div>`
        : "";

      html += `<div class="index-item" tabindex="0">
        <div class="index-name">${index.name}</div>
        <div class="index-data">
          <div class="data-group"><span class="label">涨跌</span><span class="value ${changeValueClass}">${changeAmountStr}</span></div>
          <div class="data-group"><span class="label">收报</span><span class="value">${closeStr}</span></div>
          ${amountHtml}
        </div>
        <div class="index-change ${changeValueClass}">
          ${sign}${index.change.toFixed(2)}%
        </div>
      </div>`;
    });

    html += "</div>";
  });

  container.innerHTML = html;
}

// Render market banner stats
function renderMarketBanner(chartData) {
  const bannerSkeleton = document.querySelector(".banner-skeleton");
  const bannerContent = document.querySelector(".banner-content");
  const statsContainer = document.getElementById("marketStats");
  const lastUpdate = document.getElementById("lastUpdate");

  if (!chartData || !chartData.assets || !chartData.assets[0]) {
    return;
  }

  const items = chartData.assets[0].data;
  const positiveCount = items.filter(i => i.value > 0).length;
  const negativeCount = items.filter(i => i.value < 0).length;
  const topGainer = items.reduce((max, item) => item.value > max.value ? item : max, items[0]);
  const topLoser = items.reduce((min, item) => item.value < min.value ? item : min, items[0]);

  const genTime = new Date(chartData.generated_at);
  lastUpdate.textContent = "最后更新: " + genTime.toLocaleString("zh-CN");

  statsContainer.innerHTML = `
    <div class="stat-item">
      <span class="stat-label">上涨</span>
      <span class="stat-value positive">${positiveCount}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">下跌</span>
      <span class="stat-value negative">${negativeCount}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">领涨</span>
      <span class="stat-value">${topGainer.name} +${topGainer.value.toFixed(2)}%</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">领跌</span>
      <span class="stat-value">${topLoser.name} ${topLoser.value.toFixed(2)}%</span>
    </div>
  `;

  bannerSkeleton.classList.add("hidden");
  bannerContent.classList.remove("hidden");
}

// Setup sort buttons
function setupSortButtons() {
  document.querySelectorAll(".sort-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.closest(".heatmap-card");
      const contentId = section.querySelector("#heatmap-content") ? "heatmap-content" : "china-heatmap-content";
      const isUsSection = contentId === "heatmap-content";
      const data = isUsSection ? usStocksData : chinaStocksData;

      // Update active state
      section.querySelectorAll(".sort-btn").forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");

      // Update sort state and re-render
      if (isUsSection) {
        usStocksSortBy = btn.dataset.sort;
        if (data) renderHeatmap(data, contentId, usStocksSortBy);
      } else {
        chinaStocksSortBy = btn.dataset.sort;
        if (data) renderHeatmap(data, contentId, chinaStocksSortBy);
      }
    });
  });
}

// Staggered reveal animation
function revealOnLoad() {
  const banner = document.querySelector(".market-banner");
  const cards = document.querySelectorAll(".card");

  requestAnimationFrame(() => {
    banner.classList.add("visible");
    cards.forEach((card) => card.classList.add("visible"));
  });
}

// Hide skeletons and show content
function revealContent() {
  document.querySelectorAll(".card-skeleton").forEach((skeleton) => {
    skeleton.classList.add("hidden");
  });
  document.querySelectorAll(".chart, .review-content, .heatmap-content").forEach((content) => {
    content.classList.remove("hidden");
  });
  // Resize chart after revealing content
  if (myChart) {
    setTimeout(() => myChart.resize(), 50);
  }
}

// Initialize
(async function () {
  setupSortButtons();

  const [chartData, indicesData, usStocks, chinaStocks] = await Promise.all([
    fetchData("./data/latest.json"),
    fetchData("./data/indices.json"),
    fetchData("./data/us_stocks.json"),
    fetchData("./data/china_stocks.json"),
  ]);

  usStocksData = usStocks;
  chinaStocksData = chinaStocks;

  if (chartData) {
    renderChart(chartData);
    renderMarketBanner(chartData);
  }
  if (indicesData) renderGlobalReview(indicesData);
  if (usStocks) renderHeatmap(usStocks, "heatmap-content", usStocksSortBy);
  if (chinaStocks) renderHeatmap(chinaStocks, "china-heatmap-content", chinaStocksSortBy);

  revealContent();
  revealOnLoad();
})();
