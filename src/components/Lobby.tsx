import { useState } from 'react';

interface LobbyProps {
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onReconnect: (() => void) | null;
  reconnectCode?: string;
  initialRoom: string | null;
}

export function Lobby({ onCreateRoom, onJoinRoom, onReconnect, reconnectCode, initialRoom }: LobbyProps) {
  const [code, setCode] = useState(initialRoom ?? '');
  const [mode, setMode] = useState<'menu' | 'join'>(initialRoom ? 'join' : 'menu');

  if (mode === 'menu') {
    return (
      <div className="menu">
        <h1>Шахматы под прикрытием</h1>
        <p className="subtitle">
          Расставьте фигуры как хотите. Соперник не знает, кто есть кто.
          Цель — взять короля.
        </p>
        {onReconnect && (
          <button className="reconnect-btn" onClick={onReconnect}>
            Вернуться в игру{reconnectCode ? ` (${reconnectCode})` : ''}
          </button>
        )}
        <div className="menu-buttons">
          <button onClick={onCreateRoom}>Создать комнату</button>
          <button onClick={() => setMode('join')}>Подключиться</button>
        </div>

        <div className="info-sections">
          <details>
            <summary>📋 Описание</summary>
            <div className="info-body">
              <p>
                <strong>Шахматы под прикрытием</strong> — вариант шахмат со скрытой информацией
                и дедукцией. Каждый игрок втайне расставляет свои фигуры, а соперник видит
                их только как безликие номера. Кто скрывается под №7 — ферзь или пешка?
              </p>
              <p>
                Наблюдайте за ходами, отсеивайте невозможное и раскрывайте чужую армию,
                пока ваша остаётся загадкой. Побеждает тот, кто первым возьмёт короля.
              </p>
            </div>
          </details>

          <details>
            <summary>🎮 Как играть</summary>
            <div className="info-body">
              <ol>
                <li>Один игрок создаёт комнату и получает код или ссылку-приглашение.</li>
                <li>Отправьте код или ссылку другу — он подключится к вашей партии.</li>
                <li>Каждый втайне расставляет свои 16 фигур на двух своих горизонталях.</li>
                <li>
                  Когда оба готовы — партия начинается. Ходите по очереди, следите за
                  передвижениями соперника и сужайте круг подозреваемых в панели дедукции.
                </li>
                <li>Игра идёт до взятия короля. Шахов и матов нет — только разведка и расчёт.</li>
              </ol>
              <p className="muted">
                Играть можно с любого устройства в браузере. Если соединение оборвалось —
                не страшно: у вас есть 5 минут, чтобы вернуться в партию.
              </p>
            </div>
          </details>

          <details>
            <summary>📜 Правила</summary>
            <div className="info-body">
              <h4>Доска и расстановка</h4>
              <p>
                Стандартная доска 8×8. Каждый игрок свободно расставляет свои 16 фигур
                на двух своих горизонталях (белые — 1-я и 2-я, чёрные — 7-я и 8-я).
                Расстановка произвольная, следовать классической схеме не обязательно.
              </p>
              <h4>Ходы</h4>
              <p>
                Фигуры ходят по стандартным шахматным правилам. Пешка может пойти на 2 клетки
                вперёд только со своей стартовой горизонтали. Рокировки и взятия на проходе нет.
                Пешка, достигшая последней горизонтали, превращается в любую фигуру.
              </p>
              <h4>Скрытность и дедукция</h4>
              <p>
                Свои фигуры видны полностью. Фигуры соперника отображаются как нумерованные
                круги (1–16). Каждый ход фигуры сужает список её возможных типов. При взятии
                фигура раскрывается. Если по количеству фигура не может быть определённого
                типа — тип исключается из списка.
              </p>
              <h4>Победа</h4>
              <p>
                Победа достигается физическим взятием короля соперника. Шах и мат
                не проверяются — игра идёт до захвата короля.
              </p>
            </div>
          </details>
        </div>

        <footer className="site-footer">
          <div>
            По вопросам и предложениям — пишите в Telegram:{' '}
            <a href="https://t.me/AlexFimin" target="_blank" rel="noreferrer">@AlexFimin</a>
          </div>
          <div>
            Исходный код:{' '}
            <a href="https://github.com/AlexFimin/chess-undercover" target="_blank" rel="noreferrer">
              github.com/AlexFimin/chess-undercover
            </a>
          </div>
          <div className="muted">Распространяется по лицензии MIT · © 2026 Фимин Александр</div>
        </footer>
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
