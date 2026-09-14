import { useState } from 'react';
import type { Piece } from './types';
import { Setup } from './components/Setup';
import { GameView } from './components/GameView';

type Phase = 'menu' | 'setup-white' | 'setup-black' | 'handoff-to-black' | 'playing';

export default function App() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [whitePieces, setWhitePieces] = useState<Piece[]>([]);
  const [blackPieces, setBlackPieces] = useState<Piece[]>([]);

  if (phase === 'menu') {
    return (
      <div className="menu">
        <h1>Шахматы под прикрытием</h1>
        <p className="subtitle">
          Расставьте фигуры как хотите. Соперник не знает, кто есть кто.
          Цель — взять короля.
        </p>
        <button onClick={() => setPhase('setup-white')}>
          Новая партия
        </button>
      </div>
    );
  }

  if (phase === 'setup-white') {
    return (
      <Setup
        color="white"
        title="Расстановка белых"
        onReady={(pieces) => {
          setWhitePieces(pieces);
          setPhase('handoff-to-black');
        }}
      />
    );
  }

  if (phase === 'handoff-to-black') {
    return (
      <div className="handoff-screen">
        <h2>Передайте устройство</h2>
        <p>Чёрные расставляют фигуры</p>
        <button onClick={() => setPhase('setup-black')}>Я готов</button>
      </div>
    );
  }

  if (phase === 'setup-black') {
    return (
      <Setup
        color="black"
        title="Расстановка чёрных"
        onReady={(pieces) => {
          setBlackPieces(pieces);
          setPhase('playing');
        }}
      />
    );
  }

  if (phase === 'playing') {
    return (
      <GameView
        whitePieces={whitePieces}
        blackPieces={blackPieces}
        onGameEnd={() => {}}
      />
    );
  }

  return null;
}
