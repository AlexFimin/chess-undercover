import type { Board as BoardType, Color, Position, PieceType } from '../types';
import { PIECE_SYMBOLS } from '../types';
import { allPositions, FILES } from '../game/board';

interface BoardProps {
  board: BoardType;
  perspective: Color;
  selected: Position | null;
  validMoves: Position[];
  possibleTypes: Map<string, Set<PieceType>>;
  pieceNumbers: Map<string, number>;
  selectedDeductionId: string | null;
  onSquareClick: (pos: Position) => void;
  onRightClick: (pos: Position) => void;
  lastMove?: { from: Position; to: Position } | null;
}

export function Board({
  board,
  perspective,
  selected,
  validMoves,
  possibleTypes,
  pieceNumbers,
  selectedDeductionId,
  onSquareClick,
  onRightClick,
  lastMove,
}: BoardProps) {
  const positions = allPositions();
  const validSet = new Set(validMoves);

  const ordered = perspective === 'white' ? positions : [...positions].reverse();

  const ranks = perspective === 'white'
    ? [8, 7, 6, 5, 4, 3, 2, 1]
    : [1, 2, 3, 4, 5, 6, 7, 8];

  const files = perspective === 'white'
    ? [...FILES]
    : [...FILES].reverse();

  return (
    <div className="board-with-labels">
      <div className="rank-labels">
        {ranks.map((r) => (
          <span key={r} className="rank-label">{r}</span>
        ))}
      </div>
      <div className="board">
        {ordered.map((pos) => {
          const piece = board.get(pos);
          const isSelected = selected === pos;
          const isValidMove = validSet.has(pos);
          const isLastMove =
            lastMove && (lastMove.from === pos || lastMove.to === pos);
          const isDeductionSelected = piece && selectedDeductionId === piece.id;

          const file = pos[0];
          const rank = parseInt(pos[1], 10);
          const isLight = (file.charCodeAt(0) - 97 + rank) % 2 === 1;

          let content: React.ReactNode = null;

          if (piece) {
            const isOwn = piece.owner === perspective;
            if (isOwn) {
              content = <span className={`piece own ${piece.owner}`}>{PIECE_SYMBOLS[piece.owner][piece.type]}</span>;
            } else {
              const types = possibleTypes.get(piece.id);
              const isRevealed = types && types.size === 1;
              const num = pieceNumbers.get(piece.id) ?? '?';

              if (isRevealed) {
                const revealedType = [...types!][0] as keyof typeof PIECE_SYMBOLS[Color];
                content = (
                  <span className={`piece-wrapper revealed ${piece.owner}`}>
                    <span className="piece">{PIECE_SYMBOLS[piece.owner][revealedType]}</span>
                    <span className="piece-badge">{num}</span>
                  </span>
                );
              } else {
                content = (
                  <span className={`piece-number ${piece.owner}`}>
                    {num}
                  </span>
                );
              }
            }
          }

          return (
            <div
              key={pos}
              className={`square ${isLight ? 'light' : 'dark'} ${isSelected ? 'selected' : ''} ${isValidMove ? 'valid-move' : ''} ${isLastMove ? 'last-move' : ''} ${isDeductionSelected ? 'deduction-selected' : ''}`}
              onClick={() => onSquareClick(pos)}
              onContextMenu={(e) => {
                e.preventDefault();
                onRightClick(pos);
              }}
              title={pos}
            >
              {content}
              {isValidMove && !piece && <span className="dot" />}
            </div>
          );
        })}
      </div>
      <div className="file-labels">
        {files.map((f) => (
          <span key={f} className="file-label">{f}</span>
        ))}
      </div>
    </div>
  );
}
