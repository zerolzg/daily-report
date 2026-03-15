// Theme management
const body = document.body;
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.querySelector(".theme-icon");

// Load saved theme
const savedTheme = localStorage.getItem("theme") || "light";
body.setAttribute("data-theme", savedTheme);
updateThemeIcon(savedTheme);

// Category color mapping for Y-axis labels
const categoryColors = {
  股指: "#E11D48",
  加密货币: "#0891B2",
  货币: "#2563EB",
  能源: "#EA580C",
  贵金属: "#B45309",
  金属: "#7C3AED",
};

// Default color for unknown categories
const defaultColor = "#888888";

themeToggle.addEventListener("click", () => {
  const currentTheme = body.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  body.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeIcon(newTheme);

  // Re-render chart with new theme
  if (myChart && window.chartData) {
    renderChart(window.chartData);
  }
});

function updateThemeIcon(theme) {
  themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
}

// Chart configuration
let myChart;

// --- 公共数据请求方法 (复用) ---
async function fetchData(url) {
  try {
    const response = await fetch(`${url}?t=${Date.now()}`);
    return await response.json();
  } catch (error) {
    console.error(`Failed to load data from ${url}:`, error);
    return null;
  }
}

// --- ECharts 柱状图渲染 ---
function renderChart(data) {
  const theme = body.getAttribute("data-theme");
  const chartDom = document.getElementById("chart");

  // Store data for theme switching
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
  const categories = [
    ...new Set(sortedItems.map((item) => item.category).filter(Boolean)),
  ];

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
            color: item.value >= 0 ? "#FF3B30" : "#34C759",
          },
          label: {
            show: true,
            position: "right",
            formatter: sign + item.value.toFixed(2) + "%",
            color: item.value >= 0 ? "#FF3B30" : "#34C759",
          },
        };
      }
      return {
        name: "",
        value: null,
        itemStyle: { opacity: 0 },
      };
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

  const option = {
    backgroundColor: "transparent",
    textStyle: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display"',
    },
    title: {
      text: assetData.title,
      subtext: `数据更新时间：${genTime.toLocaleString()}`,
      left: "center",
      textStyle: { fontSize: 20, fontWeight: 600 },
    },
    legend: {
      show: true,
      type: "scroll",
      top: 70,
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
          (p) => p.data && p.data.originalValue !== undefined && p.data.name,
        );
        if (!dataParam || !dataParam.data.name) return "";
        const originalValue = dataParam.data.originalValue;
        const sign = originalValue >= 0 ? "+" : "";
        const category = dataParam.data.category
          ? `【${dataParam.data.category}】`
          : "";
        return `<strong>${category}${dataParam.name}</strong><br/>涨跌幅: ${sign}${originalValue.toFixed(2)}%`;
      },
    },
    grid: {
      left: "10%",
      right: "15%",
      bottom: "3%",
      top: "100",
      containLabel: true,
    },
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
          if (item && item.category)
            return categoryColors[item.category] || defaultColor;
          return null;
        },
        fontSize: 13,
      },
    },
    series: series,
  };

  myChart.setOption(option);
  window.addEventListener("resize", () => {
    if (myChart) myChart.resize();
  });
}

