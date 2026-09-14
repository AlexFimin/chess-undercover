import { useState } from 'react';
import type { Piece, PieceType, Color, Position, Board as BoardType } from '../types';
import { PIECE_SYMBOLS } from '../types';
import { Board } from './Board';

interface SetupProps {
  color: Color;
  onReady: (pieces: Piece[]) => void;
  title: string;
}

const STARTING_POOL: Record<PieceType, number> = {
  king: 1,
  queen: 1,
  rook: 2,
  bishop: 2,
  knight: 2,
  pawn: 8,
};

const ALL_TYPES: PieceType[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];

export function Setup({ color, onReady, title }: SetupProps) {
  const [board, setBoard] = useState<BoardType>(new Map());
  const [pool, setPool] = useState<Record<PieceType, number>>({ ...STARTING_POOL });
  const [selectedType, setSelectedType] = useState<PieceType | null>(null);
  const [pieceCounter, setPieceCounter] = useState(0);

  const ranks = color === 'white' ? [1, 2] : [7, 8];
  const allowedRanks = new Set(ranks);

  function handleSquareClick(pos: Position) {
    const piece = board.get(pos);

    // If clicking own piece on board, return to pool
    if (piece && piece.owner === color) {
      const newBoard = new Map(board);
      newBoard.delete(pos);
      setBoard(newBoard);
      setPool({ ...pool, [piece.type]: pool[piece.type] + 1 });
      return;
    }

    // Try to place selected piece
    if (selectedType && pool[selectedType] > 0) {
      const rank = parseInt(pos[1], 10);
      if (!allowedRanks.has(rank)) return;

      // King already placed?
      if (selectedType === 'king' && pool.king === 0) return;

      const newPiece: Piece = {
        id: `${color}-${pieceCounter}`,
        type: selectedType,
        owner: color,
        position: pos,
        hasMoved: false,
      };

      const newBoard = new Map(board);
      newBoard.set(pos, newPiece);
      setBoard(newBoard);
      setPool({ ...pool, [selectedType]: pool[selectedType] - 1 });
      setPieceCounter(pieceCounter + 1);
      setSelectedType(null);
    }
  }

  function handleReady() {
    const pieces = Array.from(board.values());
    if (pieces.length !== 16) return;
    onReady(pieces);
  }

  const totalPlaced = 16 - Object.values(pool).reduce((a, b) => a + b, 0);
  const allPlaced = totalPlaced === 16;

  return (
    <div className="setup-container">
      <h2>{title}</h2>
      <div className="setup-layout">
        <div className="pool">
          <h3>Фигуры ({totalPlaced}/16)</h3>
          {ALL_TYPES.map((type) => (
            <button
              key={type}
              className={`pool-item ${selectedType === type ? 'selected' : ''} ${pool[type] === 0 ? 'empty' : ''}`}
              onClick={() => pool[type] > 0 && setSelectedType(type)}
              disabled={pool[type] === 0}
            >
              <span className={`piece ${color}`}>{PIECE_SYMBOLS[color][type]}</span>
              <span className="count">{pool[type]}</span>
            </button>
          ))}
          <button
            className="ready-btn"
            onClick={handleReady}
            disabled={!allPlaced}
          >
            {allPlaced ? 'Готов!' : `Осталось: ${16 - totalPlaced}`}
          </button>
        </div>
        <Board
          board={board}
          perspective={color}
          selected={null}
          validMoves={[]}
          possibleTypes={new Map()}
          pieceNumbers={new Map()}
          selectedDeductionId={null}
          onSquareClick={handleSquareClick}
          onRightClick={() => {}}
        />
      </div>
    </div>
  );
}
