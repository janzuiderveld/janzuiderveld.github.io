import { useEffect, useMemo, useState } from 'react';
import { TextContentItem } from './ascii-art2/types';
import { IS_SAFARI } from './ascii-art2/constants';
import PhotoModeScene from './photorealistic/PhotoModeScene';
import { PhotoLayerItem } from './photorealistic/PhotorealisticLayer';

type PhotoAlign = {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  stretchX?: number;
  stretchY?: number;
};

type ProjectPageProps = {
  title: string;
  text: string;
  asciiArt: string;
  photo: { src: string; alt: string };
  align: PhotoAlign;
  backHref?: string;
};

const downsampleAsciiArt = (art: string, factor: number) => {
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
};

const ProjectPage = ({
  title,
  text,
  asciiArt,
  photo,
  align,
  backHref = '#/'
}: ProjectPageProps) => {
  const [textContent, setTextContent] = useState<TextContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const heroName = 'hero';

  const optimizedAscii = useMemo(() => {
    if (!IS_SAFARI) return asciiArt;
    return downsampleAsciiArt(asciiArt, 2);
  }, [asciiArt]);

  const optimizedText = useMemo(() => {
    if (!IS_SAFARI) return text;
    return text.replace(/\n{3,}/g, '\n\n');
  }, [text]);

  useEffect(() => {
    setIsLoading(true);
    const textItems: TextContentItem[] = [
      { name: 'title', text: title, x: 0, y: 10, centered: true, fontName: 'blockAsciiDouble' },
      { name: 'back', text: `[[<<<]](${backHref})`, x: 2, y: 4, fixed: true },
      {
        name: 'text',
        text: optimizedText,
        x: 0,
        y: 20,
        centered: true,
        maxWidthPercent: IS_SAFARI ? 55 : 60,
        alignment: 'left',
        anchorTo: 'title',
        anchorPoint: 'bottomCenter',
        anchorOffsetY: 4
      },
      {
        name: heroName,
        text: title,
        x: 0,
        y: 0,
        preRenderedAscii: optimizedAscii,
        centered: true,
        anchorTo: 'text',
        anchorPoint: 'bottomCenter',
        anchorOffsetY: -13
      }
    ];

    const timeout = window.setTimeout(() => {
      setTextContent(textItems);
      setIsLoading(false);
    }, 50);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [backHref, heroName, optimizedAscii, optimizedText, title]);

  const photoItems = useMemo<PhotoLayerItem[]>(() => [
    {
      id: `${title}-main`,
      anchorName: heroName,
      lowSrc: photo.src,
      highSrc: photo.src,
      alt: photo.alt,
      boundsSource: 'raw',
      objectFit: 'cover',
      offsetX: align.offsetX,
      offsetY: align.offsetY,
      scaleX: align.scaleX,
      scaleY: align.scaleY,
      stretchX: align.stretchX ?? 1,
      stretchY: align.stretchY ?? 1
    }
  ], [
    align.offsetX,
    align.offsetY,
    align.scaleX,
    align.scaleY,
    align.stretchX,
    align.stretchY,
    heroName,
    photo.alt,
    photo.src,
    title
  ]);

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        backgroundColor: 'white',
        color: 'white',
        margin: 0,
        padding: 0,
        overflow: 'hidden'
      }}
    >
      {isLoading ? (
        <div
          style={{
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
          }}
        />
      ) : (
        <PhotoModeScene
          textContent={textContent}
          photoItems={photoItems}
          asciiClickTargets={[heroName]}
        />
      )}
    </div>
  );
};

export default ProjectPage;
