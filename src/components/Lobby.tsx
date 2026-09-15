import { useState } from 'react';

interface LobbyProps {
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
}

export function Lobby({ onCreateRoom, onJoinRoom }: LobbyProps) {
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');

  if (mode === 'menu') {
    return (
      <div className="menu">
        <h1>Шахматы под прикрытием</h1>
        <p className="subtitle">
          Расставьте фигуры как хотите. Соперник не знает, кто есть кто.
          Цель — взять короля.
        </p>
        <div className="menu-buttons">
          <button onClick={onCreateRoom}>Создать комнату</button>
          <button onClick={() => setMode('join')}>Подключиться</button>
        </div>
      </div>
    );
  }

  return (
    <div className="menu">
      <h1>Подключиться к комнате</h1>
      <div className="join-form">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Код комнаты"
          maxLength={6}
          className="code-input"
          autoFocus
        />
        <div className="menu-buttons">
          <button
            onClick={() => onJoinRoom(code)}
            disabled={code.length !== 6}
          >
            Подключиться
          </button>
          <button onClick={() => setMode('menu')}>Назад</button>
        </div>
      </div>
    </div>
  );
}