// --- 隔日全球走势回顾渲染 ---
function renderGlobalReview(data) {
  const container = document.getElementById("review-content");
  const subtitle = document.querySelector("#global-review .card-subtitle");

  if (!data || !data.regions) {
    container.innerHTML = "<div class='loading'>暂无数据</div>";
    return;
  }

  if (data.generated_at) {
    const dt = new Date(data.generated_at);
    subtitle.textContent = dt.toLocaleString("zh-CN") + " 更新";
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
      const changeAmountStr = index.change_amount
        ? `${sign}${index.change_amount}`
        : "-";
      const closeStr = index.close ? index.close.toFixed(2) : "-";
      const changeValueClass = isPositive ? "positive" : "negative";

      const amountHtml = index.amount
        ? `<div class="data-group"><span class="label">成交</span><span class="value">${index.amount}</span></div>`
        : "";

      html += `<div class="index-item">
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

// Format market cap
function formatMarketCap(value) {
  if (value === null || value === undefined) return "-";
  const val = parseFloat(value);
  if (val >= 1e8) return Math.round(val / 1e8) + "亿";
  if (val >= 1e4) return Math.round(val / 1e4) + "万";
  return Math.round(val).toString();
}

// --- 颜色插值与热力图渐变计算 ---
function interpolateColor(color1, color2, factor) {
  return [
    Math.round(color1[0] + factor * (color2[0] - color1[0])),
    Math.round(color1[1] + factor * (color2[1] - color1[1])),
    Math.round(color1[2] + factor * (color2[2] - color1[2])),
  ];
}

function getHeatmapStyle(change, maxChange) {
  if (change === null || change === undefined || change === 0) {
    return "background: linear-gradient(135deg, #6E6E73, #8E8E93);";
  }

  const intensity = Math.min(Math.abs(change) / maxChange, 1);

  // 用 sqrt 映射：小幅度时增长快（区分细小差异），大幅度时趋于饱和
  // 再配合更宽的起点终点色差，整体层次感最强
  const factor = Math.sqrt(intensity); // 范围: [0, 1.0]，但低端增长更快

  if (change > 0) {
    // 低强度：可辨识的浅砖红；高强度：高饱和鲜红
    const c1 = interpolateColor([140, 50, 50], [230, 20, 20], factor);
    const c2 = interpolateColor([160, 70, 70], [255, 80, 50], factor);
    return `background: linear-gradient(135deg, rgb(${c1.join(",")}), rgb(${c2.join(",")}));`;
  } else {
    // 低强度：可辨识的深橄榄绿；高强度：高饱和翠绿
    const c1 = interpolateColor([30, 100, 55], [20, 180, 70], factor);
    const c2 = interpolateColor([40, 120, 65], [48, 215, 90], factor);
    return `background: linear-gradient(135deg, rgb(${c1.join(",")}), rgb(${c2.join(",")}));`;
  }
}

// --- 公共热力图渲染方法 (复用) ---
function renderHeatmap(data, contentId, sectionId) {
  const container = document.getElementById(contentId);
  const subtitle = document.querySelector(`#${sectionId} .card-subtitle`);

  if (!data || !data.stocks || data.stocks.length === 0) {
    container.innerHTML = "<div class='loading'>暂无数据</div>";
    return;
  }

  if (data.generated_at) {
    const dt = new Date(data.generated_at);
    subtitle.textContent = dt.toLocaleString("zh-CN") + " 更新";
  }

  // 动态计算最大涨跌幅
  const maxChange = Math.max(
    ...data.stocks.map((s) => Math.abs(s.change || 0)),
  );
  const scaleMax = Math.min(Math.max(maxChange, 3), 10);

  let html = '<div class="heatmap-grid">';

  data.stocks.forEach((stock) => {
    const isPositive = stock.change >= 0;
    const sign = isPositive ? "+" : "";

    const priceStr = stock.price != null ? "$" + stock.price.toFixed(2) : "-";
    const changeAmountStr =
      stock.change_amount != null ? sign + stock.change_amount.toFixed(2) : "-";
    const changeStr = sign + stock.change.toFixed(2) + "%";
    const marketCapStr = formatMarketCap(stock.market_cap);

    // 获取动态渐变背景色
    const bgStyle = getHeatmapStyle(stock.change, scaleMax);

    html += `<div class="heatmap-item" style="${bgStyle}">
      <div class="stock-name">${stock.name}</div>
      <div class="stock-market-cap">${marketCapStr}</div>
      <div class="stock-price">${priceStr}</div>
      <div class="stock-change">${changeAmountStr} (${changeStr})</div>
    </div>`;
  });

  html += "</div>";
  container.innerHTML = html;
}

// --- 初始化 (利用 Promise.all 并发加载优化速度) ---
(async function () {
  const [chartData, indicesData, usStocksData, chinaStocksData] =
    await Promise.all([
      fetchData("./data/latest.json"),
      fetchData("./data/indices.json"),
      fetchData("./data/us_stocks.json"),
      fetchData("./data/china_stocks.json"),
    ]);

  if (chartData) renderChart(chartData);
  if (indicesData) renderGlobalReview(indicesData);
  if (usStocksData)
    renderHeatmap(usStocksData, "heatmap-content", "us-heatmap");
  if (chinaStocksData)
    renderHeatmap(chinaStocksData, "china-heatmap-content", "china-heatmap");
})();
