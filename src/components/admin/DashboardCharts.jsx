function niceMax(value) {
  if (!value || value <= 0) return 1;
  const padded = value * 1.15;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  return Math.ceil(padded / magnitude) * magnitude;
}

function formatAxisNumber(value) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return String(Math.round(value));
}

export function OrdersBarChart({ data }) {
  const width = 560;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 36, left: 40 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxOrders = niceMax(Math.max(...data.map((d) => d.orders), 0));
  const barGap = 10;
  const barWidth = Math.max(12, (innerWidth - barGap * (data.length - 1)) / data.length);

  return (
    <svg className="dashboard-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Orders over last 7 days">
      {[0, 0.5, 1].map((tick) => {
        const y = padding.top + innerHeight - innerHeight * tick;
        const value = maxOrders * tick;
        return (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={padding.left + innerWidth}
              y1={y}
              y2={y}
              className="dashboard-chart-grid"
            />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="dashboard-chart-axis">
              {formatAxisNumber(value)}
            </text>
          </g>
        );
      })}

      {data.map((day, index) => {
        const x = padding.left + index * (barWidth + barGap);
        const barHeight = (day.orders / maxOrders) * innerHeight;
        const y = padding.top + innerHeight - barHeight;
        return (
          <g key={day.key}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, day.orders > 0 ? 2 : 0)}
              rx="4"
              className="dashboard-chart-bar"
            />
            <text
              x={x + barWidth / 2}
              y={padding.top + innerHeight + 18}
              textAnchor="middle"
              className="dashboard-chart-axis"
            >
              {day.label}
            </text>
            {day.orders > 0 ? (
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="dashboard-chart-value">
                {day.orders}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function RevenueLineChart({ data }) {
  const width = 560;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 36, left: 48 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxRevenue = niceMax(Math.max(...data.map((d) => d.revenue), 0));
  const step = data.length > 1 ? innerWidth / (data.length - 1) : 0;

  const points = data.map((day, index) => {
    const x = padding.left + index * step;
    const y = padding.top + innerHeight - (day.revenue / maxRevenue) * innerHeight;
    return { ...day, x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`;

  return (
    <svg className="dashboard-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue over last 7 days">
      {[0, 0.5, 1].map((tick) => {
        const y = padding.top + innerHeight - innerHeight * tick;
        const value = maxRevenue * tick;
        return (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={padding.left + innerWidth}
              y1={y}
              y2={y}
              className="dashboard-chart-grid"
            />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="dashboard-chart-axis">
              {formatAxisNumber(value)}
            </text>
          </g>
        );
      })}

      <path d={areaPath} className="dashboard-chart-area" />
      <path d={linePath} className="dashboard-chart-line" fill="none" />

      {points.map((point) => (
        <g key={point.key}>
          <circle cx={point.x} cy={point.y} r="4" className="dashboard-chart-dot" />
          <text
            x={point.x}
            y={padding.top + innerHeight + 18}
            textAnchor="middle"
            className="dashboard-chart-axis"
          >
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
