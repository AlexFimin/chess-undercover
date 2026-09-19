import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  Piece, PublicPiece, Color, Position, Board as BoardType, PieceType,
  GameStartedMsg, MoveResultMsg, WireMove,
} from '../types';
import { ALL_PIECE_TYPES, PIECE_SYMBOLS } from '../types';
import { getValidMoves, filterPossibleTypes, applyCountDeduction } from '../game/moves';
import { cloneBoard, movePiece as doMove, allPieces } from '../game/board';
import { Board } from './Board';
import { DeductionPanel } from './DeductionPanel';

// Данные для восстановления партии после реконнекта
export interface RestoreData {
  myPieces: Piece[];
  opponentPieces: PublicPiece[];
  pieceNumbers: Record<string, number>;
  currentPlayer: Color;
  winner: Color | null;
  history: WireMove[];
  capturedPieceIds: string[];
  pendingPromotion: { pieceId: string; from: Position; to: Position } | null;
  opponentGraceUntil: number | null;
}

interface GameViewProps {
  gameData: GameStartedMsg;
  restore: RestoreData | null;
  socket: Socket;
  onGameEnd: () => void;
}

interface GameState {
  board: BoardType;
  currentPlayer: Color;
  history: WireMove[];
  possibleTypes: Map<string, Set<PieceType>>;
  pieceNumbers: Map<string, number>;
  capturedPieceIds: Set<string>;
  allOpponentPieceIds: string[];
  lastMove: { from: Position; to: Position } | null;
  winner: Color | null;
}

function buildBoard(myPieces: Piece[], opponentPieces: PublicPiece[]): BoardType {
  const board: BoardType = new Map();
  for (const p of myPieces) board.set(p.position, { ...p });
  for (const p of opponentPieces) board.set(p.position, { ...p, type: null as any });
  return board;
}

function initPossibleTypes(board: BoardType, myColor: Color): Map<string, Set<PieceType>> {
  const possibleTypes = new Map<string, Set<PieceType>>();
  for (const p of board.values()) {
    possibleTypes.set(
      p.id,
      p.owner === myColor ? new Set([p.type]) : new Set(ALL_PIECE_TYPES),
    );
  }
  return possibleTypes;
}

// Обновление доски ходом (позиции + превращение)
function applyBoardMove(board: BoardType, wireMove: WireMove): BoardType {
  const newBoard = cloneBoard(board);
  if (!newBoard.get(wireMove.from)) return board;
  doMove(newBoard, wireMove.from, wireMove.to);
  const movedPiece = newBoard.get(wireMove.to);
  if (movedPiece && wireMove.promotedTo) {
    movedPiece.type = wireMove.promotedTo;
  }
  return newBoard;
}

// Обновление дедукции ходом: геометрия, вскрытие взятий, подсчёт по количеству
function applyDeductionMove(
  possibleTypes: Map<string, Set<PieceType>>,
  capturedIds: Set<string>,
  history: WireMove[],
  wireMove: WireMove,
  board: BoardType,
  allOpponentPieceIds: string[],
  opponentColor: Color,
): {
  possibleTypes: Map<string, Set<PieceType>>;
  capturedIds: Set<string>;
  history: WireMove[];
} {
  const newPossibleTypes = new Map(possibleTypes);

  const moverTypes = newPossibleTypes.get(wireMove.pieceId);
  if (moverTypes && moverTypes.size > 1) {
    const filtered = filterPossibleTypes(
      [...moverTypes],
      wireMove.from,
      wireMove.to,
      wireMove.owner,
      wireMove.isCapture,
      wireMove.hadMoved,
    );
    if (filtered.length > 0) {
      newPossibleTypes.set(wireMove.pieceId, new Set(filtered));
    }
  }

  if (wireMove.capturedPieceId && wireMove.capturedPieceType) {
    newPossibleTypes.set(wireMove.capturedPieceId, new Set([wireMove.capturedPieceType]));
  }

  if (wireMove.promotedTo) {
    newPossibleTypes.set(wireMove.pieceId, new Set([wireMove.promotedTo]));
  }

  const newCapturedIds = new Set(capturedIds);
  if (wireMove.capturedPieceId) {
    newCapturedIds.add(wireMove.capturedPieceId);
  }

  const newHistory = [...history, wireMove];

  // Полный список фигур соперника (на доске + взятые) для подсчёта
  const onBoardPieces = allPieces(board, opponentColor);
  const onBoardIds = new Set(onBoardPieces.map((p) => p.id));
  const allOpponentPieces: Piece[] = [...onBoardPieces];
  for (const id of allOpponentPieceIds) {
    if (!onBoardIds.has(id)) {
      allOpponentPieces.push({
        id,
        type: null as any,
        owner: opponentColor,
        position: '',
        hasMoved: false,
      });
    }
  }

  const deduced = applyCountDeduction(
    newPossibleTypes,
    allOpponentPieces,
    newCapturedIds,
    newHistory,
    opponentColor,
  );

  return { possibleTypes: deduced, capturedIds: newCapturedIds, history: newHistory };
}

