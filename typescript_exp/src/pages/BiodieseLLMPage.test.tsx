import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BiodieseLLMPage from './BiodieseLLMPage';

const projectPageSpy = vi.fn();
vi.mock('../components/ProjectPage', () => ({
  default: (props: unknown) => { projectPageSpy(props); return null; }
}));

describe('BiodieseLLMPage', () => {
  it('uses the edited image only for the ASCII hover and matches its larger raster-derived art', () => {
    render(<MemoryRouter initialEntries={['/biodiesellm']}><BiodieseLLMPage /></MemoryRouter>);
    const props = projectPageSpy.mock.calls.at(-1)?.[0];
    expect(props.photo.src).toContain('biodiesellm_hover_white.png');
    expect(props.photo.alt).toContain('AI-edited');
    expect(props.asciiArt).not.toContain('SALVAGED GENERATOR');
    expect(Math.max(...props.asciiArt.split('\n').map((line: string) => line.length))).toBe(84);
    expect(props.photoImages).toHaveLength(2);
  });
  it('uses the approved website copy followed by collaboration and funding credits', () => {
    render(<MemoryRouter initialEntries={['/biodiesellm?photo=1']}><BiodieseLLMPage /></MemoryRouter>);
    const props = projectPageSpy.mock.calls.at(-1)?.[0];
    expect(props.title).toBe('B10d13$3L-LLM');
    expect(props.titleFontName).toBe('ascii');
    expect(props.text.trim()).toBe("B10d13$3L-LLM is a performative installation in which LLMs run on scrapped hardware powered by self-produced biodiesel. A diesel engine and dynamo generate its electricity, a small-scale refinery supplies the fuel, and a printer records the models’ output. Their conversation unfolds in a never-ending loop: a human selects earlier outputs to inspire new questions, which the models discuss. The resulting outputs become material for the next round.\n\nWith dark humor, the work exposes AI’s hidden costs, from the fuel, machinery and human labour that sustain it to the erosion of our ability to think for ourselves as we increasingly rely on it.\n\nInitiated by Gökay Atabek, created in collaboration with Jan Zuiderveld and Ritsert Mans.\n\nSupported by the Creative Industries Fund NL through Grounding the Cloud.\n\nPhotos: [[Tom Mesic]](https://photos.ars.electronica.art/picture.php?/15662), Ars Electronica 2026 / [[CC BY-NC-ND 4.0]](https://creativecommons.org/licenses/by-nc-nd/4.0/)");
    expect(props.photo.src).toContain('biodiesellm_ars2026_overview.jpg');
    expect(props.photoObjectFit).toBe('contain');
    expect(props.photoCenterOnEnter).toBe(true);
    expect(props.titleCalloutText).toBeUndefined();
    expect(props.photoImages.map((image: { position: string }) => image.position)).toEqual(['above', 'below']);
    expect(props.photoInitialScrollTargetId).toBe('hero-video-image-0');
    expect(props.photoImages).toHaveLength(2);
    expect(props.photoImages.every((image: { objectFit: string }) => image.objectFit === 'contain')).toBe(true);
    expect(props.inlinePhotoLinkLabel).toBeUndefined();
  });
});
