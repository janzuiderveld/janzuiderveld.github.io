import './App.css'

// import AsciiDemo from './components/AsciiDemo';

import AsciiArtGenerator from './components/AsciiArtGenerator';
// import AsciiArtGenerator from './components/Ascii_paper_bck';

function App() {
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
      {/* <AsciiDemo /> */}
      <AsciiArtGenerator />
    </div>
  );
}

export default App
