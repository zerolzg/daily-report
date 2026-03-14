// Theme management
const body = document.body;
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.querySelector(".theme-icon");

// Load saved theme
const savedTheme = localStorage.getItem("theme") || "light";
body.setAttribute("data-theme", savedTheme);
updateThemeIcon(savedTheme);

// Category color mapping for Y-axis labels (简化为单色，移除手动 light/dark 映射)
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

// Load data and render chart
async function loadData() {
  try {
    const response = await fetch("./data/latest.json?t=" + Date.now());
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to load data:", error);
    return null;
  }
}

function renderChart(data) {
  const theme = body.getAttribute("data-theme");
  const chartDom = document.getElementById("chart");

  // Store data for theme switching
  window.chartData = data;

  // Dispose existing chart if exists
  if (myChart) {
    myChart.dispose();
  }

  // Initialize with dark theme if needed (原生 ECharts 黑夜模式机制)
  const echartsTheme = theme === "dark" ? "dark" : null;
  myChart = echarts.init(chartDom, echartsTheme);

  const assetData = data.assets[0];
  const items = assetData.data;

  // Sort by value ascending (highest at top for horizontal bar chart)
  const sortedItems = [...items].sort((a, b) => a.value - b.value);

  // Create Y-axis labels directly from sortedItems
  const yAxisData = sortedItems.map((item) => item.name);

  // Get unique categories for legend
  const categories = [
    ...new Set(sortedItems.map((item) => item.category).filter(Boolean)),
  ];

  // Create one series per category for legend
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
      // Use null to hide bar but keep position
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
    // 基础字体样式可以通过 option 全局定义
    textStyle: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display"',
    },
    title: {
      text: assetData.title,
      subtext: `数据更新时间：${genTime.toLocaleString()}`,
      left: "center",
      textStyle: {
        fontSize: 20,
        fontWeight: 600,
      },
    },
    legend: {
      show: true,
      type: "scroll",
      top: 70,
      data: categories.map((category) => {
        return {
          name: category,
          textStyle: {
            color: categoryColors[category] || defaultColor,
          },
        };
      }),
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      formatter: function (params) {
        // Find the data with originalValue
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
      axisLabel: {
        formatter: "{value}%",
      },
      splitLine: {
        lineStyle: {
          type: "dashed",
        },
      },
    },
    yAxis: {
      type: "category",
      data: yAxisData,
      axisLabel: {
        color: function (value, index) {
          const item = sortedItems[index];
          if (item && item.category) {
            return categoryColors[item.category] || defaultColor;
          }
          return null; // 返回 null 交给 ECharts 默认黑夜/白天主题处理
        },
        fontSize: 13,
      },
    },
    series: series,
  };

  myChart.setOption(option);

  // Responsive
  window.addEventListener("resize", () => {
    if (myChart) {
      myChart.resize();
    }
  });
}

// Load indices data and render
async function loadIndicesData() {
  try {
    const response = await fetch("./data/indices.json?t=" + Date.now());
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to load indices data:", error);
    return null;
  }
}

