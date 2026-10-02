import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BiodieseLLMPage from './BiodieseLLMPage';

const projectPageSpy = vi.fn();

vi.mock('../components/ProjectPage', () => ({
  default: (props: unknown) => {
    projectPageSpy(props);
    return <div data-testid="project-page" />;
  }
}));

describe('BiodieseLLMPage', () => {
  it('builds the hidden draft page around the current artwork concept', () => {
    render(<BiodieseLLMPage />);

    expect(screen.getByTestId('project-page')).toBeInTheDocument();
    expect(projectPageSpy).toHaveBeenCalledTimes(1);

    const lastCall = projectPageSpy.mock.calls.at(-1)?.[0] as {
      title?: string;
      displayTitle?: string;
      titleFontName?: string;
      text?: string;
      asciiArt?: string;
      photo?: {
        src?: string;
        alt?: string;
      };
      align?: {
        offsetX?: number;
        offsetY?: number;
        scaleX?: number;
        scaleY?: number;
        stretchX?: number;
        stretchY?: number;
      };
      inlinePhotoLinkLabel?: string;
    };

    expect(lastCall.title).toBe('B10d13$3LLM');
    expect(lastCall.displayTitle).toBe('B10d13$3LLM');
    expect(lastCall.titleFontName).toBe('ascii');
    expect(lastCall.text).toContain('Little Language Model');
    expect(lastCall.text).toContain('used frying oil');
    expect(lastCall.text).toContain('last snack bar in Europe');
    expect(lastCall.text).toContain('every answer costs fuel, smoke, heat, maintenance and time');
    expect(lastCall.text).toContain('Initiated by Volksamt! Kultur Manufaktur');
    expect(lastCall.text).toContain('Creative Industries Fund NL');
    expect(lastCall.asciiArt?.trim().length).toBeGreaterThan(200);
    expect(lastCall.photo?.src).toContain('biodiesellm_prototype.jpg');
    expect(lastCall.photo?.alt).toContain('receipt printer prototype');
    expect(lastCall.align).toEqual({
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1,
      stretchX: 1,
      stretchY: 1
    });
    expect(lastCall.inlinePhotoLinkLabel).toBe('Prototype Photo');
  });
});
