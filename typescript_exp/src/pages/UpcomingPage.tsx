import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsciiArtGenerator from '../components/ascii-art2/AsciiArtGenerator';
import { getCurrentCharMetrics } from '../components/ascii-art2/constants';
import type { AsciiLayoutInfo, TextContentItem } from '../components/ascii-art2/types';
import {
  areExhibitionsEqual,
  FALLBACK_EXHIBITIONS,
  formatUpcomingText,
  loadUpcomingExhibitions
} from '../utils/upcomingExhibitions';
import type { Exhibition } from '../utils/upcomingExhibitions';

const UPCOMING_BLOB_INITIAL_Y_PERCENT = 20;
const MIN_UPCOMING_BLOB_Y_PERCENT = 8;
const MAX_UPCOMING_BLOB_Y_PERCENT = 45;
const UPCOMING_LAYOUT_ADJUSTMENT_EPSILON = 0.25;

function UpcomingPage() {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>(FALLBACK_EXHIBITIONS);
  const [blobYPercent, setBlobYPercent] = useState(UPCOMING_BLOB_INITIAL_Y_PERCENT);
  const lastHandledLayoutSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadUpcomingExhibitions()
      .then(parsed => {
        if (!isMounted || !parsed.length) {
          return;
        }

        setExhibitions(current => (
          areExhibitionsEqual(current, parsed) ? current : parsed
        ));
      })
      .catch(error => {
        console.error('Failed to load upcoming exhibitions CSV', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLayoutChange = useCallback((layout: AsciiLayoutInfo) => {
    const upcomingBounds = layout.namedRawBounds.upcoming;
    const height = layout.size.height;
    const { charHeight } = getCurrentCharMetrics();

    if (!upcomingBounds || !height || !charHeight) {
      return;
    }

    const rows = height / charHeight;
    const contentCenterRow = (upcomingBounds.minY + upcomingBounds.maxY) / 2;
    const targetCenterRow = rows / 2;
    const adjustmentPercent = ((targetCenterRow - contentCenterRow) / rows) * 100;

    if (!Number.isFinite(adjustmentPercent) || Math.abs(adjustmentPercent) < UPCOMING_LAYOUT_ADJUSTMENT_EPSILON) {
      return;
    }

    const layoutSignature = [
      layout.size.width,
      height,
      charHeight,
      upcomingBounds.minY,
      upcomingBounds.maxY
    ].join(':');

    if (lastHandledLayoutSignatureRef.current === layoutSignature) {
      return;
    }
    lastHandledLayoutSignatureRef.current = layoutSignature;

    setBlobYPercent(current => {
      const next = Math.max(
        MIN_UPCOMING_BLOB_Y_PERCENT,
        Math.min(MAX_UPCOMING_BLOB_Y_PERCENT, current + adjustmentPercent)
      );

      return Math.abs(next - current) < UPCOMING_LAYOUT_ADJUSTMENT_EPSILON ? current : next;
    });
  }, []);

  const textContent = useMemo<TextContentItem[]>(() => [
    {
      name: 'upcoming',
      text: formatUpcomingText(exhibitions),
      x: 0,
      y: blobYPercent,
      centered: true,
      alignment: 'center',
      maxWidthPercent: 80
    }
  ], [blobYPercent, exhibitions]);

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
      <AsciiArtGenerator
        textContent={textContent}
        onLayoutChange={handleLayoutChange}
      />
    </div>
  );
}

export default UpcomingPage;
