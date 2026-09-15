import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { Piece, Color, Position, Board as BoardType, PieceType, GameStartedMsg, MoveResultMsg, WireMove } from '../types';
import { ALL_PIECE_TYPES, PIECE_SYMBOLS } from '../types';
import { getValidMoves, filterPossibleTypes, applyCountDeduction } from '../game/moves';
import { cloneBoard, movePiece as doMove, allPieces } from '../game/board';
import { Board } from './Board';
import { DeductionPanel } from './DeductionPanel';

interface GameViewProps {
  gameData: GameStartedMsg;
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

function initGame(gameData: GameStartedMsg): GameState {
  const board: BoardType = new Map();
  for (const p of gameData.myPieces) board.set(p.position, { ...p });
  for (const p of gameData.opponentPieces) board.set(p.position, { ...p, type: null as any });

  const possibleTypes = new Map<string, Set<PieceType>>();
  for (const p of board.values()) {
    if (p.owner === gameData.myColor) {
      possibleTypes.set(p.id, new Set([p.type]));
    } else {
      possibleTypes.set(p.id, new Set(ALL_PIECE_TYPES));
    }
  }

  const pieceNumbers = new Map<string, number>();
  for (const [id, num] of Object.entries(gameData.pieceNumbers)) {
    pieceNumbers.set(id, num);
  }

  return {
    board,
    currentPlayer: 'white',
    history: [],
    possibleTypes,
    pieceNumbers,
    capturedPieceIds: new Set(),
    allOpponentPieceIds: gameData.opponentPieces.map((p) => p.id),
    lastMove: null,
    winner: null,
  };
}

export function GameView({ gameData, socket, onGameEnd }: GameViewProps) {
  const [state, setState] = useState<GameState>(() => initGame(gameData));
  const [selected, setSelected] = useState<Position | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ pieceId: string; from: Position; to: Position } | null>(null);
  const [selectedDeductionId, setSelectedDeductionId] = useState<string | null>(null);

  const myColor = gameData.myColor;
  const opponentColor: Color = myColor === 'white' ? 'black' : 'white';

  const isMyTurn = state.currentPlayer === myColor && !state.winner;

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

  // === Handle move_result from server ===
  const handleMoveResult = useCallback((data: MoveResultMsg) => {
    const wireMove: WireMove = data.move;

    setState((prev) => {
      const newBoard = cloneBoard(prev.board);
      const movingPiece = newBoard.get(wireMove.from);
      if (!movingPiece) return prev;

      doMove(newBoard, wireMove.from, wireMove.to);

      const movedPiece = newBoard.get(wireMove.to);
      if (movedPiece && wireMove.promotedTo) {
        movedPiece.type = wireMove.promotedTo;
      }

      // If our piece was captured, we learn its real type (but we already know our own types)
      // If opponent piece was captured, we learn its real type
      const newPossibleTypes = new Map(prev.possibleTypes);

      // Filter possible types for the moving piece (deduction by geometry)
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

      // Reveal captured piece's real type
      if (wireMove.capturedPieceId && wireMove.capturedPieceType) {
        newPossibleTypes.set(wireMove.capturedPieceId, new Set([wireMove.capturedPieceType]));
      }

      // Reveal promoted type
      if (wireMove.promotedTo) {
        newPossibleTypes.set(wireMove.pieceId, new Set([wireMove.promotedTo]));
      }

      const newCapturedIds = new Set(prev.capturedPieceIds);
      if (wireMove.capturedPieceId) {
        newCapturedIds.add(wireMove.capturedPieceId);
      }

      // Run count-based deduction on opponent pieces (on-board + captured)
      const onBoardPieces = allPieces(newBoard, opponentColor);
      const onBoardIds = new Set(onBoardPieces.map((p) => p.id));
      const allOpponentPieces: Piece[] = [...onBoardPieces];
      for (const id of prev.allOpponentPieceIds) {
        if (!onBoardIds.has(id)) {
          allOpponentPieces.push({ id, type: null as any, owner: opponentColor, position: '', hasMoved: false });
        }
      }
      const newHistory = [...prev.history, wireMove];
      const deducedTypes = applyCountDeduction(
        newPossibleTypes,
        allOpponentPieces,
        newCapturedIds,
        newHistory as any,
        opponentColor,
      );

      return {
        board: newBoard,
        currentPlayer: data.currentPlayer,
        history: newHistory,
        possibleTypes: deducedTypes,
        pieceNumbers: prev.pieceNumbers,
        capturedPieceIds: newCapturedIds,
        allOpponentPieceIds: prev.allOpponentPieceIds,
        lastMove: { from: wireMove.from, to: wireMove.to },
        winner: data.winner,
      };
    });

    setSelected(null);
    setSelectedDeductionId(null);
    setPendingPromotion(null);
  }, [opponentColor]);

  // === Handle promotion request from server ===
  const handlePromotionRequest = useCallback((data: { pieceId: string; from: Position; to: Position }) => {
    setPendingPromotion(data);
  }, []);

  useEffect(() => {
    socket.on('move_result', handleMoveResult);
    socket.on('promotion_request', handlePromotionRequest);

    return () => {
      socket.off('move_result', handleMoveResult);
      socket.off('promotion_request', handlePromotionRequest);
    };
  }, [socket, handleMoveResult, handlePromotionRequest]);

  // === Square click handler ===
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
          history={state.history as any}
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
