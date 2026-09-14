import { useState, useMemo } from 'react';
import type { Piece, Color, Position, Board as BoardType, PieceType, Move } from '../types';
import { ALL_PIECE_TYPES, PIECE_SYMBOLS } from '../types';
import { getValidMoves, filterPossibleTypes, applyCountDeduction } from '../game/moves';
import { movePiece as doMove, cloneBoard } from '../game/board';
import { Board } from './Board';
import { DeductionPanel } from './DeductionPanel';

interface GameViewProps {
  whitePieces: Piece[];
  blackPieces: Piece[];
  onGameEnd: (winner: Color) => void;
}

interface GameState {
  board: BoardType;
  currentPlayer: Color;
  history: Move[];
  possibleTypes: Map<string, Set<PieceType>>;
  pieceNumbers: Map<string, number>;
  capturedPieceIds: Set<string>;
  lastMove: { from: Position; to: Position } | null;
  winner: Color | null;
}

function assignPieceNumbers(pieces: Piece[]): Map<string, number> {
  const owner = pieces[0]?.owner;
  if (!owner) return new Map();
  const backRank = owner === 'white' ? 1 : 8;

  const sorted = [...pieces].sort((a, b) => {
    const rankA = parseInt(a.position[1], 10);
    const rankB = parseInt(b.position[1], 10);
    const aIsBack = rankA === backRank ? 0 : 1;
    const bIsBack = rankB === backRank ? 0 : 1;
    if (aIsBack !== bIsBack) return aIsBack - bIsBack;
    return a.position.charCodeAt(0) - b.position.charCodeAt(0);
  });

  const numbers = new Map<string, number>();
  sorted.forEach((p, i) => numbers.set(p.id, i + 1));
  return numbers;
}

function initGame(whitePieces: Piece[], blackPieces: Piece[]): GameState {
  const board: BoardType = new Map();
  for (const p of whitePieces) board.set(p.position, { ...p });
  for (const p of blackPieces) board.set(p.position, { ...p });

  const possibleTypes = new Map<string, Set<PieceType>>();
  for (const p of board.values()) {
    possibleTypes.set(p.id, new Set(ALL_PIECE_TYPES));
  }

  const pieceNumbers = new Map<string, number>();
  for (const [id, num] of assignPieceNumbers(whitePieces)) pieceNumbers.set(id, num);
  for (const [id, num] of assignPieceNumbers(blackPieces)) pieceNumbers.set(id, num);

  return {
    board,
    currentPlayer: 'white',
    history: [],
    possibleTypes,
    pieceNumbers,
    capturedPieceIds: new Set(),
    lastMove: null,
    winner: null,
  };
}

