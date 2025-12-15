import { useEffect, useState } from 'react';
import AsciiArtGenerator from '../components/ascii-art2/AsciiArtGenerator';
import { TextContentItem } from '../components/ascii-art2/types';
import { updateCharMetricsForViewport } from '../components/ascii-art2/constants';
import { loadCsv } from '../utils/csv';
import {
  ALL_PRESENTATIONS_PATH,
  FALLBACK_PRESENTATIONS,
  Presentation,
  formatPresentationsTable,
  mapPresentation
} from '../utils/presentations';

function AllPresentationsPage() {
  const [presentations, setPresentations] = useState<Presentation[]>(FALLBACK_PRESENTATIONS);
  const [textContent, setTextContent] = useState<TextContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  const [windowHeight, setWindowHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 900
  );

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadCsv(ALL_PRESENTATIONS_PATH)
      .then(records => {
        if (!isMounted) {
          return;
        }
        const parsed = records
          .map(mapPresentation)
          .filter((item): item is Presentation => Boolean(item));

        if (parsed.length) {
          setPresentations(parsed);
        }
      })
      .catch(error => {
        console.error('Failed to load all presentations CSV', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const { charWidth } = updateCharMetricsForViewport(windowWidth);
    const isNarrow = windowWidth < 720;
    const tableOffsetRows = 5;
    const columnCount = Math.max(20, Math.floor(windowWidth / charWidth));
    const maxTableWidth = Math.max(20, Math.floor(columnCount * 0.92));

    const tableText = formatPresentationsTable(presentations, isNarrow, maxTableWidth);

    const tapeHeader = [
      '╭────────────────────────────────────────╮',
      '│~   FULL EVENT LOG   ~│',
      '╰────────────────────────────────────────╯'
    ].join('\n');

    const tableBlock = [tapeHeader, '', tableText].join('\n');

    const textItems: TextContentItem[] = [
      { name: 'back', text: '[[<<<]](#/about)', x: 2, y: 4, fixed: true },
      { name: 'home', text: '[[HOME]](#/)', x: 12, y: 4, fixed: true },
      // { name: 'title', text: 'ALL PRESENTATIONS', x: 0, y: percentFromRow(titleStartRow), centered: true, fontName: 'ascii' },
      {
        name: 'table',
        text: tableBlock,
        x: 0,
        y: 30,
        centered: true,
        anchorTo: 'subtitle',
        anchorPoint: 'bottomCenter',
        anchorOffsetY: tableOffsetRows,
        maxWidthPercent: 96,
        alignment: 'center'
      }
    ];

    setTimeout(() => {
      setTextContent(textItems);
      setIsLoading(false);
    }, 50);
  }, [presentations, windowWidth, windowHeight]);

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      backgroundColor: 'white',
      color: 'white',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      {isLoading ? (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'white',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
        </div>
      ) : (
        <AsciiArtGenerator textContent={textContent} />
      )}
    </div>
  );
}

export default AllPresentationsPage;
