import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  DEFAULT_PROJECT_PDF_COLLECTION,
  buildProjectPdfCollectionOutputPath
} from './project-pdf-collection-utils.mjs';

const execFileAsync = promisify(execFile);
const renderScriptPath = path.resolve('scripts', 'render-project-pdf.mjs');
const tempRoot = path.resolve('tmp', 'pdfs', 'collections');

const usage = () => {
  console.error('Usage: node scripts/render-project-pdf-collection.mjs [--out <output.pdf>]');
  process.exit(1);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  let outputPath = '';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--out') {
      outputPath = args[index + 1] ?? '';
      index += 1;
      continue;
    }
    usage();
  }

  return {
    outputPath: path.resolve(buildProjectPdfCollectionOutputPath(outputPath))
  };
};

const { outputPath } = parseArgs();

await fs.mkdir(tempRoot, { recursive: true });
await fs.mkdir(path.dirname(outputPath), { recursive: true });

const renderedPages = [];
for (const project of DEFAULT_PROJECT_PDF_COLLECTION) {
  const pageOutputPath = path.join(tempRoot, `${project.fileStem}.pdf`);
  await execFileAsync(process.execPath, [
    renderScriptPath,
    project.route,
    '--out',
    pageOutputPath
  ], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 20
  });
  renderedPages.push({
    title: project.title,
    route: project.route,
    pdf: pageOutputPath
  });
}

await execFileAsync('pdfunite', [
  ...renderedPages.map(page => page.pdf),
  outputPath
], {
  cwd: process.cwd(),
  maxBuffer: 1024 * 1024 * 20
});

console.log(JSON.stringify({
  pdf: outputPath,
  pages: renderedPages
}, null, 2));
