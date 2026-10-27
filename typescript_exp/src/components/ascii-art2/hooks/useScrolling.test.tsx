import { useRef } from 'react';
import { act, render, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrolling, forwardTouchToScroll } from './useScrolling';
import PhotorealisticLayer from '../../photorealistic/PhotorealisticLayer';

let now = 0;
let nextFrame = 0;
let frames = new Map<number, FrameRequestCallback>();
let scrolling: ReturnType<typeof useScrolling>;
let node: HTMLDivElement;
let photo = false;

function Harness({ max = 10000 }: { max?: number }) {
  const container = useRef<HTMLDivElement>(null);
  // Intentionally unstable, as in callers: rerenders must not restart gestures.
  scrolling = useScrolling(max, container, () => {});
  return <><div ref={container} data-testid="scroll" />{photo && <PhotorealisticLayer
    items={[]} layout={{ rawBounds: {}, paddedBounds: {} }} scrollOffset={scrolling.scrollOffset}
    isVisible showHighRes={false} isInteractive
    onForwardTouch={event => forwardTouchToScroll(container.current, event)}
    onForwardWheel={event => container.current?.dispatchEvent(new WheelEvent('wheel', {
      deltaY: event.deltaY, deltaMode: event.deltaMode, cancelable: true
    }))}
  />}</>;
}

const touch = (type: string, y: number, time: number, count = 1) => {
  now = time;
  const point = { clientY: y, clientX: 100, identifier: 1 };
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    touches: { value: type === 'touchend' || type === 'touchcancel' ? [] : Array(count).fill(point) },
    changedTouches: { value: [point] }
  });
  act(() => node.dispatchEvent(event));
};

const advance = (duration: number, hz = 60) => {
  const end = now + duration;
  while (now < end) {
    now = Math.min(end, now + 1000 / hz);
    const pending = [...frames.values()];
    frames.clear();
    act(() => pending.forEach(callback => callback(now)));
  }
};

const mount = (max?: number) => {
  const view = render(<Harness max={max} />);
  node = photo ? view.container.querySelector('[data-photo-input-shield]')! : view.getByTestId('scroll');
  return view;
};

beforeEach(() => {
  now = 0;
  frames = new Map();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe.each(['ascii', 'photo'])('%s touch scrolling', mode => {
  beforeEach(() => { photo = mode === 'photo'; });
  it('follows the finger then coasts for a useful distance after release', () => {
    mount();
    touch('touchstart', 700, 0);
    touch('touchmove', 600, 50);
    touch('touchmove', 500, 100);
    expect(scrolling.scrollOffsetRef.current).toBe(200);
    touch('touchend', 500, 105);
    advance(500);
    expect(scrolling.scrollOffsetRef.current).toBeGreaterThan(550);
    expect(scrolling.scrollOffsetRef.current).toBeLessThan(1000);
    advance(3000);
    expect(scrolling.isScrolling.current).toBe(false);
    expect(frames.size).toBe(0);
  });

  it('uses recent release speed even after a long hold or drag', () => {
    mount();
    touch('touchstart', 700, 0);
    touch('touchmove', 690, 600);
    touch('touchmove', 590, 650);
    touch('touchmove', 490, 700);
    touch('touchend', 490, 705);
    advance(500);
    expect(scrolling.scrollOffsetRef.current).toBeGreaterThan(550);
  });

  it('does not launch a fling after holding still before release', () => {
    mount();
    touch('touchstart', 700, 0);
    touch('touchmove', 500, 50);
    touch('touchend', 500, 250);
    advance(500);
    expect(scrolling.scrollOffsetRef.current).toBe(200);
  });

  it('uses the final direction after reversing a drag', () => {
    mount();
    touch('touchstart', 700, 0);
    touch('touchmove', 200, 100);
    touch('touchmove', 300, 200);
    touch('touchmove', 400, 250);
    touch('touchend', 400, 255);
    advance(100);
    expect(scrolling.scrollOffsetRef.current).toBeLessThan(300);
  });

  it.each([30, 60, 120])('covers the same distance at %i Hz', hz => {
    mount();
    touch('touchstart', 700, 0);
    touch('touchmove', 600, 50);
    touch('touchmove', 500, 100);
    touch('touchend', 500, 100);
    advance(500, hz);
    // Integral of 2 px/ms decaying with a 325 ms time constant.
    expect(scrolling.scrollOffsetRef.current).toBeCloseTo(200 + 650 * (1 - Math.exp(-500 / 325)), 1);
  });

  it('cancels momentum on a new touch and on touchcancel', () => {
    mount();
    touch('touchstart', 700, 0);
    touch('touchmove', 500, 100);
    touch('touchend', 500, 100);
    advance(100);
    touch('touchstart', 500, now);
    const stopped = scrolling.scrollOffsetRef.current;
    advance(100);
    expect(scrolling.scrollOffsetRef.current).toBe(stopped);
    touch('touchmove', 400, now + 50);
    touch('touchcancel', 400, now + 5);
    advance(500);
    expect(scrolling.scrollOffsetRef.current).toBeCloseTo(stopped + 100);
    expect(scrolling.isScrolling.current).toBe(false);
  });

  it('does not fling a cancelled multi-touch gesture', () => {
    mount();
    touch('touchstart', 700, 0);
    touch('touchmove', 500, 50);
    touch('touchstart', 500, 60, 2);
    touch('touchend', 500, 80);
    advance(500);
    expect(scrolling.scrollOffsetRef.current).toBe(200);
  });

  it('respects new bounds during an active fling and cleans up frames', () => {
    const view = mount();
    touch('touchstart', 700, 0);
    touch('touchmove', 500, 100);
    touch('touchend', 500, 100);
    view.rerender(<Harness max={220} />);
    advance(300);
    expect(scrolling.scrollOffsetRef.current).toBe(220);
    view.unmount();
    expect(frames.size).toBe(0);
  });

  it('does not leave scrolling stuck after a tap', () => {
    mount();
    touch('touchstart', 700, 0);
    touch('touchend', 700, 50);
    advance(20);
    expect(scrolling.scrollOffsetRef.current).toBe(0);
    expect(scrolling.isScrolling.current).toBe(false);
  });

  it('stops an active fling when touching a media control outside the scroll surface', () => {
    mount();
    touch('touchstart', 700, 0);
    touch('touchmove', 500, 100);
    touch('touchend', 500, 100);
    advance(100);
    const stopped = scrolling.scrollOffsetRef.current;
    act(() => document.body.dispatchEvent(new Event('touchstart', { bubbles: true })));
    advance(200);
    expect(scrolling.scrollOffsetRef.current).toBe(stopped);
    expect(scrolling.isScrolling.current).toBe(false);
  });

  it('normalizes Firefox line-mode and page-mode wheel deltas', () => {
    mount();
    act(() => node.dispatchEvent(new WheelEvent('wheel', { deltaY: 3, deltaMode: 1, cancelable: true })));
    expect(scrolling.scrollOffsetRef.current).toBeCloseTo(3 * 16 * 0.7);
    const before = scrolling.scrollOffsetRef.current;
    act(() => node.dispatchEvent(new WheelEvent('wheel', { deltaY: 1, deltaMode: 2, cancelable: true })));
    expect(scrolling.scrollOffsetRef.current - before).toBeCloseTo(window.innerHeight * 0.7);
  });
});
