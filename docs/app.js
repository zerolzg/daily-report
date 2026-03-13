// Theme management
const body = document.body;
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.querySelector('.theme-icon');

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'light';
body.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);

    // Re-render chart with new theme
    if (window.myChart) {
        updateChartTheme(newTheme);
    }
});

function updateThemeIcon(theme) {
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// Chart configuration
let myChart;

const lightColors = {
    up: '#FF3B30',
    down: '#34C759',
    bg: '#FFFFFF',
    text: '#1D1D1F',
    textSecondary: '#86868B'
};

const darkColors = {
    up: '#FF453A',
    down: '#30D158',
    bg: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#98989D'
};

function getColors() {
    const theme = body.getAttribute('data-theme');
    return theme === 'dark' ? darkColors : lightColors;
}

function updateChartTheme(theme) {
    const colors = getColors();

    // Update item colors
    const data = myChart.getOption().series[0].data;
    const newData = data.map(item => ({
        ...item,
        itemStyle: {
            color: item.value >= 0 ? colors.up : colors.down
        }
    }));

    myChart.setOption({
        backgroundColor: colors.bg,
        textStyle: {
            color: colors.text
        },
        xAxis: {
            axisLine: { lineStyle: { color: colors.textSecondary } },
            axisLabel: { color: colors.textSecondary },
            splitLine: { lineStyle: { color: colors.textSecondary + '30' } }
        },
        yAxis: {
            axisLine: { lineStyle: { color: colors.textSecondary } },
            axisLabel: { color: colors.textSecondary }
        },
        series: [{
            data: newData
        }]
    });
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
    const chartDom = document.getElementById('chart');
    myChart = echarts.init(chartDom);

    const assetData = data.assets[0];
    const items = assetData.data;

    // Prepare data for ECharts
    const chartData = items.map(item => ({
        name: item.name,
        value: item.value,
        itemStyle: {
            color: item.value >= 0 ? colors.up : colors.down
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
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            formatter: function(params) {
                const data = params[0];
                const sign = data.value >= 0 ? '+' : '';
                return `<strong>${data.name}</strong><br/>涨跌幅: ${sign}${data.value.toFixed(2)}%`;
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '15%',
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
            data: chartData.map(item => item.name),
            axisLine: {
                lineStyle: { color: colors.textSecondary }
            },
            axisLabel: {
                color: colors.textSecondary,
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
        myChart.resize();
    });
}

// Initialize
(async function() {
    const data = await loadData();
    if (data) {
        renderChart(data);
    }
})();