export function GameView({ whitePieces, blackPieces, onGameEnd }: GameViewProps) {
  const [state, setState] = useState<GameState>(() => initGame(whitePieces, blackPieces));
  const [selected, setSelected] = useState<Position | null>(null);
  const [showHandoff, setShowHandoff] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{
    piece: Piece;
    to: Position;
  } | null>(null);
  const [selectedDeductionId, setSelectedDeductionId] = useState<string | null>(null);

  const opponent: Color = state.currentPlayer === 'white' ? 'black' : 'white';
  const opponentPieces = state.currentPlayer === 'white' ? blackPieces : whitePieces;

  const validMoves = useMemo(() => {
    if (!selected) return [];
    const piece = state.board.get(selected);
    if (!piece || piece.owner !== state.currentPlayer) return [];
    return getValidMoves(piece, state.board);
  }, [selected, state.board, state.currentPlayer]);

  function handleSquareClick(pos: Position) {
    if (state.winner || pendingPromotion || showHandoff) return;

    // First: check if this is a valid move target (including captures)
    if (selected && validMoves.includes(pos)) {
      const movingPiece = state.board.get(selected);
      if (!movingPiece) return;

      const promoRank = movingPiece.owner === 'white' ? 8 : 1;
      if (movingPiece.type === 'pawn' && parseInt(pos[1], 10) === promoRank) {
        setPendingPromotion({ piece: movingPiece, to: pos });
        return;
      }

      makeMove(selected, pos);
      return;
    }

    const piece = state.board.get(pos);

    // Clicking own piece: select it
    if (piece && piece.owner === state.currentPlayer) {
      setSelected(pos);
      return;
    }

    // Otherwise: deselect
    setSelected(null);
  }

  function handleRightClick(pos: Position) {
    if (state.winner || pendingPromotion || showHandoff) return;
    const piece = state.board.get(pos);
    if (piece && piece.owner !== state.currentPlayer) {
      setSelectedDeductionId(piece.id);
    }
  }

  function makeMove(from: Position, to: Position, promotedTo?: PieceType) {
    const newBoard = cloneBoard(state.board);
    const movingPiece = newBoard.get(from);
    if (!movingPiece) return;

    const targetPiece = newBoard.get(to);
    const isCapture = !!targetPiece;
    const hadMoved = movingPiece.hasMoved;
    const pieceTypeBefore = movingPiece.type;

    doMove(newBoard, from, to);

    if (promotedTo) {
      movingPiece.type = promotedTo;
    }

    const newPossibleTypes = new Map(state.possibleTypes);

    const movedPieceTypes = newPossibleTypes.get(movingPiece.id);
    if (movedPieceTypes) {
      const filtered = filterPossibleTypes(
        [...movedPieceTypes],
        from,
        to,
        movingPiece.owner,
        isCapture,
        hadMoved,
      );
      newPossibleTypes.set(movingPiece.id, new Set(filtered));
    }

    if (targetPiece) {
      newPossibleTypes.set(targetPiece.id, new Set([targetPiece.type]));
    }

    if (promotedTo) {
      newPossibleTypes.set(movingPiece.id, new Set([promotedTo]));
    }

    const newCapturedIds = new Set(state.capturedPieceIds);
    if (targetPiece) {
      newCapturedIds.add(targetPiece.id);
    }

    const allOpponentPieces = movingPiece.owner === 'white' ? blackPieces : whitePieces;
    const deducedTypes = applyCountDeduction(
      newPossibleTypes,
      allOpponentPieces,
      newCapturedIds,
      [...state.history, {
        from,
        to,
        pieceId: movingPiece.id,
        capturedPieceId: targetPiece?.id,
        pieceType: pieceTypeBefore,
        promotedTo,
        turn: state.history.length,
      }],
      movingPiece.owner === 'white' ? 'black' : 'white',
    );

    let winner: Color | null = null;
    if (targetPiece && targetPiece.type === 'king') {
      winner = state.currentPlayer;
    }

    const move: Move = {
      from,
      to,
      pieceId: movingPiece.id,
      capturedPieceId: targetPiece?.id,
      pieceType: pieceTypeBefore,
      promotedTo,
      turn: state.history.length,
    };

    const nextPlayer: Color = winner ? state.currentPlayer : opponent;

    const nextState: GameState = {
      board: newBoard,
      currentPlayer: nextPlayer,
      history: [...state.history, move],
      possibleTypes: deducedTypes,
      pieceNumbers: state.pieceNumbers,
      capturedPieceIds: newCapturedIds,
      lastMove: { from, to },
      winner,
    };

    setState(nextState);
    setSelected(null);
    setSelectedDeductionId(null);
    setPendingPromotion(null);

    if (winner) {
      onGameEnd(winner);
    } else {
      setShowHandoff(true);
    }
  }

  function handlePromotion(type: PieceType) {
    if (!pendingPromotion) return;
    makeMove(pendingPromotion.piece.position, pendingPromotion.to, type);
  }

  const perspective = state.currentPlayer;

  if (state.winner) {
    return (
      <div className="game-over">
        <h2>Победа: {state.winner === 'white' ? 'Белые' : 'Чёрные'}!</h2>
        <p>Король взят</p>
        <button onClick={() => window.location.reload()}>Новая партия</button>
      </div>
    );
  }

  if (showHandoff) {
    return (
      <div className="handoff-screen">
        <h2>Передайте устройство</h2>
        <p>{state.currentPlayer === 'white' ? 'Белым' : 'Чёрным'} ходить</p>
        <button onClick={() => setShowHandoff(false)}>Я готов</button>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>Ход: {state.currentPlayer === 'white' ? 'Белые' : 'Чёрные'}</h2>
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
          opponentColor={opponent}
          pieceNumbers={state.pieceNumbers}
          possibleTypes={state.possibleTypes}
          capturedPieceIds={state.capturedPieceIds}
          board={state.board}
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
                <span className={`piece ${pendingPromotion.piece.owner}`}>
                  {PIECE_SYMBOLS[pendingPromotion.piece.owner][type]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
