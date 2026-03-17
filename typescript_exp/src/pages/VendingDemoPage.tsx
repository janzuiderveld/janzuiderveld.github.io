const VENDING_DEMO_EMBED_SRC = 'https://player.vimeo.com/video/1171787116?app_id=122963';

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
