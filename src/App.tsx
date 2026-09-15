import { useState, useRef, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import type { Color, Piece, GameStartedMsg } from './types';
import { createSocket } from './net/socket';
import { Lobby } from './components/Lobby';
import { Setup } from './components/Setup';
import { GameView } from './components/GameView';

type Phase = 'menu' | 'waiting' | 'setup' | 'playing' | 'opponent_left';

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const [phase, setPhase] = useState<Phase>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [myColor, setMyColor] = useState<Color>('white');
  const [gameData, setGameData] = useState<GameStartedMsg | null>(null);
  const [error, setError] = useState('');

  function getSocket(): Socket {
    if (!socketRef.current) {
      socketRef.current = createSocket();
    }
    return socketRef.current;
  }

  useEffect(() => {
    const sock = getSocket();

    sock.on('room_created', (data: { code: string; color: Color }) => {
      setRoomCode(data.code);
      setMyColor(data.color);
      setPhase('waiting');
    });

    sock.on('room_joined', (data: { code: string; color: Color }) => {
      setRoomCode(data.code);
      setMyColor(data.color);
      setPhase('waiting');
    });

    sock.on('waiting_for_opponent', () => {
      setPhase('waiting');
    });

    sock.on('opponent_joined', () => {
      setPhase('setup');
    });

    sock.on('game_started', (data: GameStartedMsg) => {
      setGameData(data);
      setPhase('playing');
    });

    sock.on('opponent_left', () => {
      setPhase('opponent_left');
    });

    sock.on('error', (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      sock.removeAllListeners();
    };
  }, []);

  function handleCreateRoom() {
    setError('');
    getSocket().emit('create_room');
  }

  function handleJoinRoom(code: string) {
    setError('');
    getSocket().emit('join_room', { code });
  }

  function handleSetupReady(pieces: Piece[]) {
    getSocket().emit('submit_setup', { pieces });
    setPhase('waiting');
  }

  function handleGameEnd() {
    if (socketRef.current) {
      socketRef.current.emit('leave_room');
    }
    setPhase('menu');
    setGameData(null);
    setRoomCode('');
  }

  if (phase === 'menu') {
    return (
      <>
        <Lobby onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
        {error && <div className="error-toast">{error}</div>}
      </>
    );
  }

  if (phase === 'waiting') {
    return (
      <div className="handoff-screen">
        <h2>Ожидание соперника</h2>
        <p>Код комнаты:</p>
        <div className="room-code-display">{roomCode}</div>
        <p className="muted">Подождите, пока соперник подключится...</p>
        {error && <div className="error-toast">{error}</div>}
      </div>
    );
  }

  if (phase === 'setup') {
    return (
      <>
        <Setup
          color={myColor}
          title={`Расстановка ${myColor === 'white' ? 'белых' : 'чёрных'}`}
          onReady={handleSetupReady}
        />
        {error && <div className="error-toast">{error}</div>}
      </>
    );
  }

  if (phase === 'playing' && gameData) {
    return (
      <>
        <GameView
          gameData={gameData}
          socket={getSocket()}
          onGameEnd={handleGameEnd}
        />
        {error && <div className="error-toast">{error}</div>}
      </>
    );
  }

  if (phase === 'opponent_left') {
    return (
      <div className="handoff-screen">
        <h2>Соперник покинул игру</h2>
        <button onClick={handleGameEnd}>В меню</button>
      </div>
    );
  }

  return null;
}
