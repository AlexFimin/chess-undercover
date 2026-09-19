import { useState, useEffect } from 'react';
import type { Color, Piece, GameStartedMsg, GameRestoredMsg } from './types';
import { createSocket } from './net/socket';
import { Lobby } from './components/Lobby';
import { Setup } from './components/Setup';
import { GameView, type RestoreData } from './components/GameView';

// Р•РґРёРЅСЃС‚РІРµРЅРЅС‹Р№ СЃРѕРєРµС‚ РЅР° РІСЃС‘ РїСЂРёР»РѕР¶РµРЅРёРµ (СЃРѕР·РґР°С‘С‚СЃСЏ РѕРґРёРЅ СЂР°Р· РїСЂРё Р·Р°РіСЂСѓР·РєРµ РјРѕРґСѓР»СЏ)
const socket = createSocket();

type Phase = 'menu' | 'waiting' | 'setup' | 'playing' | 'opponent_left';

interface StoredSession {
  code: string;
  token: string;
}

const SESSION_KEY = 'chess-undercover:session';

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession | null;
    if (parsed && typeof parsed.code === 'string' && typeof parsed.token === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveSession(session: StoredSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // localStorage РЅРµРґРѕСЃС‚СѓРїРµРЅ вЂ” СЃРµСЃСЃРёСЏ РїСЂРѕСЃС‚Рѕ РЅРµ СЃРѕС…СЂР°РЅРёС‚СЃСЏ
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // РёРіРЅРѕСЂРёСЂСѓРµРј
  }
}

