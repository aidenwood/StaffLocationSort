import React from 'react';

const TrafficLight = ({ zone, className = "w-8 h-12" }) => {
  // Determine which light should be active based on zone
  const getActiveLight = (zone) => {
    switch (zone?.toUpperCase()) {
      case 'GO':
      case 'WORTH IT':
        return 'green'; // GO = Green light
      case 'ON THE FENCE':
        return 'yellow'; // CAUTION = Yellow light  
      case 'KEEP AWAY':
        return 'red'; // STOP/DANGER = Red light
      default:
        return 'gray'; // Unknown = All lights off/gray
    }
  };

  const activeLight = getActiveLight(zone);

  return (
    <svg 
      viewBox="0 0 24 36" 
      className={className}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Traffic Light Box */}
      <rect 
        x="2" 
        y="2" 
        width="20" 
        height="32" 
        rx="3" 
        ry="3" 
        fill="#2d3748" 
        stroke="#4a5568" 
        strokeWidth="1"
      />
      
      {/* Red Light */}
      <circle 
        cx="12" 
        cy="9" 
        r="4" 
        fill={activeLight === 'red' ? '#ef4444' : '#374151'}
        stroke={activeLight === 'red' ? '#dc2626' : '#6b7280'}
        strokeWidth="1"
      />
      
      {/* Yellow Light */}
      <circle 
        cx="12" 
        cy="18" 
        r="4" 
        fill={activeLight === 'yellow' ? '#f59e0b' : '#374151'}
        stroke={activeLight === 'yellow' ? '#d97706' : '#6b7280'}
        strokeWidth="1"
      />
      
      {/* Green Light */}
      <circle 
        cx="12" 
        cy="27" 
        r="4" 
        fill={activeLight === 'green' ? '#10b981' : '#374151'}
        stroke={activeLight === 'green' ? '#059669' : '#6b7280'}
        strokeWidth="1"
      />
      
      {/* Shine/glow effect on active light */}
      {activeLight === 'red' && (
        <circle 
          cx="12" 
          cy="9" 
          r="3" 
          fill="url(#redGlow)"
          opacity="0.6"
        />
      )}
      {activeLight === 'yellow' && (
        <circle 
          cx="12" 
          cy="18" 
          r="3" 
          fill="url(#yellowGlow)"
          opacity="0.6"
        />
      )}
      {activeLight === 'green' && (
        <circle 
          cx="12" 
          cy="27" 
          r="3" 
          fill="url(#greenGlow)"
          opacity="0.6"
        />
      )}
      
      {/* Gradients for glow effects */}
      <defs>
        <radialGradient id="redGlow" cx="30%" cy="30%">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="100%" stopColor="#ef4444" />
        </radialGradient>
        <radialGradient id="yellowGlow" cx="30%" cy="30%">
          <stop offset="0%" stopColor="#fed7aa" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id="greenGlow" cx="30%" cy="30%">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="100%" stopColor="#10b981" />
        </radialGradient>
      </defs>
    </svg>
  );
};

export default TrafficLight;