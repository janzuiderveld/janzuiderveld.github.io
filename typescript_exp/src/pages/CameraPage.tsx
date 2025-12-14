// src/pages/CameraPage.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import AsciiArtGenerator from '../components/ascii-art2/AsciiArtGenerator';
import cameraAsciiArt from '../assets/camera/camera_ascii.txt?raw';
import cameraText from '../assets/camera/camera_text.txt?raw';
import { IS_SAFARI } from '../components/ascii-art2/constants';

function CameraPage() {
  // console.log("CameraPage component rendering - should only show on /camera route");
  
  const [textContent, setTextContent] = useState<Array<{
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
    anchorTo?: string;
    anchorOffsetX?: number;
    anchorOffsetY?: number;
    anchorPoint?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center' | 'bottomCenter';
    name?: string;
    fontName?: 'regular' | 'ascii' | 'smallAscii';
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const downsampleAsciiArt = useCallback((art: string, factor: number) => {
    if (factor <= 1) return art;

    const lines = art.split('\n');
    const sampledRows = lines.filter((_, rowIndex) => rowIndex % factor === 0);

    const sampled = sampledRows.map(line => {
      if (!line) return line;
      let reduced = '';
      for (let i = 0; i < line.length; i += factor) {
        reduced += line[i] ?? ' ';
      }
      return reduced;
    });

    return sampled.join('\n');
  }, []);

  const optimizedAscii = useMemo(() => {
    if (!IS_SAFARI) return cameraAsciiArt;
    return downsampleAsciiArt(cameraAsciiArt, 2);
  }, [downsampleAsciiArt, cameraAsciiArt]);

  const optimizedText = useMemo(() => {
    if (!IS_SAFARI) return cameraText;
    return cameraText.replace(/\n{3,}/g, '\n\n');
  }, [cameraText]);

  const preRenderedArt = useMemo(() => ({
    camera: optimizedAscii,
  }), [optimizedAscii]);
  
  useEffect(() => {
    const fetchTextContent = async () => {
      setIsLoading(true);
      try {        
        const textItems = [
          { name: "Life on _", text: "Life on _", x: 0, y: 10, isTitle: true, centered: true, fontName: 'ascii' as 'ascii'},
          { name: "back", text: "[[<<<]](#/)", x: 2, y: 4, fixed: true},
          { name: "text", text: optimizedText, x: 0, y: 20, centered: true, maxWidthPercent: IS_SAFARI ? 55 : 60, alignment: 'left' as 'left' },
          { name: "Camera", text: "Camera", x: 0, y: 0, preRenderedAscii: preRenderedArt.camera, centered: true, anchorTo: "text", anchorOffsetX: 0, anchorOffsetY: -13, anchorPoint: "bottomCenter" as 'bottomCenter' },
          { name: "exhibitions", text: "==Selected exhibitions==\n\n==2025==\nLife on //Big Dada//\nArti et Amicitiae (Amsterdam, NL)\n\n==2024==\nLife on //SIGN// / Camera + Theater\nSIGN (Groningen, NL)", x: 0, y: 90, centered: true, maxWidthPercent: 60, alignment: 'center' as 'center', anchorTo: "Camera", anchorOffsetX: 0, anchorOffsetY: 5, anchorPoint: "bottomCenter" as 'bottomCenter' }
        ];
        
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
        </div>
      ) : (
        <AsciiArtGenerator textContent={textContent} />
      )}
    </div>
  );
}

export default CameraPage;
