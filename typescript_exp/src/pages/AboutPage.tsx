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

const getViewportSize = () => {
  if (typeof window === 'undefined') {
    return { width: 1200, height: 900 };
  }

  const width = window.visualViewport?.width ?? window.innerWidth;
  const height = window.visualViewport?.height ?? window.innerHeight;

  return { width, height };
};

function AboutPage() {
  const [presentations, setPresentations] = useState<Presentation[]>(FALLBACK_PRESENTATIONS);
  const [awards, setAwards] = useState<Award[]>(FALLBACK_AWARDS);
  const [textContent, setTextContent] = useState<TextContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [{ width: windowWidth, height: windowHeight }, setWindowSize] = useState(getViewportSize);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize(getViewportSize());
    };
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
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

    const janText = [
      janArt,
      '==~JAN ZUIDERVELD~==',
      '[[jan@warana.xyz](mailto:jan@warana.xyz)]',
      '[[Instagram](https://www.instagram.com/warana.xyz)]',
      '[[Scholar](https://scholar.google.com/citations?user=USER_ID)]',
      `[[CV](${CV_PATH})]`,
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
      '       \\    (o)    /      \\    (o)    /       ',
      '________)         (________)         (________',
      '°º¤ø,¸¸,ø¤º°`°º¤ø,¸¸,ø¤º°`°º¤ø,¸¸,ø¤º°`°º¤ø,¸¸',
      '',
      '==SELECTED AWARDS=='
    ].join('\n');

    const presentationsBlobText = [presentationsDrip, presentationsTableText, '[[ALL PRESENTATIONS]](#/presentations)'].join('\n\n');
    const awardsBlobText = [awardsDrip, awardsTableText].join('\n');

    const subtitleXOffsetPercent = 0;
    const bioXOffsetPercent = 0;

    const bioIntroText = 'warana.xyz is an artistic studio and evolving host organism for embodied algorithms, initiated by artist-researcher Jan Zuiderveld. Grounded in cognitive science and AI, the studio explores the emergence of technological animism: the moment our tools transition from servants into beings. We embed algorithms into physical objects, turning them into living actors that observe, converse, and (mis)behave in interaction.\n\nOur work has been awarded by Ars Electronica and presented across the Netherlands, the United States, China, Canada, Qatar, Portugal, Germany, the United Kingdom, Estonia, Romania, and Switzerland. We share our research through talks and workshops in both academic and art contexts, with current support from Creative Industries Fund NL through their Talent Development program.';
    const bioApproachText = 'APPROACH';
    const bioMiddleText = [
      'Our inquiry into technological animism centers on one question: //what happens when our tools start to gaze back?// To find out, we must first understand what makes something feel alive. Each work stages a controlled encounter, testing conditions where perceptions of aliveness can emerge. ',
      '',
      'Aliveness is not explainable. It\'s felt. We don\’t perceive aliveness by inspecting what something is made of. We infer it from how it behaves: actions that seem directed, responses that carry personality, behaviour that feels authentic. The moment something seems to want, the category shifts.',
      
      '',
      'Traditional computer interfaces break that inference. A screen announces "this is a computer," and that label frames all behaviour as mechanical output. Aliveness is ruled out before interaction begins. This frame holds because the internal processes of digital systems are hard to grasp; we expect anything, so nothing surprises.',
      '',
      'Our experiments subvert expected utility, turning familiar tools feral. A photocopier that stops copying to collaborate on your drawings, a camera that narrates your movements like a wildlife documentary. By embodying intelligence in physical technology, we bypass the "just a computer" frame. Sometimes, this results in interactions that slip past logic and feel like genuine encounters.',
      '',
      'These installations are performative probes, completed by the audience. A visitor leans toward a vending machine, whispering, trying to convince it. The machine pauses, deliberates, refuses. They\'re publicly rehearsing a new social relationship. The work lives in this spectacle: a human genuinely negotiating with an object, an object responding as if it has a position. The tool stops being a servant. It becomes something that holds your gaze.'

    ].join('\n');
    const janMaxWidthPercent = isNarrow ? 32 : 26;
    const janXPercent = 98 - janMaxWidthPercent; // Position so right edge is near screen edge

    const exhibitionsAnchorOffsetY = 4;
    const exhibitionsMaxWidthPercent = tableMaxWidthPercent;
    const exhibitionsXPercent = bioXOffsetPercent;

    const textItems: TextContentItem[] = [
      { name: 'back', text: '[[<<<]](#/)', x: 2, y: 4, fixed: true },
      { name: 'title', text: 'ABOUT', x: 0, y: 18, centered: true, fontName: 'ascii' },
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
        name: 'bio-intro',
        text: bioIntroText,
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
        name: 'bio-approach',
        text: bioApproachText,
        x: -30,
        y: 0,
        centered: true,
        fontName: 'microAscii',
        anchorTo: 'bio-intro',
        anchorPoint: 'bottomCenter',
        anchorOffsetY: 0,
        maxWidthPercent: bioMaxWidthPercent,
        alignment: 'left'
      },
      {
        name: 'bio-middle',
        text: bioMiddleText,
        x: bioXOffsetPercent,
        y: 0,
        centered: true,
        anchorTo: 'bio-approach',
        anchorPoint: 'bottomCenter',
        anchorOffsetY: -10,
        maxWidthPercent: bioMaxWidthPercent,
        alignment: 'left'
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
        anchorTo: 'bio-middle',
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
        centered: true,
        fixed: false,
        anchorTo: 'exhibitions-blob',
        anchorPoint: 'bottomCenter',
        anchorOffsetY: 4,
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
