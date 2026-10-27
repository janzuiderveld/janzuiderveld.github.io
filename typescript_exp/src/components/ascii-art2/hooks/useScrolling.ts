import { useState, useRef, useEffect, useCallback } from 'react';
import { CursorState } from '../types';

const DECAY_MS = 325;
const STOP_SPEED = 0.02; // pixels/ms
const SAMPLE_WINDOW_MS = 80;
const WHEEL_SCROLL_MULTIPLIER = 0.7;
const FORWARDED_TOUCH = 'ascii-scroll-touch';

// Photo mode forwards the entire gesture, preserving its release velocity.
export const forwardTouchToScroll = (container: HTMLElement | null, event: TouchEvent) => {
  container?.dispatchEvent(new CustomEvent(FORWARDED_TOUCH, { detail: event }));
};

export const useScrolling = (
  maxScroll: number,
  containerRef: React.RefObject<HTMLDivElement>,
  updateLinkOverlays: () => void,
  cursorRef?: React.MutableRefObject<CursorState>
) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const scrollOffsetRef = useRef(0);
  const isScrolling = useRef(false);
  // The renderer uses pixels per nominal 16 ms frame for its quality thresholds.
  const scrollVelocity = useRef(0);
  const latest = useRef({ maxScroll, updateLinkOverlays, cursorRef });
  latest.current = { maxScroll, updateLinkOverlays, cursorRef };

  const commitScrollOffset = useCallback((offset: number) => {
    const next = Math.max(0, Math.min(latest.current.maxScroll, offset));
    scrollOffsetRef.current = next;
    setScrollOffset(previous => Math.abs(previous - next) > 0.1 ? next : previous);
    return next;
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    let active = true;
    let frame: number | null = null;
    let wheelTimer: ReturnType<typeof setTimeout> | null = null;
    let lastFrame = 0;
    let velocity = 0;
    let touchId: number | null = null;
    let lastY = 0;
    let samples: Array<{ y: number; time: number }> = [];

    const setScrolling = (value: boolean) => {
      isScrolling.current = value;
      const cursor = latest.current.cursorRef?.current;
      if (cursor) cursor.isScrolling = value;
    };
    const stop = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (wheelTimer !== null) clearTimeout(wheelTimer);
      frame = null;
      wheelTimer = null;
      velocity = 0;
      scrollVelocity.current = 0;
    };
    const finish = () => {
      stop();
      setScrolling(false);
      latest.current.updateLinkOverlays();
    };
    const cancelTouch = () => {
      touchId = null;
      samples = [];
      finish();
    };

    const step = (timestamp: number) => {
      if (!active) return;
      frame = null;
      const elapsed = Math.max(0, timestamp - lastFrame);
      lastFrame = timestamp;
      // Do not jump when returning from a suspended/backgrounded page.
      if (elapsed > 1000) { finish(); return; }
      const decay = Math.exp(-elapsed / DECAY_MS);
      // Integrate speed over time: identical travel at 30, 60 and 120 Hz.
      const distance = velocity * DECAY_MS * (1 - decay);
      velocity *= decay;
      scrollVelocity.current = velocity * 16;
      const offset = commitScrollOffset(scrollOffsetRef.current + distance);
      if (Math.abs(velocity) < STOP_SPEED || offset === 0 || offset === latest.current.maxScroll) {
        finish();
        return;
      }
      frame = requestAnimationFrame(step);
    };

    const recordSample = (y: number, time: number) => {
      if (samples.length && time - samples[samples.length - 1].time > 150) samples = [];
      samples.push({ y, time });
      while (samples.length > 2 && samples[1].time < time - SAMPLE_WINDOW_MS) samples.shift();
    };
    const handleTouch = (event: TouchEvent) => {
      if (event.type === 'touchcancel' || event.touches.length > 1) {
        cancelTouch();
        return;
      }
      const time = performance.now();
      if (event.type === 'touchstart') {
        if (event.touches.length !== 1) return;
        stop();
        const touch = event.touches[0];
        touchId = touch.identifier;
        lastY = touch.clientY;
        samples = [{ y: lastY, time }];
        setScrolling(true);
        return;
      }
      if (touchId === null) return;
      if (event.type === 'touchmove') {
        const touch = Array.from(event.touches).find(point => point.identifier === touchId);
        if (!touch) { cancelTouch(); return; }
        if (event.cancelable) event.preventDefault();
        commitScrollOffset(scrollOffsetRef.current + lastY - touch.clientY);
        lastY = touch.clientY;
        recordSample(lastY, time);
        return;
      }
      if (event.type !== 'touchend') return;
      const released = Array.from(event.changedTouches).find(point => point.identifier === touchId);
      if (!released) return;
      touchId = null;
      if (released.clientY !== lastY) {
        commitScrollOffset(scrollOffsetRef.current + lastY - released.clientY);
        recordSample(released.clientY, time);
      }
      const first = samples[0];
      const last = samples[samples.length - 1];
      velocity = first && last && last.time > first.time && time - last.time <= SAMPLE_WINDOW_MS
        ? Math.max(-4, Math.min(4, (first.y - last.y) / (last.time - first.time)))
        : 0;
      samples = [];
      if (Math.abs(velocity) < STOP_SPEED) { finish(); return; }
      scrollVelocity.current = velocity * 16;
      lastFrame = time;
      frame = requestAnimationFrame(step);
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return; // Browser pinch-to-zoom.
      if (event.cancelable) event.preventDefault();
      stop();
      touchId = null;
      const unit = event.deltaMode === 1 ? 16
        : event.deltaMode === 2 ? (element.clientHeight || window.innerHeight) : 1;
      commitScrollOffset(scrollOffsetRef.current + event.deltaY * unit * WHEEL_SCROLL_MULTIPLIER);
      setScrolling(true);
      // Trackpads already deliver OS momentum as wheel events. A second fling
      // on each event makes their tails overshoot and stutter.
      wheelTimer = setTimeout(finish, 80);
    };
    const handleForwardedTouch = (event: Event) => handleTouch((event as CustomEvent<TouchEvent>).detail);
    const handleVisibility = () => { if (document.hidden) cancelTouch(); };
    const handleOutsideTouch = (event: TouchEvent) => {
      // Native media controls sit above the photo input shield. Touching them
      // should arrest the page's existing fling without stealing their input.
      if (!element.contains(event.target as Node)) cancelTouch();
    };
    element.addEventListener('wheel', handleWheel, { passive: false });
    element.addEventListener('touchstart', handleTouch, { passive: true });
    element.addEventListener('touchmove', handleTouch, { passive: false });
    element.addEventListener('touchend', handleTouch, { passive: true });
    element.addEventListener('touchcancel', handleTouch, { passive: true });
    element.addEventListener(FORWARDED_TOUCH, handleForwardedTouch);
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('touchstart', handleOutsideTouch, { capture: true, passive: true });
    window.addEventListener('blur', cancelTouch);
    return () => {
      active = false;
      stop();
      setScrolling(false);
      element.removeEventListener('wheel', handleWheel);
      element.removeEventListener('touchstart', handleTouch);
      element.removeEventListener('touchmove', handleTouch);
      element.removeEventListener('touchend', handleTouch);
      element.removeEventListener('touchcancel', handleTouch);
      element.removeEventListener(FORWARDED_TOUCH, handleForwardedTouch);
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('touchstart', handleOutsideTouch, { capture: true });
      window.removeEventListener('blur', cancelTouch);
    };
  }, [commitScrollOffset, containerRef]);

  useEffect(() => { commitScrollOffset(scrollOffsetRef.current); }, [maxScroll, commitScrollOffset]);
  return { scrollOffset, setScrollOffset, scrollOffsetRef, isScrolling, scrollVelocity };
};
