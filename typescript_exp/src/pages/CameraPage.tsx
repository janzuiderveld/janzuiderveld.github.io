// src/pages/CameraPage.tsx
import { useState, useEffect, useMemo } from 'react';
// import AsciiArtGenerator from '../components/ascii-art/AsciiArtGenerator';
import AsciiArtGenerator from '../components/ascii-art2/AsciiArtGenerator';
import cameraAsciiArt from '../assets/camera/camera_ascii.txt?raw';

import cameraText from '../assets/camera/camera_text.txt?raw';

function CameraPage() {
  console.log("CameraPage component rendering - should only show on /camera route");
  
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
      camera: cameraAsciiArt,
    };
  }, []);
  
  useEffect(() => {
    const fetchTextContent = async () => {
      setIsLoading(true);
      try {        
        const textItems = [
          { name: "Life on _", text: "Life on _", x: 50, y: 10, isTitle: true, centered: true, fontName: 'ascii'},
          { name: "back", text: "[[<<<]](/)", x: 2, y: 4, fixed: false},
          {  name: "text", text: cameraText, x: 20, y: 30, centered: true, maxWidthPercent: 60, alignment: 'left' as 'left' },
          { name: "Camera", text: "Camera", x: 50, y: 60, preRenderedAscii: preRenderedArt.camera, centered: true, anchorTo: "text", anchorOffsetX: 0, anchorOffsetY: -13, anchorPoint: "bottomLeft" as 'bottomLeft' },
          // {  name: "exhibitions", text: "==Selected exhibitions==\n\n", x: 20, y: 90, centered: true, maxWidthPercent: 60, alignment: 'centered', anchorTo: "Camera", anchorOffsetX: 0, anchorOffsetY: 5, anchorPoint: "bottomLeft" as 'bottomLeft' },
          
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

export default CameraPage;