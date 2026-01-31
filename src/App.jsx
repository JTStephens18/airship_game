import { useEffect, useRef, useState } from 'react';
import { useControls, folder } from 'leva';
import { ThreeEngine } from './engine/ThreeEngine';
import './App.css';

function App() {
  const containerRef = useRef(null);
  const engineRef = useRef(null);

  // Game state for UI
  const [health, setHealth] = useState(100);
  const [maxHealth, setMaxHealth] = useState(100);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

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
      horizonDistance: { value: 116, min: 10, max: 200 },
      horizonCurve: { value: 0.06, min: 0, max: 0.5, step: 0.01 },
      fogColor: '#aec7ff',
      fogNear: { value: 80, min: 0, max: 500 },
      fogFar: { value: 150, min: 0, max: 500 },
      sandStart: { value: -1.0, min: -10, max: 10, step: 0.1 },
      sandEnd: { value: 1.5, min: -5, max: 15, step: 0.1 },
      grassStart: { value: 1.5, min: -5, max: 15, step: 0.1 },
      grassEnd: { value: 3.0, min: 0, max: 20, step: 0.1 },
      rockStart: { value: 6.0, min: 0, max: 30, step: 0.1 },
      rockEnd: { value: 8.0, min: 5, max: 50, step: 0.1 },
    }),
    Cube: folder({
      scale: { value: 1.5, min: 0.5, max: 3, step: 0.1 },
      color: '#00ff00',
      lightIntensity: { value: 2, min: 0, max: 10, step: 0.1 },
    }),
    Enemies: folder({
      spawnRate: { value: 3, min: 0.5, max: 10, step: 0.5 },
      maxEnemies: { value: 15, min: 1, max: 30, step: 1 },
    })
  });

  useEffect(() => {
    if (containerRef.current && !engineRef.current) {
      engineRef.current = new ThreeEngine(containerRef.current);

      // Wire up game state callbacks
      engineRef.current.onHealthChange = (h, m) => {
        setHealth(h);
        setMaxHealth(m);
      };
      engineRef.current.onScoreChange = (s) => setScore(s);
      engineRef.current.onGameOver = (finalScore) => setGameOver(true);
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

  const handleRestart = () => {
    if (engineRef.current) {
      engineRef.current.restart();
      setHealth(100);
      setScore(0);
      setGameOver(false);
    }
  };

  const healthPercent = (health / maxHealth) * 100;

  return (
    <div className="app-container">
      <div ref={containerRef} className="canvas-container" />

      {/* HUD Overlay */}
      <div className="hud">
        <div className="health-bar-container">
          <div
            className="health-bar"
            style={{ width: `${healthPercent}%` }}
          />
          <span className="health-text">{health}/{maxHealth}</span>
        </div>
        <div className="score">SCORE: {score}</div>
      </div>

      {/* Game Over Screen */}
      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-content">
            <h1>GAME OVER</h1>
            <p className="final-score">Final Score: {score}</p>
            <button onClick={handleRestart} className="restart-button">
              RESTART
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
