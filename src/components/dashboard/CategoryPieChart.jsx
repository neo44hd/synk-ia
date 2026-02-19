import React, { useState, useEffect } from "react";

export default function CategoryPieChart({ data, colors }) {
  const [activeIndex, setActiveIndex] = useState(0);
  
  useEffect(() => {
    if (data.length === 0) return;
    
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % data.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [data.length]);

  if (data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-zinc-500">
        Sin datos
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const activeItem = data[activeIndex];
  const activePercentage = total > 0 ? ((activeItem?.value / total) * 100).toFixed(1) : 0;
  const activeColor = colors[activeIndex % colors.length];

  // Generate polygon points for SVG (12 sides = dodecagon)
  const polyPoints = (cx, cy, r, sides = 12) => {
    const points = [];
    for (let i = 0; i < sides; i++) {
      const angle = (2 * Math.PI / sides) * i - Math.PI / 2;
      points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    return points.join(' ');
  };

  return (
    <div className="relative h-[340px]">
      {/* Main polygonal display */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 340 300" className="w-full h-full max-w-[400px]">
          <defs>
            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            {/* Gradient for active segment */}
            <linearGradient id={`grad-active`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={activeColor} stopOpacity="0.8"/>
              <stop offset="100%" stopColor={activeColor} stopOpacity="0.3"/>
            </linearGradient>
          </defs>

          {/* Background polygon grid pattern (12 sides) */}
          <polygon 
            points={polyPoints(170, 150, 130)} 
            fill="none" 
            stroke="#27272a" 
            strokeWidth="1"
            opacity="0.5"
          />
          <polygon 
            points={polyPoints(170, 150, 100)} 
            fill="none" 
            stroke="#27272a" 
            strokeWidth="1"
            opacity="0.3"
          />
          <polygon 
            points={polyPoints(170, 150, 70)} 
            fill="none" 
            stroke="#27272a" 
            strokeWidth="1"
            opacity="0.2"
          />
          <polygon 
            points={polyPoints(170, 150, 40)} 
            fill="none" 
            stroke="#27272a" 
            strokeWidth="1"
            opacity="0.1"
          />

          {/* Category segments as triangular slices */}
          {data.map((item, index) => {
            const isActive = index === activeIndex;
            const segmentAngle = (2 * Math.PI) / data.length;
            const startAngle = segmentAngle * index - Math.PI / 2;
            const endAngle = startAngle + segmentAngle;
            const percentage = total > 0 ? (item.value / total) : 0;
            const radius = 50 + percentage * 85;
            
            const x1 = 170 + radius * Math.cos(startAngle);
            const y1 = 150 + radius * Math.sin(startAngle);
            const x2 = 170 + radius * Math.cos(endAngle);
            const y2 = 150 + radius * Math.sin(endAngle);
            
            return (
              <g key={item.name} onClick={() => setActiveIndex(index)} style={{ cursor: 'pointer' }}>
                <path
                  d={`M 170 150 L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`}
                  fill={colors[index % colors.length]}
                  opacity={isActive ? 0.9 : 0.25}
                  filter={isActive ? 'url(#glow)' : 'none'}
                  style={{
                    transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    transformOrigin: '170px 150px',
                    transform: isActive ? 'scale(1.08)' : 'scale(1)'
                  }}
                />
                {isActive && (
                  <path
                    d={`M 170 150 L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`}
                    fill="none"
                    stroke={colors[index % colors.length]}
                    strokeWidth="3"
                    opacity="1"
                    style={{
                      filter: `drop-shadow(0 0 15px ${colors[index % colors.length]})`
                    }}
                  />
                )}
              </g>
            );
          })}

          {/* Center polygon with data (12 sides) */}
          <polygon 
            points={polyPoints(170, 150, 55)} 
            fill="#18181b"
            stroke={activeColor}
            strokeWidth="2"
            style={{
              filter: `drop-shadow(0 0 20px ${activeColor}60)`,
              transition: 'all 0.5s ease'
            }}
          />
          
          {/* Animated ring */}
          <circle
            cx="170"
            cy="150"
            r="62"
            fill="none"
            stroke={activeColor}
            strokeWidth="1.5"
            strokeDasharray="10 5"
            opacity="0.6"
            style={{
              animation: 'spin 20s linear infinite',
              transformOrigin: '170px 150px'
            }}
          />
        </svg>
      </div>

      {/* Center content overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginTop: '-20px' }}>
        <div className="text-center transition-all duration-500">
          <p 
            className="text-4xl font-black tracking-tight transition-all duration-500"
            style={{ 
              color: activeColor,
              textShadow: `0 0 25px ${activeColor}80`
            }}
          >
            {activeItem?.value?.toLocaleString()}€
          </p>
          <p className="text-sm text-zinc-400 uppercase tracking-widest mt-2">
            {activePercentage}% del total
          </p>
        </div>
      </div>

      {/* Category name display - floating label */}
      <div 
        className="absolute bottom-2 left-0 right-0 text-center transition-all duration-500"
      >
        <div 
          className="inline-block px-8 py-3 rounded-2xl transition-all duration-500"
          style={{ 
            background: `linear-gradient(135deg, ${activeColor}30, ${activeColor}10)`,
            border: `2px solid ${activeColor}60`,
            boxShadow: `0 0 40px ${activeColor}30`
          }}
        >
          <p 
            className="text-lg font-black uppercase tracking-widest transition-all duration-500"
            style={{ color: activeColor }}
          >
            {activeItem?.name}
          </p>
        </div>
      </div>

      {/* Navigation dots */}
      <div className="absolute bottom-0 right-0 flex gap-1.5">
        {data.map((_, index) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className="w-2 h-2 rounded-full transition-all duration-300"
            style={{
              backgroundColor: index === activeIndex ? colors[index % colors.length] : '#3f3f46',
              boxShadow: index === activeIndex ? `0 0 8px ${colors[index % colors.length]}` : 'none',
              transform: index === activeIndex ? 'scale(1.3)' : 'scale(1)'
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}