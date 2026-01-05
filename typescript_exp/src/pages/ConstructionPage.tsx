// src/pages/ConstructionPage.tsx
import { useState, useEffect, useMemo } from 'react';
import AsciiArtGenerator from '../components/ascii-art2/AsciiArtGenerator';
import { TextContentItem } from '../components/ascii-art2/types';
import constructionAsciiArt from '../assets/construction/construction_ascii.txt?raw';
function ConstructionPage() {
  
  const [textContent, setTextContent] = useState<TextContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const preRenderedArt = useMemo(() => {
    return {
      construction: constructionAsciiArt,
    };
  }, []);
  
  useEffect(() => {
    const fetchTextContent = async () => {
      setIsLoading(true);
      try {        
        const textItems: TextContentItem[] = [
          { text: 'UNDER', x: 0, y: 10, centered: true, fontName: 'ascii' },
          { text: 'CONSTRUCTION', x: 0, y: 20, centered: true, fontName: 'ascii' },
          { text: 'construction', x: 0, y: 40, preRenderedAscii: preRenderedArt.construction, centered: true },
          { text: 'This page is under [construction]. Please check back soon. If in need of more info, contact me at jan@warana.xyz or janzuiderveld@gmail.com', x: 0, y: 30, centered: true, maxWidthPercent: 60, alignment: 'center' },
          { text: '[[<<<]](#/)', x: 2, y: 2, centered: false, maxWidthPercent: 60, alignment: 'left', fontName: 'regular' },
          
          // Test Links - clearly labeled to distinguish them
          // { text: "LINK 1: [Click me](https://www.google.com)", x: 50, y: 20, centered: true, fixed: true },
          // { text: "LINK 2: [GitHub](https://github.com) | [Twitter](https://twitter.com) | [LinkedIn](https://linkedin.com)", x: 50, y: 80, centered: true, fixed: true },
          // { text: "LINK 3: [more links](https://example.com)", x: 20, y: 120, centered: false, fixed: false },
          
          // // Cross-browser test links at different vertical positions
          // { text: "LINK 4 (top): [Top link](https://example.com/top)", x: 50, y: 5, centered: true, fixed: true },
          // { text: "LINK 5 (middle): [Middle link](https://example.com/middle)", x: 50, y: 40, centered: true, fixed: true },
          // { text: "LINK 6 (bottom): [Bottom link](https://example.com/bottom)", x: 50, y: 140, centered: true, fixed: false },
          // { text: "LINK 7 (very bottom): [Very bottom link](https://example.com/very-bottom)", x: 50, y: 160, centered: true, fixed: false },
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
      backgroundColor: 'black',
      color: 'white',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', backgroundColor: 'white' }}>
          <div style={{ color: 'white', fontSize: '18px' }}>Loading...</div>
        </div>
      ) : (
        <AsciiArtGenerator textContent={textContent} />
      )}
    </div>
  );
}

export default ConstructionPage;
