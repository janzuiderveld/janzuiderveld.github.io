import path from 'node:path';

export const DEFAULT_PROJECT_PDF_COLLECTION = [
  { title: 'Coffee Machine', route: 'coffee', fileStem: 'coffee-machine' },
  { title: 'Copy Machine', route: 'copy', fileStem: 'copy-machine' },
  { title: 'Microwave', route: 'microwave', fileStem: 'microwave' },
  { title: 'Life on _', route: 'camera', fileStem: 'life-on' },
  { title: 'This is not a fish', route: 'fish', fileStem: 'this-is-not-a-fish' },
  { title: 'Vending Machine Organoid', route: 'vending', fileStem: 'vending-machine-organoid' },
  { title: 'Personal Audio Guide', route: '#guide', fileStem: 'personal-audio-guide' }
];

export const buildProjectPdfCollectionOutputPath = (outputPath = '') =>
  outputPath || path.join('output', 'pdf', 'selected-project-pages.pdf');
