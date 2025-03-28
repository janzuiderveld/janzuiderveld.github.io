import { useState, useEffect, useMemo } from 'react';
import AsciiArtGenerator from '../components/ascii-art2/AsciiArtGenerator';
// You might want to add your own ASCII art for the homepage
// import homeAsciiArt from '../assets/home/home_ascii.txt?raw';

function HomePage() {
  console.log("HomePage component rendering - should only show on homepage route");
  
  const [textContent, setTextContent] = useState<Array<{
    text: string, 
    x: number, 
    y: number, 
    isTitle?: boolean, 
    centered?: boolean, 
    preRenderedAscii?: string,
    useSmallFont?: boolean,
    fixed?: boolean,
    maxWidthPercent?: number,
    alignment?: 'left' | 'center' | 'right'
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const preRenderedArt = useMemo(() => {
    return {
      // If you add ASCII art for the homepage, include it here
      // home: homeAsciiArt,
    };
  }, []);
  
  useEffect(() => {
    const fetchTextContent = async () => {
      setIsLoading(true);
      try {        
        const upcomingText = `==Upcoming/ongoing==

01/06/2024 > 30/05/2026
==Coffee Machine==
//Dutch, More or Less. Contemporary Architecture, Design and Digital Culture//
//Het Nieuwe Instituut (Rotterdam, NL)//

15/01/2025 > 15/05/2025
==Copy Machine==
//Artificial vs. Intelligence//
//The Media Majlis at Northwestern University in Qatar (Doha, QA)//

29/04/2025 > 29/06/2025
==Coffee Machine==
//Deutsches Museum Nürnberg (Nürnberg, DE)//

12/02/2026 > 23/08/2026
==Coffee Machine==
//KUMU Kunstimuuseum (Tallinn, EE)//`;

        const aboutMeText = `About me

I am a researcher, artist and engineer with an academic background counting degrees in Physics, Electrical Engineering, Neuropsychology, Artificial Intelligence and ArtScience. My professional history includes leading a machine learning team specializing in speech-to-intent systems and hands-on experience as both a researcher and an engineer in the field of generative AI.

In my artistic endeavors I explore the intersection of technology and life, creating interactive installations that invite reflection on the essence of being. My projects often endow things with a spark of life, challenging perceptions of existence. My approach is characterized by playful engagement with artificial intelligence, seeking to emulate the behaviors of living beings in a way that resonates with and surprises both myself and my audience, blurring the lines between the animate and the inanimate.`;

        // Extract individual works from the works text
        const works = [
          { title: "[[Life on _]](camera)", x: 19, y: 79 },
          { title: "[[Coffee Machine]](coffee)", x: 80, y: 25 },
          { title: "[[Copy Machine]](copy)", x: 13, y: 45 },
          { title: "[[Lasers]](lasers)", x: 90, y: 50 },
          { title: "[[Touching Distance]](touching)", x: 5, y: 60 },
          { title: "[[This is not a fish]](camera)", x: 60, y: 80 }
        ];
        
        const textItems = [
          { text: "WARANA>", x: 0, y: 15, centered: true, fontName: 'ascii'},
          { text: upcomingText, x: 30, y: 25, isTitle: false, centered: true, maxWidthPercent: 45, alignment: "center" as const },
          { text: "[[About]](about)", x: 70, y: 10, isTitle: false, maxWidthPercent: 40, alignment: "left" as const },
          { text: "", x: 50, y: 40, isTitle: false, centered: true },
          // Add individual works as separate text items positioned around the page
          ...works.map(work => ({ 
            text: work.title, 
            x: work.x, 
            y: work.y, 
            isTitle: false, 
            useSmallFont: true 
          }))
        ];
        
        // Small delay to ensure DOM is ready before setting content
        setTimeout(() => {
          setTextContent(textItems);
          setIsLoading(false);
        }, 50);
      } catch (error) {
        console.error("Error fetching text content:", error);
        setIsLoading(false);
      }
    };
    
    fetchTextContent();
  }, [preRenderedArt]);

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
          {/* We're intentionally not showing any loading text to keep the screen pure white */}
        </div>
      ) : (
        <AsciiArtGenerator textContent={textContent} />
      )}
    </div>
  );
}

export default HomePage; 