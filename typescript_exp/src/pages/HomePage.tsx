import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AsciiArtGenerator from '../components/ascii-art2/AsciiArtGenerator';
import { BLOB_PADDING, getCurrentCharMetrics } from '../components/ascii-art2/constants';
import { loadCsv, CsvRecord } from '../utils/csv';
import { AsciiLayoutInfo } from '../components/ascii-art2/types';
// You might want to add your own ASCII art for the homepage
// import homeAsciiArt from '../assets/home/home_ascii.txt?raw';

// Define the type for text content items more explicitly
type TextContentItem = {
  text: string;
  x: number;
  y: number;
  isTitle?: boolean;
  centered?: boolean;
  preRenderedAscii?: string;
  useSmallFont?: boolean;
  fixed?: boolean;
  maxWidthPercent?: number;
  alignment?: 'left' | 'center' | 'right';
  name?: string; // Unique identifier for anchoring
  anchorTo?: string; // Name of the textbox to anchor to
  anchorOffsetX?: number; // Horizontal offset from the anchor
  anchorOffsetY?: number; // Vertical offset from the anchor
  anchorPoint?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center' | 'bottomCenter' | 'middleLeft' | 'middleRight'; // Anchor point
  fontName?: 'regular' | 'ascii' | 'smallAscii'; // Add fontName explicitly if needed
};

type Exhibition = {
  title: string;
  subtitle?: string;
  location?: string;
  dateRange?: string;
};

type HomePageProps = {
  compatibilityOverlayActive?: boolean;
};

const UPCOMING_EXHIBITIONS_PATH = '/upcoming_exhibitions.csv';


const HOME_SUBTITLE = '.';
// const HOME_SUBTITLE = '';

const HOME_TITLE_ASCII =  
"\\\\   \\\\  //   // \\  –––––––––\\\\ //––––\\\\||\\ \\  ||–\\–\\\n" +
" \\\\   \\\\//   // ^ \\ |||––––––||//      \\\\||\\ \\ ||  \\ \\\n" +
"  \\\\  /__\\  // /–\\ \\|||______//\\\\––––––//| \\ \\|||–\\ \\ \\\n" +
"   \\\\//  \\\\// /   \\ \\|| ||\\ \\\\ //–––––//||  \\ \\||  \\ \\ \\\n" +
"    \\/    \\/_/     \\_\\|_|| \\_\\\\/      \\\\||   \\_||   \\_\\_\\";
const ABOUT_LINK_LABEL = 'ABOUT';
const ABOUT_LINK_TEXT = `[${ABOUT_LINK_LABEL}](#/about)`;
const ABOUT_PADDING_X = 3;
const ABOUT_CORE_PREFIX = '–';
const ABOUT_CORE_SUFFIX = '–';
const ABOUT_CORE_VISIBLE = `${ABOUT_CORE_PREFIX}${' '.repeat(ABOUT_PADDING_X)}${ABOUT_LINK_LABEL}${' '.repeat(ABOUT_PADDING_X)}${ABOUT_CORE_SUFFIX}`;
const ABOUT_CORE_TEXT = `${ABOUT_CORE_PREFIX}${' '.repeat(ABOUT_PADDING_X)}${ABOUT_LINK_TEXT}${' '.repeat(ABOUT_PADDING_X)}${ABOUT_CORE_SUFFIX}`;
const ABOUT_CORE_WIDTH = ABOUT_CORE_VISIBLE.length;
const buildBurstLine = (placements: Array<[number, string]>) => {
  const chars = Array.from({ length: ABOUT_CORE_WIDTH }, () => ' ');
  placements.forEach(([index, char]) => {
    if (index >= 0 && index < chars.length) {
      chars[index] = char;
    }
  });
  return chars.join('');
};
const ABOUT_CENTER = Math.floor(ABOUT_CORE_WIDTH / 2);
const ABOUT_RAY_OFFSET = Math.max(3, Math.floor(ABOUT_CORE_WIDTH / 2) - 3);
const ABOUT_LEFT_RAY = Math.max(1, ABOUT_CENTER - ABOUT_RAY_OFFSET);
const ABOUT_RIGHT_RAY = Math.min(ABOUT_CORE_WIDTH - 2, ABOUT_CENTER + ABOUT_RAY_OFFSET);
const ABOUT_AIR_OFFSET = Math.max(2, Math.floor(ABOUT_CORE_WIDTH / 2) - 1);
const ABOUT_TOP_BURST = buildBurstLine([
  [ABOUT_LEFT_RAY, '⟍'],
  [ABOUT_CENTER, '|'],
  [ABOUT_RIGHT_RAY, '⟋']
]);
const ABOUT_AIRY_LINE = buildBurstLine([
  [ABOUT_CENTER - ABOUT_AIR_OFFSET, '.'],
  [ABOUT_CENTER + ABOUT_AIR_OFFSET, '.']
]);
const ABOUT_BOTTOM_BURST = buildBurstLine([
  [ABOUT_LEFT_RAY, '⟋'],
  [ABOUT_CENTER, '|'],
  [ABOUT_RIGHT_RAY, '⟍']
]);
const ABOUT_BOX_LINES = [
  { name: 'about-burst-top', text: ABOUT_TOP_BURST, offsetY: -2 },
  { name: 'about-air-top', text: ABOUT_AIRY_LINE, offsetY: -1 },
  { name: 'about', text: ABOUT_CORE_TEXT, offsetY: 0 },
  { name: 'about-air-bottom', text: ABOUT_AIRY_LINE, offsetY: 1 },
  { name: 'about-burst-bottom', text: ABOUT_BOTTOM_BURST, offsetY: 2 },
];
const TITLE_TO_SUBTITLE_OFFSET_Y = -BLOB_PADDING + 0;
// const TITLE_TO_SUBTITLE_OFFSET_Y = -BLOB_PADDING + 4;
const SUBTITLE_TO_UPCOMING_OFFSET_Y = -BLOB_PADDING + 4;
// const SUBTITLE_TO_UPCOMING_OFFSET_Y = -BLOB_PADDING + 6;
const ABOUT_TO_UPCOMING_OFFSET_Y = 3;

