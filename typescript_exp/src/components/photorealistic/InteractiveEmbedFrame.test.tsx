// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InteractiveEmbedFrame from './InteractiveEmbedFrame';

describe('InteractiveEmbedFrame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves an explicitly muted Vimeo autoplay embed and primes muted playback when visible', () => {
    render(
      <InteractiveEmbedFrame
        src="https://player.vimeo.com/video/1153081771?muted=1&controls=1"
        label="Fish video"
        style={{ width: 320, height: 180 }}
        isVisible={true}
        onForwardWheel={() => {}}
      />
    );

    const iframe = screen.getAllByTitle('Fish video').at(-1) as HTMLIFrameElement | undefined;
    expect(iframe).toBeDefined();
    const src = iframe?.getAttribute('src');
    expect(src).not.toBeNull();

    const params = new URL(src ?? '', 'https://player.vimeo.com').searchParams;
    expect(params.get('autoplay')).toBe('1');
    expect(params.get('muted')).toBe('1');
    expect(params.get('playsinline')).toBe('1');

    const postMessageSpy = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: {
        postMessage: postMessageSpy
      }
    });

    fireEvent.load(iframe);
    vi.runAllTimers();

    expect(postMessageSpy).toHaveBeenCalledWith({ method: 'setMuted', value: true }, 'https://player.vimeo.com');
    expect(postMessageSpy).toHaveBeenCalledWith({ method: 'setVolume', value: 0 }, 'https://player.vimeo.com');
    expect(postMessageSpy).toHaveBeenCalledWith({ method: 'play' }, 'https://player.vimeo.com');
  });

  it('defaults Vimeo embeds without an explicit mute choice to autoplay with sound', () => {
    render(
      <InteractiveEmbedFrame
        src="https://player.vimeo.com/video/1153081771?controls=1"
        label="Fish video"
        style={{ width: 320, height: 180 }}
        isVisible={true}
        onForwardWheel={() => {}}
      />
    );

    const iframe = screen.getAllByTitle('Fish video').at(-1) as HTMLIFrameElement | undefined;
    expect(iframe).toBeDefined();
    const src = iframe?.getAttribute('src');
    expect(src).not.toBeNull();

    const params = new URL(src ?? '', 'https://player.vimeo.com').searchParams;
    expect(params.get('autoplay')).toBe('1');
    expect(params.get('muted')).toBe('0');
    expect(params.get('playsinline')).toBe('1');
  });
});
