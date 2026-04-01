// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_PDF_COLLECTION,
  buildProjectPdfCollectionOutputPath
} from './project-pdf-collection-utils.mjs';

describe('project pdf collection utils', () => {
  it('keeps the requested project order and routes', () => {
    expect(DEFAULT_PROJECT_PDF_COLLECTION).toEqual([
      { title: 'Coffee Machine', route: 'coffee', fileStem: 'coffee-machine' },
      { title: 'Copy Machine', route: 'copy', fileStem: 'copy-machine' },
      { title: 'Microwave', route: 'microwave', fileStem: 'microwave' },
      { title: 'Life on _', route: 'camera', fileStem: 'life-on' },
      { title: 'This is not a fish', route: 'fish', fileStem: 'this-is-not-a-fish' },
      { title: 'Vending Machine Organoid', route: 'vending', fileStem: 'vending-machine-organoid' },
      { title: 'Personal Audio Guide', route: '#guide', fileStem: 'personal-audio-guide' }
    ]);
  });

  it('writes the combined export to output/pdf by default', () => {
    expect(buildProjectPdfCollectionOutputPath()).toBe('output/pdf/selected-project-pages.pdf');
    expect(buildProjectPdfCollectionOutputPath('output/pdf/custom.pdf')).toBe('output/pdf/custom.pdf');
  });

  it('keeps the guide route on the bare hash entry expected by the app', () => {
    expect(DEFAULT_PROJECT_PDF_COLLECTION.at(-1)).toEqual({
      title: 'Personal Audio Guide',
      route: '#guide',
      fileStem: 'personal-audio-guide'
    });
  });
});
