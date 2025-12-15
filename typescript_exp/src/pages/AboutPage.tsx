import { useEffect, useState } from 'react';
import AsciiArtGenerator from '../components/ascii-art2/AsciiArtGenerator';
import { TextContentItem } from '../components/ascii-art2/types';
import { updateCharMetricsForViewport } from '../components/ascii-art2/constants';
import { loadCsv } from '../utils/csv';
import {
  FALLBACK_PRESENTATIONS,
  Presentation,
  SELECTED_PRESENTATIONS_PATH,
  formatPresentationsTable,
  mapPresentation
} from '../utils/presentations';
import {
  FALLBACK_AWARDS,
  Award,
  SELECTED_AWARDS_PATH,
  formatAwardsTable,
  mapAward
} from '../utils/awards';

const CV_PATH = new URL('../assets/CV_minimal_NOV25.pdf', import.meta.url).href;

function AboutPage() {
  const [presentations, setPresentations] = useState<Presentation[]>(FALLBACK_PRESENTATIONS);
  const [awards, setAwards] = useState<Award[]>(FALLBACK_AWARDS);
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

    // Load presentations
    loadCsv(SELECTED_PRESENTATIONS_PATH)
      .then(records => {
        if (!isMounted) {
          return;
        }
        const parsed = records
          .map(mapPresentation)
          .filter((item): item is Presentation => Boolean(item));

        if (parsed.length) {
          setPresentations(current => {
            const sameLength = current.length === parsed.length;
            const sameContent = sameLength && current.every((entry, index) => (
              entry.year === parsed[index].year &&
              entry.title === parsed[index].title &&
              entry.titleNarrow === parsed[index].titleNarrow &&
              entry.venue === parsed[index].venue &&
              entry.venueNarrow === parsed[index].venueNarrow &&
              entry.location === parsed[index].location &&
              entry.locationNarrow === parsed[index].locationNarrow
            ));

            return sameContent ? current : parsed;
          });
        }
      })
      .catch(error => {
        console.error('Failed to load presentations CSV', error);
      });

    // Load awards
    loadCsv(SELECTED_AWARDS_PATH)
      .then(records => {
        if (!isMounted) {
          return;
        }
        const parsed = records
          .map(mapAward)
          .filter((item): item is Award => Boolean(item));

        if (parsed.length) {
          setAwards(current => {
            const sameLength = current.length === parsed.length;
            const sameContent = sameLength && current.every((entry, index) => (
              entry.year === parsed[index].year &&
              entry.title === parsed[index].title &&
              entry.titleNarrow === parsed[index].titleNarrow &&
              entry.organization === parsed[index].organization &&
              entry.organizationNarrow === parsed[index].organizationNarrow
            ));

            return sameContent ? current : parsed;
          });
        }
      })
      .catch(error => {
        console.error('Failed to load awards CSV', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const { charWidth, charHeight } = updateCharMetricsForViewport(windowWidth);
    const isNarrow = windowWidth < 720;
    const aspectRatio = windowWidth / Math.max(1, windowHeight);
    const isWideAspect = aspectRatio >= 1.0; // Wide mode until square aspect ratio
    const rows = Math.max(1, Math.ceil(windowHeight / charHeight));
    const titleStartRow = Math.floor((12 / 100) * rows);
    const asciiTitleHeight = 5; // Height of "ABOUT" in ascii font rows
    const subtitleOffsetRows = -10; // Gap between title and micro subtitle
    const microSubtitleHeight = 3; // Height of micro subtitle in rows
    const bioAnchorOffsetRows = isWideAspect ? -12 : -12; // Pull bio into the subtitle so they touch on wide view
    const percentFromRow = (row: number) => Math.min(100, (row / rows) * 100);
    const subtitleRow = titleStartRow + asciiTitleHeight + subtitleOffsetRows;
    const approxBioRow = subtitleRow + microSubtitleHeight + bioAnchorOffsetRows;
    const subtitleYPercent = Math.min(90, percentFromRow(subtitleRow));
    const approxBioYPercent = Math.min(90, percentFromRow(approxBioRow));
    const janArt = [
      '  _/\\_',
      ' (o  o)',
      '  \\__/'
    ].join('\n');

    const columnCount = Math.max(20, Math.floor(windowWidth / charWidth));
    const bioMaxWidthPercent = isWideAspect ? 60 : 92;
    // Keep table widths aligned with the bio on wide viewports
    const tableMaxWidthPercent = isWideAspect ? bioMaxWidthPercent : 94;
    const maxTableWidth = Math.max(20, Math.floor(columnCount * (tableMaxWidthPercent / 100)));
    const awardsMaxWidth = Math.max(15, Math.floor(columnCount * (tableMaxWidthPercent / 100)));
    const presentationsAnchorOffsetX = -Math.floor(maxTableWidth / 2);
    const awardsAnchorOffsetX = -Math.floor(awardsMaxWidth / 2);

    const janText = [
      janArt,
      '==~JAN ZUIDERVELD~==',
      '[[jan@warana.xyz](mailto:jan@warana.xyz)]',
      `[[CV](${CV_PATH})]`,
      '[[Scholar](https://scholar.google.com/citations?user=USER_ID)]',
      '[[Instagram](https://www.instagram.com/warana.xyz)]',
    ].join('\n');

    const presentationsTableText = formatPresentationsTable(presentations, isNarrow, maxTableWidth);
    const awardsTableText = formatAwardsTable(awards, isNarrow, awardsMaxWidth);

    const presentationsDrip = [
'⋰⋱⋰⋱⋰⋱⋰⋱⋰⋱⋰⋱',
'╭═╦══╦══╦══╦══╦═╮',
'╱✺╲╱✺╲╱✺╲╱✺╲╱✺╲╱✺╲',
'╲✺╱╲✺╱╲✺╱╲✺╱╲✺╱╲✺╱',
'╰═╩══╩══╩══╩══╩═╯',
      '==SELECTED PRESENTATIONS=='
    ].join('\n');

    const awardsDrip = [
      '¸,ø¤º°`°º¤ø,¸¸,ø¤º°`°º¤ø,¸¸,ø¤º°`°º¤ø,¸¸,ø¤º°`',
      '      (  @   _   @  )    (  @   _   @  )      ',
      '       \    (o)    /      \    (o)    /       ',
      '________)         (________)         (________',
      '°º¤ø,¸¸,ø¤º°`°º¤ø,¸¸,ø¤º°`°º¤ø,¸¸,ø¤º°`°º¤ø,¸¸',
      '',
      '==SELECTED AWARDS=='
    ].join('\n');

    const presentationsBlobText = [presentationsDrip, presentationsTableText, '[[ALL PRESENTATIONS]](#/presentations)'].join('\n\n');
    const awardsBlobText = [awardsDrip, awardsTableText].join('\n');

    const subtitleXOffsetPercent = 0;
    const bioXOffsetPercent = 0;

    const janMaxWidthPercent = isNarrow ? 32 : 26;
    const janXPercent = 98 - janMaxWidthPercent; // Position so right edge is near screen edge

    const exhibitionsAnchorOffsetY = 4;
    const exhibitionsMaxWidthPercent = tableMaxWidthPercent;
    const exhibitionsXPercent = bioXOffsetPercent;

    const textItems: TextContentItem[] = [
      { name: 'back', text: '[[<<<]](#/)', x: 2, y: 4, fixed: true },
      { name: 'title', text: 'ABOUT', x: 0, y: 12, centered: true, fontName: 'ascii' },
      {
        name: 'subtitle',
        text: 'ARTIFICIAL PHYSICAL INTELLIGENCE',
        x: subtitleXOffsetPercent,
        y: subtitleYPercent,
        centered: true,
        fontName: 'microAscii',
        anchorTo: 'title',
        anchorPoint: 'bottomCenter',
        anchorOffsetY: subtitleOffsetRows,
        alignment: 'center'
      },
      {
        name: 'bio',
                text: 'Warana is an artistic research studio and evolving host-organism for embodied algorithms, initiated by artist-researcher Jan Zuiderveld. Grounded in cognitive science and AI, the studio explores the emergence of technological animism: the moment our tools transition from servants into beings.\n\nWe embed algorithms into physical objects, turning them into our temporary organs: living actors that observe, converse, and (mis)behave in interaction.\n\nWhen people interact with traditional computer interfaces, they often expect magic. Because the internal processes of computers are opaque, we rely on a "magic box" mental model where any behaviour can be explained; the wonder is neutralized before it starts. Removing this context creates space for a more naive, direct form of observing.\n\nWe achieve this by subverting the utility of everyday objects. Consider a photocopier that stops copying to collaborate creatively on your drawings, or a camera that narrates your movements like a wildlife documentary. By anchoring AI in familiar physical tools, we bypass the expectation of digital omnipotence. The interaction slips past logic and hits you in the gut: the machine appears undeniably alive.\n\nOur installations function as performative probes that rely on the audience to complete them. A visitor sweet-talking a vending machine to charm it into dispensing coffee is not merely interacting; they are performing a new type of social relationship. The art exists in that public spectacle: a human genuinely negotiating with an object, rehearsing a future where anything can gaze back.\n\nOur work has been awarded by Ars Electronica and has been presented across the Netherlands, the United States, China, Canada, Qatar, Portugal, Germany, the United Kingdom, Estonia, Romania, Switzerland, among other places. We share our research through talks and workshops in academic and art contexts.\n\nCurrently supported by Creative Industries Fund NL through their Talent Development program.',
        x: bioXOffsetPercent,
        y: approxBioYPercent,
        centered: true,
        anchorTo: 'subtitle',
        anchorPoint: 'bottomCenter',
        anchorOffsetY: bioAnchorOffsetRows,
        maxWidthPercent: bioMaxWidthPercent,
        alignment: 'center'
      },
      {
        name: 'jan',
        text: janText,
        x: janXPercent,
        y: 4,
        centered: false,
        fixed: isWideAspect,
        maxWidthPercent: janMaxWidthPercent,
        alignment: 'right'
      },
      {
        name: 'exhibitions-blob',
        text: presentationsBlobText,
        x: exhibitionsXPercent,
        y: 0,
        centered: false,
        fixed: false,
        anchorTo: 'bio',
        anchorPoint: 'bottomCenter',
        anchorOffsetY: exhibitionsAnchorOffsetY,
        anchorOffsetX: presentationsAnchorOffsetX,
        maxWidthPercent: exhibitionsMaxWidthPercent,
        alignment: 'center'
      },
      // Awards always below presentations
      {
        name: 'awards-blob',
        text: awardsBlobText,
        x: 0,
        y: 0,
        centered: false,
        fixed: false,
        anchorTo: 'exhibitions-blob',
        anchorPoint: 'bottomCenter',
        anchorOffsetY: 4,
        anchorOffsetX: awardsAnchorOffsetX,
        maxWidthPercent: tableMaxWidthPercent,
        alignment: 'center'
      }
    ];

    setTimeout(() => {
      setTextContent(textItems);
      setIsLoading(false);
    }, 50);
  }, [windowWidth, windowHeight, presentations, awards]);

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

export default AboutPage;
