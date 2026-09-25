import React, { useRef, useEffect } from 'react';

const CROSSFADE_DURATION = 1.2; // Smooth 1.2s crossfade

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
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const nextVideoRef = useRef<HTMLVideoElement | null>(null);
  const isTransitioningRef = useRef(false);

  useEffect(() => {
    const v1 = video1Ref.current;
    const v2 = video2Ref.current;
    if (!v1 || !v2) return;

    activeVideoRef.current = v1;
    nextVideoRef.current = v2;
    isTransitioningRef.current = false;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Initialize initial visual state
    v1.style.opacity = '1';
    v2.style.opacity = '0';

    if (prefersReducedMotion) {
      // For reduced motion, do not autoplay video loops
      v1.pause();
      v2.pause();
      return;
    }

    let hasAutoplayed = false;

    // Robust play helper with user-gesture recovery if autoplay is blocked
    const tryPlay = (video: HTMLVideoElement) => {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            hasAutoplayed = true;
          })
          .catch(() => {
            // Autoplay blocked: wait for first user gesture anywhere on the window
            if (!hasAutoplayed) {
              const resumeOnGesture = () => {
                const target = activeVideoRef.current || v1;
                target.play().then(() => {
                  hasAutoplayed = true;
                }).catch(() => {});
                window.removeEventListener('pointerdown', resumeOnGesture);
                window.removeEventListener('keydown', resumeOnGesture);
                window.removeEventListener('touchstart', resumeOnGesture);
              };
              window.addEventListener('pointerdown', resumeOnGesture, { passive: true });
              window.addEventListener('keydown', resumeOnGesture, { passive: true });
              window.addEventListener('touchstart', resumeOnGesture, { passive: true });
            }
          });
      }
    };

    // Kick off playback on v1
    tryPlay(v1);

    // Crossfade handler
    const handleTimeUpdate = (e: Event) => {
      const current = e.target as HTMLVideoElement;
      if (current !== activeVideoRef.current) return;
      if (!current.duration || isTransitioningRef.current) return;

      const timeLeft = current.duration - current.currentTime;

      if (timeLeft <= CROSSFADE_DURATION && timeLeft > 0) {
        isTransitioningRef.current = true;
        const next = nextVideoRef.current;
        if (!next) {
          isTransitioningRef.current = false;
          return;
        }

        next.currentTime = 0;
        const playPromise = next.play();

        const triggerFade = () => {
          next.style.transition = `opacity ${CROSSFADE_DURATION}s ease-in-out`;
          current.style.transition = `opacity ${CROSSFADE_DURATION}s ease-in-out`;
          next.style.opacity = '1';
          current.style.opacity = '0';

          setTimeout(() => {
            if (!next.paused) {
              current.pause();
              const temp = activeVideoRef.current;
              activeVideoRef.current = nextVideoRef.current;
              nextVideoRef.current = temp;
            } else {
              // If next failed or paused unexpectedly, recover current
              current.style.opacity = '1';
              next.style.opacity = '0';
              if (current.paused) {
                current.play().catch(() => {});
              }
            }
            isTransitioningRef.current = false;
          }, CROSSFADE_DURATION * 1000);
        };

        if (playPromise !== undefined) {
          playPromise
            .then(triggerFade)
            .catch(() => {
              // Buffer stall or decode error: do not hide current video!
              isTransitioningRef.current = false;
              if (current.paused) {
                current.play().catch(() => {});
              }
            });
        } else {
          triggerFade();
        }
      }
    };

    // Safety fallback: if video reaches ended, rewind and play immediately
    const handleEnded = (e: Event) => {
      const v = e.target as HTMLVideoElement;
      v.currentTime = 0;
      v.play().catch(() => {});
    };

    // Tab visibility and focus recovery
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const active = activeVideoRef.current || v1;
        if (active.paused) {
          active.play().catch(() => {});
        }
      }
    };

    // Periodic watchdog timer (every 2s): ensures video hasn't stalled into blackness
    const watchdogTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const active = activeVideoRef.current || v1;
        if (active.paused) {
          active.play().catch(() => {});
        }
        // Safety: ensure at least one video is visible
        if (v1.style.opacity === '0' && v2.style.opacity === '0') {
          active.style.opacity = '1';
        }
      }
    }, 2000);

    v1.addEventListener('timeupdate', handleTimeUpdate);
    v2.addEventListener('timeupdate', handleTimeUpdate);
    v1.addEventListener('ended', handleEnded);
    v2.addEventListener('ended', handleEnded);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(watchdogTimer);
      v1.removeEventListener('timeupdate', handleTimeUpdate);
      v2.removeEventListener('timeupdate', handleTimeUpdate);
      v1.removeEventListener('ended', handleEnded);
      v2.removeEventListener('ended', handleEnded);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  return (
    <div
      className={`relative ${className || ''}`}
      style={{
        ...style,
        background: 'radial-gradient(ellipse 130% 90% at 50% 68%, #0d284a 0%, #061528 32%, #020914 62%, #000308 100%)',
      }}
    >
      <video
        ref={video1Ref}
        src={src}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: style?.objectPosition || 'center 62%' }}
        muted
        playsInline
        autoPlay
        loop
        preload="auto"
        crossOrigin="anonymous"
      />
      <video
        ref={video2Ref}
        src={src}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: style?.objectPosition || 'center 62%', opacity: 0 }}
        muted
        playsInline
        autoPlay
        loop
        preload="auto"
        crossOrigin="anonymous"
      />
    </div>
  );
}
