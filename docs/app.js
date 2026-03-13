// Theme management
const body = document.body;
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.querySelector('.theme-icon');

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'light';
body.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

// Category color mapping for Y-axis labels
const categoryColors = {
    '股指': { light: '#FF6B6B', dark: '#FF6B6B' },
    '加密货币': { light: '#4ECDC4', dark: '#4ECDC4' },
    '货币': { light: '#45B7D1', dark: '#45B7D1' },
    '能源': { light: '#FFA07A', dark: '#FFA07A' },
    '贵金属': { light: '#FFD700', dark: '#FFD700' },
    '金属': { light: '#9370DB', dark: '#9370DB' }
};

// Default color for unknown categories
const defaultColor = { light: '#888888', dark: '#888888' };

themeToggle.addEventListener('click', () => {
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);

    // Re-render chart with new theme
    if (window.myChart && window.chartData) {
        renderChart(window.chartData);
    }
});

function updateThemeIcon(theme) {
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function getCategoryColor(category, theme) {
    const color = categoryColors[category] || defaultColor;
    return color[theme];
}

// Chart configuration
let myChart;

const lightColors = {
    bg: '#FFFFFF',
    text: '#1D1D1F',
    textSecondary: '#86868B'
};

const darkColors = {
    bg: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#98989D'
};

function getColors() {
    const theme = body.getAttribute('data-theme');
    return theme === 'dark' ? darkColors : lightColors;
}

// Load data and render chart
async function loadData() {
    try {
        const response = await fetch('./data/latest.json?t=' + Date.now());
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to load data:', error);
        return null;
    }
}

function renderChart(data) {
    const colors = getColors();
    const theme = body.getAttribute('data-theme');
    const chartDom = document.getElementById('chart');

    // Store data for theme switching
    window.chartData = data;

    // Dispose existing chart if exists
    if (myChart) {
        myChart.dispose();
    }

    myChart = echarts.init(chartDom);

    const assetData = data.assets[0];
    const items = assetData.data;

    // Sort by value descending (highest at top)
    const sortedItems = [...items].sort((a, b) => b.value - a.value);

    // Prepare data for ECharts
    const chartData = sortedItems.map(item => {
        const category = item.category || '';
        const categoryColor = getCategoryColor(category, theme);
        const barColor = item.value >= 0 ? '#FF3B30' : '#34C759';
        return {
            name: item.name,
            value: item.value,
            category: category,
            itemStyle: {
                color: barColor
            }
        };
    });

    // Create Y-axis labels with category colors
    const yAxisData = chartData.map(item => item.name);

    // Get unique categories for legend
    const categories = [...new Set(sortedItems.map(item => item.category).filter(Boolean))];
    const legendData = categories.map(category => ({
        name: category,
        itemStyle: {
            color: getCategoryColor(category, theme)
        }
    }));

    const option = {
        backgroundColor: colors.bg,
        textStyle: {
            color: colors.text,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display"'
        },
        title: {
            text: assetData.title,
            left: 'center',
            textStyle: {
                fontSize: 20,
                fontWeight: 600
            }
        },
        legend: {
            show: true,
            top: 50,
            data: legendData,
            textStyle: {
                color: colors.textSecondary
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            formatter: function(params) {
                const data = params[0];
                const sign = data.value >= 0 ? '+' : '';
                const category = data.data.category ? `【${data.data.category}】` : '';
                return `<strong>${category}${data.name}</strong><br/>涨跌幅: ${sign}${data.value.toFixed(2)}%`;
            }
        },
        grid: {
            left: '10%',
            right: '15%',
            bottom: '3%',
            top: '100',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            axisLine: {
                lineStyle: { color: colors.textSecondary }
            },
            axisLabel: {
                color: colors.textSecondary,
                formatter: '{value}%'
            },
            splitLine: {
                lineStyle: {
                    color: colors.textSecondary + '30',
                    type: 'dashed'
                }
            }
        },
        yAxis: {
            type: 'category',
            data: yAxisData,
            axisLine: {
                lineStyle: { color: colors.textSecondary }
            },
            axisLabel: {
                color: function(value, index) {
                    const item = chartData[index];
                    if (item && item.category) {
                        return getCategoryColor(item.category, theme);
                    }
                    return colors.textSecondary;
                },
                fontSize: 13
            }
        },
        series: [{
            type: 'bar',
            data: chartData,
            barWidth: '60%',
            label: {
                show: true,
                position: 'right',
                formatter: function(params) {
                    const sign = params.value >= 0 ? '+' : '';
                    return sign + params.value.toFixed(2) + '%';
                },
                color: colors.text
            },
            itemStyle: {
                borderRadius: [0, 8, 8, 0]
            },
            animationDuration: 1000,
            animationEasing: 'cubicOut'
        }]
    };

    myChart.setOption(option);

    // Update update time
    const updateTime = document.getElementById('updateTime');
    const genTime = new Date(data.generated_at);
    updateTime.textContent = `更新时间: ${genTime.toLocaleString('zh-CN')}`;

    // Responsive
    window.addEventListener('resize', () => {
        if (myChart) {
            myChart.resize();
        }
    });
}

// Initialize
(async function() {
    const data = await loadData();
    if (data) {
        renderChart(data);
    }
})();
