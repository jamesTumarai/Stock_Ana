import React, { useRef, useEffect } from 'react';

export function CrossfadeVideo({ 
  src, 
  className, 
  style 
}: { 
  src: string, 
  className?: string, 
  style?: React.CSSProperties 
}) {
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v1 = video1Ref.current;
    const v2 = video2Ref.current;
    if (!v1 || !v2) return;

    let activeVideo = v1;
    let nextVideo = v2;
    let isTransitioning = false;

    // Initialize
    v1.style.opacity = '1';
    v2.style.opacity = '0';
    v1.play().catch(() => {});

    const CROSSFADE_DURATION = 1.2; // Smooth 1.2s crossfade

    const handleTimeUpdate = (e: Event) => {
      const current = e.target as HTMLVideoElement;
      if (current !== activeVideo) return;
      if (!current.duration) return;

      const timeLeft = current.duration - current.currentTime;

      if (timeLeft <= CROSSFADE_DURATION && !isTransitioning) {
        isTransitioning = true;

        // Reset and play the next video
        nextVideo.currentTime = 0;
        nextVideo.play().catch(() => {});

        // Apply crossfade
        nextVideo.style.transition = `opacity ${CROSSFADE_DURATION}s ease-in-out`;
        current.style.transition = `opacity ${CROSSFADE_DURATION}s ease-in-out`;
        
        nextVideo.style.opacity = '1';
        current.style.opacity = '0';

        // After transition completes, pause the old video and swap roles
        setTimeout(() => {
          current.pause();
          
          // Swap active pointers
          const temp = activeVideo;
          activeVideo = nextVideo;
          nextVideo = temp;
          
          isTransitioning = false;
        }, CROSSFADE_DURATION * 1000);
      }
    };

    v1.addEventListener('timeupdate', handleTimeUpdate);
    v2.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      v1.removeEventListener('timeupdate', handleTimeUpdate);
      v2.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  return (
    <div className={`relative ${className || ''}`} style={style}>
      <video
        ref={video1Ref}
        src={src}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: style?.objectPosition || 'center' }}
        muted
        playsInline
        preload="auto"
      />
      <video
        ref={video2Ref}
        src={src}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: style?.objectPosition || 'center', opacity: 0 }}
        muted
        playsInline
        preload="auto"
      />
    </div>
  );
}
