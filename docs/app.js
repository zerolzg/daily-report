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
  股指: { light: "#FF6B6B", dark: "#FF6B6B" },
  加密货币: { light: "#4ECDC4", dark: "#4ECDC4" },
  货币: { light: "#45B7D1", dark: "#45B7D1" },
  能源: { light: "#FFA07A", dark: "#FFA07A" },
  贵金属: { light: "#FFD700", dark: "#FFD700" },
  金属: { light: "#9370DB", dark: "#9370DB" },
};

// Default color for unknown categories
const defaultColor = { light: "#888888", dark: "#888888" };

themeToggle.addEventListener("click", () => {
  const currentTheme = body.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  body.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeIcon(newTheme);

  // Re-render chart with new theme
  if (window.myChart && window.chartData) {
    renderChart(window.chartData);
  }
});

function updateThemeIcon(theme) {
  themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
}

function getCategoryColor(category, theme) {
  const color = categoryColors[category] || defaultColor;
  return color[theme];
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

  // Initialize with dark theme if needed
  const echartsTheme = theme === "dark" ? "dark" : null;
  myChart = echarts.init(chartDom, echartsTheme);

  const assetData = data.assets[0];
  const items = assetData.data;

  // Sort by value ascending (highest at top for horizontal bar chart)
  const sortedItems = [...items].sort((a, b) => a.value - b.value);

  // Prepare data for ECharts (used primarily for Y-axis here)
  const chartData = sortedItems.map((item) => {
    const category = item.category || "";
    const barColor = item.value >= 0 ? "#FF3B30" : "#34C759";
    const sign = item.value >= 0 ? "+" : "";
    return {
      name: item.name,
      value: Math.abs(item.value),
      originalValue: item.value,
      category: category,
      itemStyle: {
        color: barColor,
      },
      label: {
        show: true,
        position: "right",
        formatter: sign + item.value.toFixed(2) + "%",
        color: barColor,
      },
    };
  });

  // Create Y-axis labels
  const yAxisData = chartData.map((item) => item.name);

  // Get unique categories for legend
  const categories = [
    ...new Set(sortedItems.map((item) => item.category).filter(Boolean)),
  ];

  // Create one series per category for legend
  const series = categories.map((category) => {
    const data = sortedItems.map((item) => {
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
      stack: "total", // 修复1：加上堆叠属性，避免同一行不同分类并排导致的位置错乱偏移
      barWidth: "60%",
      itemStyle: {
        color: getCategoryColor(category, theme), // 修复2：设定系列的主颜色，使得图例方块正确继承分类颜色
        borderRadius: [0, 8, 8, 0],
      },
      data: data,
    };
  });

  const textColor = theme === "dark" ? "#FFFFFF" : "#1D1D1F";
  const textSecondaryColor = theme === "dark" ? "#98989D" : "#86868B";
  const genTime = new Date(data.generated_at);

  const option = {
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
      inactiveColor: textSecondaryColor,
      // 修复3：ECharts 的 legend.textStyle 不能使用 callback 函数，改为显式给每个项(data)指定颜色
      data: categories.map((category) => {
        return {
          name: category,
          textStyle: {
            color: getCategoryColor(category, theme),
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
      axisLine: {
        lineStyle: { color: textSecondaryColor },
      },
      axisLabel: {
        color: textSecondaryColor,
        formatter: "{value}%",
      },
      splitLine: {
        lineStyle: {
          color: textSecondaryColor + "30",
          type: "dashed",
        },
      },
    },
    yAxis: {
      type: "category",
      data: yAxisData,
      axisLine: {
        lineStyle: { color: textSecondaryColor },
      },
      axisLabel: {
        color: function (value, index) {
          const item = sortedItems[index];
          if (item && item.category) {
            return getCategoryColor(item.category, theme);
          }
          return textSecondaryColor;
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

// Initialize
(async function () {
  const data = await loadData();
  if (data) {
    renderChart(data);
  }
})();
