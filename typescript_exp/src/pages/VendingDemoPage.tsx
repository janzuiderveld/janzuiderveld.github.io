const VENDING_DEMO_EMBED_SRC = 'https://player.vimeo.com/video/1179367379?badge=0&autopause=0&player_id=0&app_id=58479';

function VendingDemoPage() {
  return (
    <iframe
      title="Vending demo video"
      src={VENDING_DEMO_EMBED_SRC}
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      style={{
        display: 'block',
        width: '100vw',
        height: '100vh',
        border: '0'
      }}
    />
  );
}

export default VendingDemoPage;
