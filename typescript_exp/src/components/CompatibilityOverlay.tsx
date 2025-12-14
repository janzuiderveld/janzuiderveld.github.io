import { useEffect, useMemo, useState } from 'react';
import { CHAR_HEIGHT, CHAR_WIDTH, SCALE_FACTOR } from './ascii-art2/constants';

type Phase = 'fadeIn' | 'hold' | 'fadeOut' | 'done';

type CompatibilityOverlayProps = {
  message: string;
  onComplete: () => void;
  holdDuration?: number;
  scrambleDuration?: number;
};

const RANDOM_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()[]{}<>?/\\|+-_=~';

const getRandomChar = () => RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)];

const createBlankString = (chars: string[]) =>
  chars.map(char => (char === '\n' ? '\n' : ' ')).join('');

const buildGridString = (text: string, cols: number, rows: number) => {
  const safeCols = Math.max(1, cols);
  const safeRows = Math.max(1, rows);
  const lines = text.split('\n').map(line => line.slice(0, safeCols));
  const emptyLine = ' '.repeat(safeCols);
  const topPad = Math.max(0, Math.floor((safeRows - lines.length) / 2));
  const bottomPad = Math.max(0, safeRows - lines.length - topPad);

  const paddedLines = lines.map(line => {
    const leftPad = Math.max(0, Math.floor((safeCols - line.length) / 2));
    const rightPad = Math.max(0, safeCols - line.length - leftPad);
    return `${' '.repeat(leftPad)}${line}${' '.repeat(rightPad)}`;
  });

  return [
    ...Array(topPad).fill(emptyLine),
    ...paddedLines,
    ...Array(bottomPad).fill(emptyLine)
  ].join('\n');
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function CompatibilityOverlay({
  message,
  onComplete,
  holdDuration = 5000,
  scrambleDuration = 1600,
}: CompatibilityOverlayProps) {
  const targetChars = useMemo(() => message.split(''), [message]);
  const blankState = useMemo(() => createBlankString(targetChars), [targetChars]);
  const [phase, setPhase] = useState<Phase>('fadeIn');
  const [displayText, setDisplayText] = useState(() => blankState);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768
  }));

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const gridCols = Math.max(1, Math.floor(viewport.width / CHAR_WIDTH));
  const gridRows = Math.max(1, Math.floor(viewport.height / CHAR_HEIGHT));

  const gridString = useMemo(
    () => buildGridString(displayText, gridCols, gridRows),
    [displayText, gridCols, gridRows]
  );

  useEffect(() => {
    if (phase !== 'fadeIn') {
      return;
    }

    const thresholds = targetChars.map(() => Math.random() * scrambleDuration);
    const startTime = now();

    const interval = window.setInterval(() => {
      const elapsed = now() - startTime;
      const next = targetChars
        .map((char, idx) => {
          if (char === ' ' || char === '\n') {
            return char;
          }
          if (elapsed >= thresholds[idx]) {
            return char;
          }
          return Math.random() > 0.35 ? getRandomChar() : ' ';
        })
        .join('');

      setDisplayText(next);

      if (elapsed >= scrambleDuration) {
        clearInterval(interval);
        setDisplayText(message);
        setPhase('hold');
      }
    }, 45);

    return () => clearInterval(interval);
  }, [phase, targetChars, scrambleDuration, message]);

  useEffect(() => {
    if (phase !== 'hold') {
      return;
    }
    const timeoutId = window.setTimeout(() => setPhase('fadeOut'), holdDuration);
    return () => clearTimeout(timeoutId);
  }, [phase, holdDuration]);

  useEffect(() => {
    if (phase !== 'fadeOut') {
      return;
    }

    const thresholds = targetChars.map(() => Math.random() * scrambleDuration);
    const startTime = now();

    const interval = window.setInterval(() => {
      const elapsed = now() - startTime;
      const next = targetChars
        .map((char, idx) => {
          if (char === ' ' || char === '\n') {
            return char;
          }
          if (elapsed >= thresholds[idx]) {
            return ' ';
          }
          return Math.random() > 0.5 ? getRandomChar() : char;
        })
        .join('');

      setDisplayText(next);

      if (elapsed >= scrambleDuration) {
        clearInterval(interval);
        setDisplayText(blankState);
        setPhase('done');
      }
    }, 45);

    return () => clearInterval(interval);
  }, [phase, targetChars, scrambleDuration, blankState]);

  useEffect(() => {
    if (phase !== 'done') {
      return;
    }
    const timeoutId = window.setTimeout(onComplete, 200);
    return () => clearTimeout(timeoutId);
  }, [phase, onComplete]);

  const isTransparent = phase === 'done';

  return (
    <div className={`compatibility-overlay${isTransparent ? ' compatibility-overlay--transparent' : ''}`}>
      <pre
        className="compatibility-overlay__grid"
        aria-live="assertive"
        style={{
          fontSize: `${SCALE_FACTOR}px`,
          lineHeight: `${SCALE_FACTOR}px`
        }}
      >
        {gridString}
      </pre>
    </div>
  );
}

export default CompatibilityOverlay;