function initGame(gameData: GameStartedMsg): GameState {
  const board = buildBoard(gameData.myPieces, gameData.opponentPieces);
  return {
    board,
    currentPlayer: 'white',
    history: [],
    possibleTypes: initPossibleTypes(board, gameData.myColor),
    pieceNumbers: new Map(Object.entries(gameData.pieceNumbers)),
    capturedPieceIds: new Set(),
    allOpponentPieceIds: gameData.opponentPieces.map((p) => p.id),
    lastMove: null,
    winner: null,
  };
}

// Восстановление: доска берётся снапшотом (уже актуальна),
// а дедукция пересчитывается реплеем истории ходов
function initFromRestore(restore: RestoreData, myColor: Color, opponentColor: Color): GameState {
  const board = buildBoard(restore.myPieces, restore.opponentPieces);
  const allOpponentPieceIds = restore.opponentPieces.map((p) => p.id);

  let possibleTypes = initPossibleTypes(board, myColor);
  let capturedIds = new Set<string>();
  let history: WireMove[] = [];

  for (const wireMove of restore.history) {
    const result = applyDeductionMove(
      possibleTypes,
      capturedIds,
      history,
      wireMove,
      board,
      allOpponentPieceIds,
      opponentColor,
    );
    possibleTypes = result.possibleTypes;
    capturedIds = result.capturedIds;
    history = result.history;
  }

  const last = history.length > 0 ? history[history.length - 1] : null;

  return {
    board,
    currentPlayer: restore.currentPlayer,
    history,
    possibleTypes,
    pieceNumbers: new Map(Object.entries(restore.pieceNumbers)),
    capturedPieceIds: capturedIds,
    allOpponentPieceIds,
    lastMove: last ? { from: last.from, to: last.to } : null,
    winner: restore.winner,
  };
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function GameView({ gameData, restore, socket, onGameEnd }: GameViewProps) {
  const myColor = gameData.myColor;
  const opponentColor: Color = myColor === 'white' ? 'black' : 'white';

  const [state, setState] = useState<GameState>(() =>
    restore
      ? initFromRestore(restore, myColor, opponentColor)
      : initGame(gameData),
  );
  const [selected, setSelected] = useState<Position | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    pieceId: string;
    from: Position;
    to: Position;
  } | null>(() => restore?.pendingPromotion ?? null);
  const [selectedDeductionId, setSelectedDeductionId] = useState<string | null>(null);
  // Метка времени (epoch ms), до которой ждём возвращения соперника; null = он онлайн
  const [opponentOffline, setOpponentOffline] = useState<number | null>(
    () => restore?.opponentGraceUntil ?? null,
  );
  // Текущее время для обратного отсчёта; 0 = отсчёт ещё не запущен
  const [tick, setTick] = useState(0);

  const isMyTurn = state.currentPlayer === myColor && !state.winner;
  const opponentOfflineActive = opponentOffline !== null;

  useEffect(() => {
    if (!opponentOfflineActive) return;
    const iv = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [opponentOfflineActive]);

  // Полный список фигур соперника (на доске + взятые) для панели дедукции
  const opponentPieces = useMemo(() => {
    const onBoard = allPieces(state.board, opponentColor);
    const onBoardIds = new Set(onBoard.map((p) => p.id));
    const all: Piece[] = [...onBoard];
    for (const id of state.allOpponentPieceIds) {
      if (!onBoardIds.has(id)) {
        all.push({ id, type: null as any, owner: opponentColor, position: '', hasMoved: false });
      }
    }
    return all;
  }, [state.board, state.allOpponentPieceIds, opponentColor]);

  const validMoves = useMemo(() => {
    if (!selected || !isMyTurn) return [];
    const piece = state.board.get(selected);
    if (!piece || piece.owner !== myColor) return [];
    return getValidMoves(piece, state.board);
  }, [selected, state.board, isMyTurn, myColor]);

  // === Обработка результата хода с сервера ===
  const handleMoveResult = useCallback((data: MoveResultMsg) => {
    const wireMove = data.move;

    setState((prev) => {
      const newBoard = applyBoardMove(prev.board, wireMove);
      const deduction = applyDeductionMove(
        prev.possibleTypes,
        prev.capturedPieceIds,
        prev.history,
        wireMove,
        newBoard,
        prev.allOpponentPieceIds,
        opponentColor,
      );
      return {
        board: newBoard,
        currentPlayer: data.currentPlayer,
        history: deduction.history,
        possibleTypes: deduction.possibleTypes,
        pieceNumbers: prev.pieceNumbers,
        capturedPieceIds: deduction.capturedIds,
        allOpponentPieceIds: prev.allOpponentPieceIds,
        lastMove: { from: wireMove.from, to: wireMove.to },
        winner: data.winner,
      };
    });

    setSelected(null);
    setSelectedDeductionId(null);
    setPendingPromotion(null);
  }, [opponentColor]);

  const handlePromotionRequest = useCallback(
    (data: { pieceId: string; from: Position; to: Position }) => {
      setPendingPromotion(data);
    },
    [],
  );

  const handleOpponentDisconnected = useCallback((data: { graceUntil: number }) => {
    setOpponentOffline(data.graceUntil);
  }, []);

  const handleOpponentReconnected = useCallback(() => {
    setOpponentOffline(null);
  }, []);

  useEffect(() => {
    socket.on('move_result', handleMoveResult);
    socket.on('promotion_request', handlePromotionRequest);
    socket.on('opponent_disconnected', handleOpponentDisconnected);
    socket.on('opponent_reconnected', handleOpponentReconnected);

    return () => {
      socket.off('move_result', handleMoveResult);
      socket.off('promotion_request', handlePromotionRequest);
      socket.off('opponent_disconnected', handleOpponentDisconnected);
      socket.off('opponent_reconnected', handleOpponentReconnected);
    };
  }, [socket, handleMoveResult, handlePromotionRequest, handleOpponentDisconnected, handleOpponentReconnected]);

  // === Обработка кликов ===
  function handleSquareClick(pos: Position) {
    if (state.winner || pendingPromotion || !isMyTurn) return;

    if (selected && validMoves.includes(pos)) {
      socket.emit('make_move', { from: selected, to: pos });
      setSelected(null);
      return;
    }

    const piece = state.board.get(pos);
    if (piece && piece.owner === myColor) {
      setSelected(pos);
      return;
    }
    setSelected(null);
  }

  function handleRightClick(pos: Position) {
    if (state.winner || pendingPromotion) return;
    const piece = state.board.get(pos);
    if (piece && piece.owner !== myColor) {
      setSelectedDeductionId(piece.id);
    }
  }

  function handlePromotion(type: PieceType) {
    if (!pendingPromotion) return;
    socket.emit('choose_promotion', { promotedTo: type });
    setPendingPromotion(null);
  }

  const perspective = myColor;
  const remaining: number | null =
    opponentOffline !== null && tick > 0 ? Math.max(0, opponentOffline - tick) : null;

  if (state.winner) {
    const won = state.winner === myColor;
    return (
      <div className="game-over">
        <h2>{won ? 'Победа!' : 'Поражение'}</h2>
        <p>{won ? 'Вы взяли короля соперника' : 'Ваш король взят'}</p>
        <button onClick={onGameEnd}>В меню</button>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>{isMyTurn ? 'Ваш ход' : 'Ход соперника'}</h2>
        <div className="history-count">Ходов: {state.history.length}</div>
      </div>

      {opponentOffline !== null && (
        <div className="opponent-banner">
          Соперник отключился. Ожидание восстановления:{' '}
          <span className="timer">{remaining === null ? '…' : formatRemaining(remaining)}</span>
          {remaining === 0 && <span> — время истекло, завершаем игру…</span>}
        </div>
      )}

      <div className="game-layout">
        <Board
          board={state.board}
          perspective={perspective}
          selected={selected}
          validMoves={validMoves}
          possibleTypes={state.possibleTypes}
          pieceNumbers={state.pieceNumbers}
          selectedDeductionId={selectedDeductionId}
          onSquareClick={handleSquareClick}
          onRightClick={handleRightClick}
          lastMove={state.lastMove}
        />

        <DeductionPanel
          opponentPieces={opponentPieces}
          opponentColor={opponentColor}
          pieceNumbers={state.pieceNumbers}
          possibleTypes={state.possibleTypes}
          capturedPieceIds={state.capturedPieceIds}
          history={state.history}
          selectedPieceId={selectedDeductionId}
          onSelectPiece={(id) => setSelectedDeductionId(id)}
        />
      </div>

      {pendingPromotion && (
        <div className="promotion-dialog">
          <h3>Превращение пешки</h3>
          <div className="promotion-options">
            {(['queen', 'rook', 'bishop', 'knight'] as PieceType[]).map((type) => (
              <button key={type} onClick={() => handlePromotion(type)}>
                <span className={`piece ${myColor}`}>
                  {PIECE_SYMBOLS[myColor][type]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
