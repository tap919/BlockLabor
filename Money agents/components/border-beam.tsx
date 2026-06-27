'use client';

import { useId, forwardRef, type HTMLAttributes, type ReactNode } from 'react';

interface BorderBeamProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  colorVariant?: 'colorful' | 'ocean' | 'sunset';
  active?: boolean;
}

export const BorderBeam = forwardRef<HTMLDivElement, BorderBeamProps>(function BorderBeam({
  children,
  size = 'md',
  colorVariant = 'colorful',
  active = true,
  className = '',
  style,
  ...props
}, ref) {
  const id = useId();
  
  const sizeClasses = {
    sm: 'p-1',
    md: 'p-1', 
    lg: 'p-2'
  };
  
  const colorClasses = {
    colorful: 'border-beam-colorful',
    ocean: 'border-beam-ocean',
    sunset: 'border-beam-sunset'
  };
  
  return (
    <>
      <style>{`
        .border-beam-colorful {
          --beam-hue-1: 0deg;
          --beam-hue-2: 120deg;
          --beam-hue-3: 240deg;
        }
        .border-beam-ocean {
          --beam-hue-1: 180deg;
          --beam-hue-2: 220deg;
          --beam-hue-3: 260deg;
        }
        .border-beam-sunset {
          --beam-hue-1: 20deg;
          --beam-hue-2: 40deg;
          --beam-hue-3: 60deg;
        }
        
        @keyframes borderBeamRotate {
          0% { --beam-rotation: 0deg; }
          100% { --beam-rotation: 360deg; }
        }
        
        @property --beam-hue-1 {
          syntax: '<angle>';
          inherits: true;
          initial-value: 0deg;
        }
        @property --beam-hue-2 {
          syntax: '<angle>';
          inherits: true;
          initial-value: 120deg;
        }
        @property --beam-hue-3 {
          syntax: '<angle>';
          inherits: true;
          initial-value: 240deg;
        }
        @property --beam-rotation {
          syntax: '<angle>';
          inherits: false;
          initial-value: 0deg;
        }
        
        .animate-border-beam {
          position: relative;
        }
        
        .animate-border-beam::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          background: linear-gradient(
            var(--beam-rotation),
            hsl(var(--beam-hue-1), 80%, 60%),
            hsl(var(--beam-hue-2), 80%, 60%),
            hsl(var(--beam-hue-3), 80%, 60%
          );
          animation: borderBeamRotate 2s linear infinite;
          z-index: -1;
          opacity: 0.7;
        }
        
        .animate-border-beam::after {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          background: linear-gradient(
            calc(var(--beam-rotation) + 180deg),
            hsl(var(--beam-hue-1), 80%, 60%),
            hsl(var(--beam-hue-2), 80%, 60%),
            hsl(var(--beam-hue-3), 80%, 60%)
          );
          filter: blur(8px);
          z-index: -2;
          opacity: 0.5;
        }
      `}</style>
      <div
        ref={ref}
        className={`relative ${sizeClasses[size]} ${active ? 'animate-border-beam' : ''} ${colorClasses[colorVariant]} ${className}`}
        style={style}
        {...props}
      >
        {children}
      </div>
    </>
  );
});

export default BorderBeam;