import { useEffect, useRef } from 'react';
import { useControls, folder } from 'leva';
import { ThreeEngine } from './engine/ThreeEngine';
import './App.css';

function App() {
  const containerRef = useRef(null);
  const engineRef = useRef(null);

  const controls = useControls({
    debug: false,
    Planet: folder({
      octaves: { value: 2, min: 1, max: 12, step: 1 },
      frequency: { value: 0.06, min: 0.001, max: 0.5, step: 0.001 },
      amplitude: { value: 0.2, min: 0.1, max: 5.0, step: 0.1 },
      lacunarity: { value: 1.6, min: 1.0, max: 4.0, step: 0.1 },
      persistence: { value: 0.90, min: 0.1, max: 1.0, step: 0.05 },
      heightScale: { value: 35, min: 1, max: 100, step: 1 },
      heightOffset: { value: 0.09, min: -1.0, max: 1.0, step: 0.01 },
      waterFloor: { value: -2.0, min: -20, max: 0, step: 0.1 },
    }),
    Cube: folder({
      scale: { value: 1.5, min: 0.5, max: 3, step: 0.1 },
      color: '#00ff00',
      lightIntensity: { value: 2, min: 0, max: 10, step: 0.1 },
    })
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
    </div>
  );
}

export default App;