// РљРѕРїРёСЂРѕРІР°РЅРёРµ С‚РµРєСЃС‚Р° СЃ fallback РґР»СЏ РЅРµР±РµР·РѕРїР°СЃРЅРѕРіРѕ РєРѕРЅС‚РµРєСЃС‚Р° (http)
function copyText(text: string): boolean {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      void navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [myColor, setMyColor] = useState<Color>('white');
  const [gameData, setGameData] = useState<GameStartedMsg | null>(null);
  const [restoreData, setRestoreData] = useState<RestoreData | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedSession, setSavedSession] = useState<StoredSession | null>(() => loadSession());
  // РљРѕРґ РєРѕРјРЅР°С‚С‹ РёР· СЃСЃС‹Р»РєРё-РїСЂРёРіР»Р°С€РµРЅРёСЏ (?room=XXXXXX)
  const [initialRoom] = useState<string | null>(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('room');
      return param ? param.toUpperCase().slice(0, 6) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    socket.on('room_created', (data: { code: string; color: Color; token: string }) => {
      const session = { code: data.code, token: data.token };
      saveSession(session);
      setSavedSession(session);
      setRoomCode(data.code);
      setMyColor(data.color);
      setRestoreData(null);
      setPhase('waiting');
    });

    socket.on('room_joined', (data: { code: string; color: Color; token: string }) => {
      const session = { code: data.code, token: data.token };
      saveSession(session);
      setSavedSession(session);
      setRoomCode(data.code);
      setMyColor(data.color);
      setRestoreData(null);
      setPhase('waiting');
    });

    socket.on('waiting_for_opponent', () => {
      setPhase('waiting');
    });

    socket.on('opponent_joined', () => {
      setPhase('setup');
    });

    socket.on('game_started', (data: GameStartedMsg) => {
      setGameData(data);
      setRestoreData(null);
      setPhase('playing');
    });

    socket.on('reconnect_ok', (msg: GameRestoredMsg) => {
      setRoomCode(msg.code);
      setMyColor(msg.myColor);
      setError('');
      if (msg.phase === 'waiting') {
        setGameData(null);
        setRestoreData(null);
        setPhase('waiting');
      } else if (msg.phase === 'setup') {
        setGameData(null);
        setRestoreData(null);
        setPhase('setup');
      } else {
        const gd: GameStartedMsg = {
          myPieces: msg.myPieces ?? [],
          opponentPieces: msg.opponentPieces ?? [],
          pieceNumbers: msg.pieceNumbers ?? {},
          myColor: msg.myColor,
        };
        const rd: RestoreData = {
          myPieces: msg.myPieces ?? [],
          opponentPieces: msg.opponentPieces ?? [],
          pieceNumbers: msg.pieceNumbers ?? {},
          currentPlayer: msg.currentPlayer ?? 'white',
          winner: msg.winner ?? null,
          history: msg.history ?? [],
          capturedPieceIds: msg.capturedPieceIds ?? [],
          pendingPromotion: msg.pendingPromotion ?? null,
          opponentGraceUntil: msg.opponentGraceUntil ?? null,
        };
        setGameData(gd);
        setRestoreData(rd);
        setPhase('playing');
      }
    });

    socket.on('reconnect_failed', (data: { message: string }) => {
      clearSession();
      setSavedSession(null);
      setError(data.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ РІРѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ РёРіСЂСѓ');
      setTimeout(() => setError(''), 5000);
    });

    socket.on('opponent_left', () => {
      clearSession();
      setSavedSession(null);
      setPhase('opponent_left');
    });

    socket.on('error', (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      socket.removeAllListeners();
    };
  }, []);

  function handleCreateRoom() {
    setError('');
    socket.emit('create_room');
  }

  function handleJoinRoom(code: string) {
    setError('');
    socket.emit('join_room', { code });
  }

  function handleReconnect() {
    if (!savedSession) return;
    setError('');
    socket.emit('reconnect', { code: savedSession.code, token: savedSession.token });
  }

  function handleSetupReady(pieces: Piece[]) {
    socket.emit('submit_setup', { pieces });
    setPhase('waiting');
  }

  function handleGameEnd() {
    clearSession();
    setSavedSession(null);
    socket.emit('leave_room');
    setPhase('menu');
    setGameData(null);
    setRestoreData(null);
    setRoomCode('');
  }

  if (phase === 'menu') {
    return (
      <>
        <Lobby
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onReconnect={savedSession ? handleReconnect : null}
          reconnectCode={savedSession?.code}
          initialRoom={initialRoom}
        />
        {error && <div className="error-toast">{error}</div>}
      </>
    );
  }

  if (phase === 'waiting') {
    return (
      <div className="handoff-screen">
        <h2>РћР¶РёРґР°РЅРёРµ СЃРѕРїРµСЂРЅРёРєР°</h2>
        <p>РљРѕРґ РєРѕРјРЅР°С‚С‹:</p>
        <div className="room-code-display">{roomCode}</div>
        <button
          className="copy-link-btn"
          onClick={() => {
            if (copyText(`${window.location.origin}/?room=${roomCode}`)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
        >
          {copied ? 'РЎСЃС‹Р»РєР° СЃРєРѕРїРёСЂРѕРІР°РЅР°!' : 'РЎРєРѕРїРёСЂРѕРІР°С‚СЊ СЃСЃС‹Р»РєСѓ-РїСЂРёРіР»Р°С€РµРЅРёРµ'}
        </button>
        <p className="muted">РџРѕРґРѕР¶РґРёС‚Рµ, РїРѕРєР° СЃРѕРїРµСЂРЅРёРє РїРѕРґРєР»СЋС‡РёС‚СЃСЏ...</p>
        {error && <div className="error-toast">{error}</div>}
      </div>
    );
  }

  if (phase === 'setup') {
    return (
      <>
        <Setup
          color={myColor}
          title={`Р Р°СЃСЃС‚Р°РЅРѕРІРєР° ${myColor === 'white' ? 'Р±РµР»С‹С…' : 'С‡С‘СЂРЅС‹С…'}`}
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
          key={roomCode}
          gameData={gameData}
          restore={restoreData}
          socket={socket}
          onGameEnd={handleGameEnd}
        />
        {error && <div className="error-toast">{error}</div>}
      </>
    );
  }

  if (phase === 'opponent_left') {
    return (
      <div className="handoff-screen">
        <h2>РЎРѕРїРµСЂРЅРёРє РїРѕРєРёРЅСѓР» РёРіСЂСѓ</h2>
        <button onClick={handleGameEnd}>Р’ РјРµРЅСЋ</button>
      </div>
    );
  }

  return null;
}
