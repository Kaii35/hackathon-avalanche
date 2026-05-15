import { cn } from './lib/cn';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
  fill?: string;
}

export function Sparkline({
  data,
  width = 100,
  height = 28,
  className,
  stroke,
  fill,
}: SparklineProps) {
  if (data.length < 2) {
    return <div className={cn('w-24 h-7', className)} aria-hidden />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const isUp = (data[data.length - 1] ?? 0) >= (data[0] ?? 0);
  const strokeColor = stroke ?? (isUp ? '#34D399' : '#F87171');
  const fillColor = fill ?? (isUp ? 'rgba(52, 211, 153, 0.18)' : 'rgba(248, 113, 113, 0.18)');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn('overflow-visible', className)}
      role="img"
      aria-label="Tendencia"
    >
      <polygon points={areaPoints} fill={fillColor} />
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