// Render global review (适配 Apple Style 布局)
function renderGlobalReview(data) {
  const container = document.getElementById("review-content");
  const subtitle = document.querySelector("#global-review .card-subtitle");

  if (!data || !data.regions) {
    container.innerHTML = "<div class='loading'>暂无数据</div>";
    return;
  }

  // Update subtitle with time
  if (data.generated_at) {
    const dt = new Date(data.generated_at);
    subtitle.textContent = dt.toLocaleString("zh-CN") + " 更新";
  }

  let html = "";
  const regions = ["A股", "亚太", "欧股", "美股"];

  regions.forEach((region) => {
    const indices = data.regions[region];
    if (!indices || indices.length === 0) return;

    html += `<div class="region-section">
      <div class="region-title">${region}</div>`;

    indices.forEach((index) => {
      const isPositive = index.change >= 0;
      const sign = isPositive ? "+" : "";
      const changeSign = isPositive ? "+" : "";
      const changeAmountStr = index.change_amount
        ? `${changeSign}${index.change_amount}`
        : "-";
      const closeStr = index.close ? index.close.toFixed(2) : "-";
      const changeValueClass = isPositive ? "positive" : "negative";

      const amountHtml = index.amount
        ? `<div class="data-group"><span class="label">成交</span><span class="value">${index.amount}</span></div>`
        : "";

      // 替换为极简的一行 Flexbox 布局
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

// Load US stocks data
async function loadUsStocksData() {
  try {
    const response = await fetch("./data/us_stocks.json?t=" + Date.now());
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to load US stocks data:", error);
    return null;
  }
}

// Load China stocks data
async function loadChinaStocksData() {
  try {
    const response = await fetch("./data/china_stocks.json?t=" + Date.now());
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to load China stocks data:", error);
    return null;
  }
}

// Format market cap in Chinese units
function formatMarketCap(value) {
  if (value === null || value === undefined) return "-";
  const val = parseFloat(value);
  if (val >= 1e8) {
    return Math.round(val / 1e8) + "亿";
  } else if (val >= 1e4) {
    return Math.round(val / 1e4) + "万";
  } else {
    return Math.round(val).toString();
  }
}

// Render US stocks heatmap
function renderUsHeatmap(data) {
  const container = document.getElementById("heatmap-content");
  const subtitle = document.querySelector("#us-heatmap .card-subtitle");

  if (!data || !data.stocks || data.stocks.length === 0) {
    container.innerHTML = "<div class='loading'>暂无数据</div>";
    return;
  }

  // Update subtitle with time
  if (data.generated_at) {
    const dt = new Date(data.generated_at);
    subtitle.textContent = dt.toLocaleString("zh-CN") + " 更新";
  }

  let html = '<div class="heatmap-grid">';

  data.stocks.forEach((stock) => {
    const isPositive = stock.change >= 0;
    const changeClass = isPositive
      ? "positive"
      : stock.change < 0
        ? "negative"
        : "neutral";
    const sign = isPositive ? "+" : "";
    const changeSign = isPositive ? "+" : "";

    const priceStr =
      stock.price !== null && stock.price !== undefined
        ? "$" + stock.price.toFixed(2)
        : "-";
    const changeAmountStr =
      stock.change_amount !== null && stock.change_amount !== undefined
        ? changeSign + stock.change_amount.toFixed(2)
        : "-";
    const changeStr = sign + stock.change.toFixed(2) + "%";
    const marketCapStr = formatMarketCap(stock.market_cap);

    html += `<div class="heatmap-item ${changeClass}">
      <div class="stock-name">${stock.name}</div>
      <div class="stock-market-cap">${marketCapStr}</div>
      <div class="stock-price">${priceStr}</div>
      <div class="stock-change">${changeAmountStr} (${changeStr})</div>
    </div>`;
  });

  html += "</div>";
  container.innerHTML = html;
}

// Render China stocks heatmap
function renderChinaHeatmap(data) {
  const container = document.getElementById("china-heatmap-content");
  const subtitle = document.querySelector("#china-heatmap .card-subtitle");

  if (!data || !data.stocks || data.stocks.length === 0) {
    container.innerHTML = "<div class='loading'>暂无数据</div>";
    return;
  }

  // Update subtitle with time
  if (data.generated_at) {
    const dt = new Date(data.generated_at);
    subtitle.textContent = dt.toLocaleString("zh-CN") + " 更新";
  }

  let html = '<div class="heatmap-grid">';

  data.stocks.forEach((stock) => {
    const isPositive = stock.change >= 0;
    const changeClass = isPositive
      ? "positive"
      : stock.change < 0
        ? "negative"
        : "neutral";
    const sign = isPositive ? "+" : "";
    const changeSign = isPositive ? "+" : "";

    const priceStr =
      stock.price !== null && stock.price !== undefined
        ? "$" + stock.price.toFixed(2)
        : "-";
    const changeAmountStr =
      stock.change_amount !== null && stock.change_amount !== undefined
        ? changeSign + stock.change_amount.toFixed(2)
        : "-";
    const changeStr = sign + stock.change.toFixed(2) + "%";
    const marketCapStr = formatMarketCap(stock.market_cap);

    html += `<div class="heatmap-item ${changeClass}">
      <div class="stock-name">${stock.name}</div>
      <div class="stock-market-cap">${marketCapStr}</div>
      <div class="stock-price">${priceStr}</div>
      <div class="stock-change">${changeAmountStr} (${changeStr})</div>
    </div>`;
  });

  html += "</div>";
  container.innerHTML = html;
}

// Initialize
(async function () {
  const data = await loadData();
  if (data) {
    renderChart(data);
  }

  const indicesData = await loadIndicesData();
  if (indicesData) {
    renderGlobalReview(indicesData);
  }

  const usStocksData = await loadUsStocksData();
  if (usStocksData) {
    renderUsHeatmap(usStocksData);
  }

  const chinaStocksData = await loadChinaStocksData();
  if (chinaStocksData) {
    renderChinaHeatmap(chinaStocksData);
  }
})();