const FALLBACK_EXHIBITIONS: Exhibition[] = [
  {
    title: 'Coffee Machine',
    subtitle: 'Dutch, More or Less. Contemporary Architecture, Design and Digital Culture',
    location: 'Het Nieuwe Instituut (Rotterdam, NL)',
    dateRange: '01/06/2024 > 30/05/2026',
  },
  {
    title: 'Coffee Machine',
    location: 'Deutsches Museum Nürnberg (Nürnberg, DE)',
    dateRange: '29/04/2025 > 29/06/2025',
  },
  {
    title: 'Coffee Machine',
    subtitle: 'AI Ecologies',
    location: 'Artphy (Onstwedde, NL)',
    dateRange: '06/07/2025 > 30/08/2025',
  },
  {
    title: 'Keynote lecture',
    subtitle: 'AI in Art Practices and Research Conference',
    location: 'I.L. Caragiale - National University of Theatre and Film (Bucharest, RO)',
    dateRange: '24/10/2025',
  },
  {
    title: 'Workshop',
    subtitle: 'AI in Art Practices and Research Conference',
    location: 'I.L. Caragiale - National University of Theatre and Film (Bucharest, RO)',
    dateRange: '25/10/2025',
  },
  {
    title: 'Life on _',
    subtitle: 'Big Dada',
    location: 'Arti et Amicae (Amsterdam, NL)',
    dateRange: '30/10/2025 > 21/11/2025',
  },
  {
    title: 'Coffee Machine',
    location: 'KUMU Kunstimuuseum (Tallinn, EE)',
    dateRange: '12/02/2026 > 23/08/2026',
  },
];

const mapExhibition = (record: CsvRecord): Exhibition | null => {
  const title = record.title?.trim();
  const subtitle = record.subtitle?.trim();
  const location = record.location?.trim();
  const dateRange = record['date_range']?.trim() || record.dates?.trim();

  if (!title) {
    return null;
  }

  const exhibition: Exhibition = { title };

  if (subtitle) {
    exhibition.subtitle = subtitle;
  }
  if (location) {
    exhibition.location = location;
  }
  if (dateRange) {
    exhibition.dateRange = dateRange;
  }

  return exhibition;
};

