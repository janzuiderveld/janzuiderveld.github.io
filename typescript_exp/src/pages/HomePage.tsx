import { useState, useEffect, useMemo } from 'react';
import AsciiArtGenerator from '../components/ascii-art2/AsciiArtGenerator';
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


function HomePage() {
  // console.log("HomePage component rendering - should only show on homepage route");

  const [textContent, setTextContent] = useState<TextContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  // Define the threshold for switching layouts based on aspect ratio (width/height)
  const ASPECT_RATIO_THRESHOLD = 1.0; // Switch to narrow layout if width < height

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
        const upcomingText = `==Upcoming/ongoing==

==Coffee Machine==
//Dutch,// //More// //or Less. Contemporary// //Architecture,// //Design //and// //Digital// Culture//
//Het Nieuwe Instituut (Rotterdam, NL)//
01/06/2024 > 30/05/2026

==Coffee Machine==
//Deutsches Museum Nürnberg (Nürnberg, DE)//
29/04/2025 > 29/06/2025

==Coffee Machine==
//AI Ecologies//
//Artphy (Onstwedde, NL)//
06/07/2025 > 30/08/2025

==Keynote lecture==
//AI in Art Practices and Research Conference//
//"I.L. Caragiale" - National University of Theatre and Film (Bucharest, RO)//
24/10/2025

==Workshop==
//AI in Art Practices and Research Conference//
//"I.L. Caragiale" - National University of Theatre and Film (Bucharest, RO)//
25/10/2025 

==Life on _==
//Big Dada//
//Arti et Amicae (Amsterdam, NL)//
30/10/2025 > 21/11/2025

==Coffee Machine==
//KUMU Kunstimuuseum (Tallinn, EE)//
12/02/2026 > 23/08/2026`;

// ==Copy Machine==
//Artificial vs. Intelligence//
//The Media// //Majlis// //at// //Northwestern// //University// //in// //Qatar// //(Doha,// //QA)//
// 15/01/2025 > 15/05/2025

// Copy Machine 
// Disco Damsco

// Shanghai



        // const aboutMeText = \`About me // Removed start
// ... existing code ...
        // I am a researcher, artist and engineer with an academic background counting degrees in Physics, Electrical Engineering, Neuropsychology, Artificial Intelligence and ArtScience. My professional history includes leading a machine learning team specializing in speech-to-intent systems and hands-on experience as both a researcher and an engineer in the field of generative AI.
// ... existing code ...
        // In my artistic endeavors I explore the intersection of technology and life, creating interactive installations that invite reflection on the essence of being. My projects often endow things with a spark of life, challenging perceptions of existence. My approach is characterized by playful engagement with artificial intelligence, seeking to emulate the behaviors of living beings in a way that resonates with and surprises both myself and my audience, blurring the lines between the animate and the inanimate.\`; // Removed end

        // Extract individual works from the works text
        const works = [
          { title: "[[Life on _]](#camera)", x: 19, y: 22, name: "work-camera" },
          { title: "[[Coffee Machine]](#coffee)", x: 72, y: 39, name: "work-coffee" },
          { title: "[[Microwave]](#microwave)", x: 85, y: 30, name: "work-microwave" },
          { title: "[[Copy Machine]](#copy)", x: 78, y: 55, name: "work-copy" },
          { title: "[[This is not a fish]](#fish)", x: 8, y: 39, name: "work-fish" },
          { title: "[[Radio Show]](#radio)", x: 25, y: 49, name: "work-radio" },
          { title: "[[Touching Distance]](#touching)", x: 33, y: 80, name: "work-touching" },
          { title: "[[Lasers]](#lasers)", x: 26, y: 77, name: "work-lasers" },
        ];

        let textItems: TextContentItem[] = [];
        // Calculate aspect ratio, handle potential division by zero although unlikely for window height
        const aspectRatio = windowHeight > 0 ? windowWidth / windowHeight : 1; 
        const isNarrow = aspectRatio < ASPECT_RATIO_THRESHOLD;

        if (isNarrow) {
          // --- Narrow Layout (Anchored - Portrait/Tall Viewport) ---
          // Title is the first element, positioned near the top center
          textItems = [
            { name: "title", text: "WARANA>", x: 0, y: 50, centered: true, fontName: 'ascii' },
             // Anchor "about" below the center of "title"
            { name: "about", text: "[[About]](#about)", x: 0, y: 0, centered: true, anchorTo: "title", anchorPoint: 'center', anchorOffsetY: 50, alignment: "center", maxWidthPercent: 80 },
            // Anchor "upcoming" below the center of "about"
            { name: "upcoming", text: upcomingText, x: 0, y: 0, centered: true, anchorTo: "about", anchorPoint: 'center', anchorOffsetY: 5, alignment: "center", maxWidthPercent: 80 },
             // Add individual works anchored one after another, below the center of the previous one
            ...works.map((work, index) => {
              const anchorTo = index === 0 ? "upcoming" : works[index - 1].name;
              return {
                name: work.name,
                text: work.title,
                centered: true,
                x: Math.random() * 20 - 10, // Random x position between -20 and 20
                y: 5,
                anchorTo: anchorTo,
                anchorPoint: 'bottomLeft' as const, // Use 'center' which is a valid type
                anchorOffsetY: 1, // Vertical space below the center of the anchor
                alignment: "center" as const,
                isTitle: false,
                useSmallFont: true
              };
            })
          ];

        } else {
          // --- Wide Layout (Absolute Positioning - Landscape/Wide Viewport) ---
           textItems = [
            { text: "WARANA>", x: 0, y: 15, centered: true, fontName: 'ascii'}, // Adjusted y position slightly for title
            { text: upcomingText, x: 0, y: 25, isTitle: false, centered: true, maxWidthPercent: 45, alignment: "center" as const },
            { text: "[[About]](#about)", x: 60, y: 10, isTitle: false, maxWidthPercent: 40, alignment: "left" as const },
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

        // Small delay might still be useful, or adjust as needed
        setTimeout(() => {
          setTextContent(textItems);
          setIsLoading(false);
        }, 50); // Reduced delay slightly

      } catch (error) {
        console.error("Error generating text content:", error);
        setIsLoading(false);
      }
    };

    generateTextContent();
  // Rerun this effect when window dimensions change
  }, [windowWidth, windowHeight, preRenderedArt]);



  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      backgroundColor: 'white',
      color: 'white', // Text color is handled by AsciiArtGenerator internally? Check component styles.
      margin: 0,
      padding: 0,
      overflow: 'hidden' // Keep overflow hidden
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
    </div>
  );
}

export default HomePage; 