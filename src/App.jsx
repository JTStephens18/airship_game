import { useEffect, useRef } from 'react';
import { useControls } from 'leva';
import { ThreeEngine } from './engine/ThreeEngine';
import './App.css';

function App() {
  const containerRef = useRef(null);
  const engineRef = useRef(null);

  const controls = useControls({
    scale: { value: 1.5, min: 0.5, max: 3, step: 0.1 },
    color: '#00ff00',
    lightIntensity: { value: 2, min: 0, max: 10, step: 0.1 },
  });

  useEffect(() => {
    if (containerRef.current && !engineRef.current) {
      engineRef.current = new ThreeEngine(containerRef.current);
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, []);

  // Reactive updates to the engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateControls(controls);
    }
  }, [controls]);

  return (
    <div className="app-container">
      <div ref={containerRef} className="canvas-container" />
      <div className="ui-overlay">
        <h1>Three.js + React (Vanilla Engine)</h1>
        <p>Managed by React, Rendered by Three.js Shading Language</p>
      </div>
    </div>
  );
}

export default App;
