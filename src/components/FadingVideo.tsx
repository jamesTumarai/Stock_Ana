import React, { useRef, useEffect } from 'react';

export function FadingVideo({ src, className, style }: { src: string, className?: string, style?: React.CSSProperties }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadingOutRef = useRef(false);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const fadeTo = (targetOpacity: number, duration: number) => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);

      const startOpacity = parseFloat(video.style.opacity || '0');
      const startTime = performance.now();

      const animate = (time: number) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentOpacity = startOpacity + (targetOpacity - startOpacity) * progress;
        video.style.opacity = currentOpacity.toString();

        if (progress < 1) {
          rafId.current = requestAnimationFrame(animate);
        } else {
          rafId.current = null;
        }
      };

      rafId.current = requestAnimationFrame(animate);
    };

    const handleLoadedData = () => {
      video.style.opacity = '0';
      video.play().catch(() => {});
      fadeTo(1, 500);
    };

    const handleTimeUpdate = () => {
      if (!video.duration) return;
      const timeLeft = video.duration - video.currentTime;
      if (!fadingOutRef.current && timeLeft <= 0.55 && timeLeft > 0) {
        fadingOutRef.current = true;
        fadeTo(0, 500);
      }
    };

    const handleEnded = () => {
      video.style.opacity = '0';
      setTimeout(() => {
        video.currentTime = 0;
        video.play().catch(() => {});
        fadingOutRef.current = false;
        fadeTo(1, 500);
      }, 100);
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  return (
    <video 
      ref={videoRef}
      src={src}
      className={className}
      style={{ ...style, opacity: 0 }}
      autoPlay 
      muted 
      playsInline 
      preload="auto" 
    />
  );
}
