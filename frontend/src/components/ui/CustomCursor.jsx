import React, { useState, useEffect } from 'react';

export default function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [trail, setTrail] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isHidden, setIsHidden] = useState(true);

  useEffect(() => {
    // Disable custom cursor on touch devices for a native mobile experience
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return;

    const handleMouseMove = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
      setIsHidden(false);

      // Check if hovering over clickable or interactive elements
      const target = e.target;
      if (target) {
        const isClickable = target.closest('a, button, [role="button"], .cursor-pointer, input, select, textarea');
        setIsHovering(!!isClickable);
      }
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);
    const handleMouseLeave = () => setIsHidden(true);
    const handleMouseEnter = () => setIsHidden(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, []);

  // Smooth trail effect using linear interpolation (lerp) via requestAnimationFrame
  useEffect(() => {
    let animFrameId;
    
    const updateTrail = () => {
      setTrail((prev) => {
        const dx = position.x - prev.x;
        const dy = position.y - prev.y;
        const ease = 0.15; // Smoothness speed factor (0.15 feels extremely premium)
        return {
          x: prev.x + dx * ease,
          y: prev.y + dy * ease,
        };
      });
      animFrameId = requestAnimationFrame(updateTrail);
    };
    
    animFrameId = requestAnimationFrame(updateTrail);
    return () => cancelAnimationFrame(animFrameId);
  }, [position]);

  if (isHidden) return null;

  return (
    <>
      {/* Hide native cursor globally on desktops */}
      <style>{`
        @media (hover: hover) and (pointer: fine) {
          body, a, button, [role="button"], .cursor-pointer, select, input, textarea {
            cursor: none !important;
          }
        }
      `}</style>

      {/* Center Core Dot */}
      <div
        className="fixed top-0 left-0 w-2.5 h-2.5 bg-primary rounded-full pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 mix-blend-screen"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${isClicking ? 0.8 : isHovering ? 1.4 : 1})`,
        }}
      />

      {/* Smooth Trailing Outer Glow Ring */}
      <div
        className="fixed top-0 left-0 w-8 h-8 rounded-full border border-primary/40 pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ease-out mix-blend-screen"
        style={{
          transform: `translate3d(${trail.x}px, ${trail.y}px, 0) scale(${isClicking ? 0.85 : isHovering ? 1.8 : 1})`,
          backgroundColor: isHovering ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0)',
          boxShadow: isHovering 
            ? '0 0 20px rgba(99, 102, 241, 0.4), inset 0 0 10px rgba(99, 102, 241, 0.2)' 
            : '0 0 0px rgba(99, 102, 241, 0)',
          borderColor: isHovering ? 'rgba(99, 102, 241, 0.9)' : 'rgba(99, 102, 241, 0.4)',
        }}
      />
    </>
  );
}
