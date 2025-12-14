import { useState, useEffect, useMemo } from 'react';
import AsciiArtGenerator from '../components/ascii-art2/AsciiArtGenerator';
import CompatibilityOverlay from '../components/CompatibilityOverlay';
import { loadCsv, CsvRecord } from '../utils/csv';
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
  anchorPoint?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center'; // Anchor point
  fontName?: 'regular' | 'ascii' | 'smallAscii'; // Add fontName explicitly if needed
};

type Exhibition = {
  title: string;
  subtitle?: string;
  location?: string;
  dateRange?: string;
};

const UPCOMING_EXHIBITIONS_PATH = '/upcoming_exhibitions.csv';

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
  const heading = '==Upcoming/ongoing==';

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

type NavigatorWithUAData = Navigator & {
  userAgentData?: {
    brands?: Array<{ brand: string }>;
  };
};

const isDesktopChromium = () => {
  if (typeof navigator === 'undefined') {
    return true;
  }

  const ua = navigator.userAgent || '';
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const isDesktop = !/Mobi|Android|iPhone|iPad/i.test(ua) && !touchMac;
  const chromiumTokens = ['Chrome', 'Chromium', 'Edg', 'OPR', 'Brave', 'Vivaldi', 'Arc'];

  const uaData = (navigator as NavigatorWithUAData).userAgentData;
  const hasChromiumBrand = uaData?.brands?.some(entry => /Chrom(e|ium)|Edge|Opera|Brave/i.test(entry.brand)) ?? false;

  if (!isDesktop) {
    return false;
  }

  if (hasChromiumBrand) {
    return true;
  }

  return chromiumTokens.some(token => ua.includes(token));
};

const hasSeenCompatibilityMessage = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return sessionStorage.getItem('compatMessageSeen') === 'true';
  } catch (error) {
    console.warn('Unable to read compatibility message flag', error);
    return false;
  }
};

const markCompatibilityMessageSeen = () => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.setItem('compatMessageSeen', 'true');
  } catch (error) {
    console.warn('Unable to store compatibility message flag', error);
  }
};

const COMPATIBILITY_MESSAGE = [
  'Please visit on desktop',
  'with a chromium based browser',
  'for an optimal experience.'
].join('\n');

function HomePage() {
  // console.log("HomePage component rendering - should only show on homepage route");

  const [textContent, setTextContent] = useState<TextContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const [showCompatibilityOverlay, setShowCompatibilityOverlay] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    if (isDesktopChromium()) {
      return false;
    }
    return !hasSeenCompatibilityMessage();
  });
  const [exhibitions, setExhibitions] = useState<Exhibition[]>(FALLBACK_EXHIBITIONS);

  // Define the threshold for switching layouts based on aspect ratio (width/height)
  const ASPECT_RATIO_THRESHOLD = 1.0; // Switch to narrow layout if width < height
  
  // Calculate aspect ratio at component level
  const aspectRatio = windowHeight > 0 ? windowWidth / windowHeight : 1; 
  const isNarrow = aspectRatio < ASPECT_RATIO_THRESHOLD;

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
          { title: "[[Microwave]](#microwave)", x: 85, y: 30, name: "work-microwave" },
          { title: "[[Copy Machine]](#copy)", x: 78, y: 55, name: "work-copy" },
          { title: "[[This is not a fish]](#fish)", x: 8, y: 39, name: "work-fish" },
          { title: "[[REDACTED(WIP)]](WIP)", x: 25, y: 49, name: "work-radio" },
          { title: "[[Touching Distance]](#touching)", x: 33, y: 80, name: "work-touching" },
          { title: "[[Lasers]](#lasers)", x: 26, y: 77, name: "work-lasers" },
        ];

        let textItems: TextContentItem[] = [];

        if (isNarrow) {
          // --- Narrow Layout (Anchored - Portrait/Tall Viewport) ---
          // Title is the first element, positioned near the top center
          textItems = [
            { name: "title", text: "WARANA>", x: 0, y: 50, centered: true, fontName: 'ascii' },
             // Anchor "about" below the center of "title"
            { name: "about", text: "[[About]](#/about)", x: 0, y: 0, centered: true, anchorTo: "title", anchorPoint: 'center', anchorOffsetY: 50, alignment: "center", maxWidthPercent: 80 },
            // Anchor "upcoming" below the center of "about"
            { name: "upcoming", text: upcomingText, x: 0, y: 0, centered: true, anchorTo: "about", anchorPoint: 'center', anchorOffsetY: 5, alignment: "center", maxWidthPercent: 80 },
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
                anchorOffsetY: isFirstWork ? 8 : 15, // Larger gaps for Safari mobile rendering
                alignment: "center" as const,
                isTitle: false,
                useSmallFont: true
              };
            }),
            // Add a spacer at the end to ensure Safari recognizes there's scrollable space beyond the last item
            { 
              name: "spacer", 
              text: "\n\n\n\n\n\n\n\n\n\n.", // Multiline spacer to extend content height in portrait
              x: 0, 
              y: 0, 
              centered: true, 
              anchorTo: works[works.length - 1].name, 
              anchorPoint: 'center' as const, 
              anchorOffsetY: 60, 
              alignment: "center" as const 
            }
          ];

        } else {
          // --- Wide Layout (Absolute Positioning - Landscape/Wide Viewport) ---
           textItems = [
            { text: "WARANA>", x: 0, y: 15, centered: true, fontName: 'ascii'}, // Adjusted y position slightly for title
            { text: upcomingText, x: 0, y: 25, isTitle: false, centered: true, maxWidthPercent: 45, alignment: "center" as const },
            { text: "[[About]](#/about)", x: 60, y: 10, isTitle: false, maxWidthPercent: 40, alignment: "left" as const },
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
  }, [windowWidth, windowHeight, preRenderedArt, exhibitions]);

  const handleCompatibilityComplete = () => {
    markCompatibilityMessageSeen();
    setShowCompatibilityOverlay(false);
  };

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
        <AsciiArtGenerator textContent={textContent} />
      )}
      {showCompatibilityOverlay && (
        <CompatibilityOverlay
          message={COMPATIBILITY_MESSAGE}
          onComplete={handleCompatibilityComplete}
        />
      )}
    </div>
  );
}

export default HomePage; 