const formatUpcomingText = (entries: Exhibition[]): string => {
  const heading = '==Upcoming ⟋ ongoing==';

  if (!entries.length) {
    return `${heading}\n\n-- none scheduled --`;
  }

  const blocks = entries.map(entry => {
    const lines: string[] = [];
    if (entry.subtitle) {
      lines.push(`==${entry.subtitle}==`);
    }
    if (entry.location) {
      lines.push(`//${entry.location}//`);
    }
    if (entry.dateRange) {
      lines.push(entry.dateRange);
    }
    return lines.join('\n');
  });

  return [heading, ...blocks].join('\n\n');
};

const HOME_INTRO_RIPPLE_KEY = 'homeIntroRippleSeen';

const hasSeenHomeIntroRipple = () => {
  if (typeof window === 'undefined') {
    return true;
  }
  try {
    return sessionStorage.getItem(HOME_INTRO_RIPPLE_KEY) === 'true';
  } catch (error) {
    console.warn('Unable to read intro ripple flag', error);
    return false;
  }
};

const markHomeIntroRippleSeen = () => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.setItem(HOME_INTRO_RIPPLE_KEY, 'true');
  } catch (error) {
    console.warn('Unable to store intro ripple flag', error);
  }
};

function HomePage({ compatibilityOverlayActive = false }: HomePageProps) {
  // console.log("HomePage component rendering - should only show on homepage route");

  const [textContent, setTextContent] = useState<TextContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialScrollOffset, setInitialScrollOffset] = useState<number | null>(null);
  const [narrowShiftRows, setNarrowShiftRows] = useState(0);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const asciiContainerRef = useRef<HTMLDivElement | null>(null);
  const introRippleTimeoutRef = useRef<number | null>(null);
  const introRippleAttemptsRef = useRef(0);
  const introRippleScheduledRef = useRef(false);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>(FALLBACK_EXHIBITIONS);

  // Define the threshold for switching layouts based on aspect ratio (width/height)
  const ASPECT_RATIO_THRESHOLD = 2; // Switch to narrow layout if width < height
  
  // Calculate aspect ratio at component level
  const aspectRatio = windowHeight > 0 ? windowWidth / windowHeight : 1; 
  const isNarrow = aspectRatio < ASPECT_RATIO_THRESHOLD;

  useEffect(() => {
    if (!isNarrow) {
      setInitialScrollOffset(null);
      setNarrowShiftRows(0);
    }
  }, [isNarrow]);

  const handleLayoutChange = useCallback((layout: AsciiLayoutInfo) => {
    if (!isNarrow) {
      return;
    }

    const upcomingBounds = layout.namedRawBounds.upcoming;
    const height = layout.size.height;
    const { charHeight } = getCurrentCharMetrics();

    if (!upcomingBounds || !height || !charHeight) {
      return;
    }

    const rows = Math.ceil(height / charHeight);
    const bottomPaddingRows = 2;
    const targetRow = rows - 1 - bottomPaddingRows;
    const baseUpcomingRow = upcomingBounds.minY - narrowShiftRows;
    const nextShiftRows = Math.max(0, targetRow - baseUpcomingRow);
    const nextScrollRows = Math.max(0, baseUpcomingRow - targetRow);
    const nextOffset = nextScrollRows * charHeight;

    setInitialScrollOffset(prev => (prev === nextOffset ? prev : nextOffset));
    setNarrowShiftRows(prev => (prev === nextShiftRows ? prev : nextShiftRows));
  }, [isNarrow, narrowShiftRows]);

  const triggerIntroRipple = useCallback(() => {
    if (introRippleScheduledRef.current || hasSeenHomeIntroRipple()) {
      return;
    }

    introRippleScheduledRef.current = true;
    introRippleAttemptsRef.current = 0;

    const attemptRipple = () => {
      const container = asciiContainerRef.current;
      const pre = container?.querySelector('pre');
      const rect = pre?.getBoundingClientRect();

      if (!rect || rect.width === 0 || rect.height === 0) {
        introRippleAttemptsRef.current += 1;
        if (introRippleAttemptsRef.current <= 4) {
          introRippleTimeoutRef.current = window.setTimeout(attemptRipple, 150);
          return;
        }
        introRippleScheduledRef.current = false;
        return;
      }

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      window.dispatchEvent(new MouseEvent('mousemove', {
        clientX: centerX,
        clientY: centerY,
        bubbles: true
      }));

      window.dispatchEvent(new MouseEvent('click', {
        clientX: centerX,
        clientY: centerY,
        bubbles: true
      }));

      markHomeIntroRippleSeen();
    };

    introRippleTimeoutRef.current = window.setTimeout(attemptRipple, 160);
  }, []);

  // Effect to update window dimensions state on resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight); // Update height as well
    };
    window.addEventListener('resize', handleResize);
    // Cleanup listener on component unmount
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isLoading || compatibilityOverlayActive || hasSeenHomeIntroRipple()) {
      return;
    }

    triggerIntroRipple();

    return () => {
      if (introRippleTimeoutRef.current !== null) {
        window.clearTimeout(introRippleTimeoutRef.current);
      }
    };
  }, [compatibilityOverlayActive, isLoading, triggerIntroRipple]);

  useEffect(() => {
    let isMounted = true;

    loadCsv(UPCOMING_EXHIBITIONS_PATH)
      .then(records => {
        if (!isMounted) {
          return;
        }

        const parsed = records
          .map(mapExhibition)
          .filter((item): item is Exhibition => Boolean(item));

        if (parsed.length) {
          setExhibitions(current => {
            const sameLength = current.length === parsed.length;
            const sameContent = sameLength && current.every((entry, index) => (
              entry.title === parsed[index].title &&
              entry.subtitle === parsed[index].subtitle &&
              entry.location === parsed[index].location &&
              entry.dateRange === parsed[index].dateRange
            ));

            return sameContent ? current : parsed;
          });
        }
      })
      .catch(error => {
        console.error('Failed to load upcoming exhibitions CSV', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);


  const preRenderedArt = useMemo(() => {
    return {
      // If you add ASCII art for the homepage, include it here
      // home: homeAsciiArt,
    };
  }, []);

  useEffect(() => {
    const generateTextContent = () => {
      setIsLoading(true);
      try {
        const upcomingText = formatUpcomingText(exhibitions);

        // Extract individual works from the works text
        const works = [
          { title: "[[Life on _]](#camera)", x: 19, y: 22, name: "work-camera" },
          { title: "[[Coffee Machine]](#coffee)", x: 72, y: 39, name: "work-coffee" },
          { title: "[[Copy Machine]](#copy)", x: 78, y: 55, name: "work-copy" },
          { title: "[[Microwave]](#microwave)", x: 85, y: 30, name: "work-microwave" },
          { title: "[[This is not a fish]](#fish)", x: 8, y: 39, name: "work-fish" },
          { title: "[[Conversations Beyond the Ordinary]](#conversations-beyond-the-ordinary)", x: 40, y: 72, name: "work-conversations" },
          { title: "[[Shedrick]](#shedrick)", x: 92, y: 22, name: "work-shedrick" },
          { title: "[[REDACTED(WIP)]](#/construction)", x: 25, y: 49, name: "work-radio" },
          { title: "[[Touching Distance]](#/construction)", x: 33, y: 80, name: "work-touching" },
          { title: "[[Lasers]](#/construction)", x: 26, y: 77, name: "work-lasers" },
        ];

        let textItems: TextContentItem[] = [];

	        if (isNarrow) {
            const titleOffsetY = 50 + narrowShiftRows;
	          // --- Narrow Layout (Anchored - Portrait/Tall Viewport) ---
	          // Title is the first element, positioned near the top center
	          textItems = [
	            { name: "title", text: "WARANA>", preRenderedAscii: HOME_TITLE_ASCII, x: 0, y: titleOffsetY, centered: true, fontName: 'ascii' },
	            {
	              name: 'subtitle',
	              text: HOME_SUBTITLE,
              x: 0,
              y: 0,
              centered: true,
              anchorTo: 'title',
              anchorPoint: 'bottomCenter',
              anchorOffsetY: TITLE_TO_SUBTITLE_OFFSET_Y,
              alignment: 'center',
              maxWidthPercent: 90
            },
            // Anchor the about box below the center of "title"
            ...ABOUT_BOX_LINES.map(line => {
              const isCenterLine = line.name === 'about';
              return {
                name: line.name,
                text: line.text,
                x: 0,
                y: 0,
                centered: true,
                anchorTo: isCenterLine ? 'title' : 'about',
                anchorPoint: 'center' as const,
                anchorOffsetY: isCenterLine ? 50 : line.offsetY,
                alignment: 'center' as const,
                maxWidthPercent: 80
              };
            }),
            // Anchor "upcoming" below the center of the about box
            { name: "upcoming", text: upcomingText, x: 0, y: 0, centered: true, anchorTo: "about-burst-bottom", anchorPoint: 'center' as const, anchorOffsetY: ABOUT_TO_UPCOMING_OFFSET_Y, alignment: "center" as const, maxWidthPercent: 80 },
             // Add individual works anchored one after another, below the center of the previous one
            ...works.map((work, index) => {
              const anchorTo = index === 0 ? "upcoming" : works[index - 1].name;
              const isFirstWork = index === 0;
              return {
                name: work.name,
                text: work.title,
                centered: true,
                x: Math.random() * 20 - 10, // Keep random x position between -10 and 10
                y: 0,
                anchorTo: anchorTo,
                anchorPoint: isFirstWork ? 'bottomRight' as const : 'center' as const, // Anchor to bottom of upcoming text
                anchorOffsetY: isFirstWork ? 0 : 15, // Larger gaps for Safari mobile rendering
                alignment: "center" as const,
                isTitle: false,
                useSmallFont: true
              };
            }),
            // // Add a spacer at the end to ensure Safari recognizes there's scrollable space beyond the last item
            // { 
            //   name: "spacer", 
            //   text: "\n\n\n\n\n\n\n\n\n\n.", // Multiline spacer to extend content height in portrait
            //   x: 0, 
            //   y: 0, 
            //   centered: true, 
            //   anchorTo: works[works.length - 1].name, 
            //   anchorPoint: 'center' as const, 
            //   anchorOffsetY: 60, 
            //   alignment: "center" as const 
            // }
          ];

	        } else {
	          // --- Wide Layout (Absolute Positioning - Landscape/Wide Viewport) ---
	           textItems = [
	            { name: 'title', text: "WARANA>", preRenderedAscii: HOME_TITLE_ASCII, x: 0, y: 15, centered: true, fontName: 'ascii'}, // Adjusted y position slightly for title
	            {
	              name: 'subtitle',
	              text: HOME_SUBTITLE,
              x: 0,
              y: 0,
              centered: true,
              anchorTo: 'title',
              anchorPoint: 'bottomCenter',
              anchorOffsetY: TITLE_TO_SUBTITLE_OFFSET_Y,
              alignment: 'center',
              maxWidthPercent: 90
            },
            {
              text: upcomingText,
              x: 0,
              y: 0,
              isTitle: false,
              centered: true,
              anchorTo: 'subtitle',
              anchorPoint: 'bottomCenter',
              anchorOffsetY: SUBTITLE_TO_UPCOMING_OFFSET_Y,
              maxWidthPercent: 45,
              alignment: "center" as const
            },
            ...ABOUT_BOX_LINES.map(line => ({
              name: line.name,
              text: line.text,
              x: 60,
              y: 10 + line.offsetY,
              isTitle: false,
              maxWidthPercent: 40,
              alignment: "left" as const
            })),
            // { text: "", x: 50, y: 40, isTitle: false, centered: true }, // Empty spacer, might not be needed
            // Add individual works as separate text items positioned around the page
            ...works.map(work => ({
              text: work.title,
              x: work.x,
              y: work.y,
              isTitle: false,
              useSmallFont: true
            }))
          ];
        }

        // Small delay to ensure proper content height calculation on Safari
        setTimeout(() => {
          setTextContent(textItems);
          setIsLoading(false);
        }, isNarrow ? 150 : 50); // Longer delay on mobile to help Safari calculate bounds

      } catch (error) {
        console.error("Error generating text content:", error);
        setIsLoading(false);
      }
    };

    generateTextContent();
  // Rerun this effect when window dimensions change or new exhibition data arrives
  }, [windowWidth, windowHeight, preRenderedArt, exhibitions, narrowShiftRows]);

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      backgroundColor: 'white',
      color: 'white', // Text color is handled by AsciiArtGenerator internally? Check component styles.
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
          {/* Loading screen remains white */}
        </div>
      ) : (
        // Pass the dynamically generated textContent
        <AsciiArtGenerator
          textContent={textContent}
          initialScrollOffset={initialScrollOffset ?? undefined}
          onLayoutChange={handleLayoutChange}
          externalContainerRef={asciiContainerRef}
        />
      )}
    </div>
  );
}

export default HomePage; 
