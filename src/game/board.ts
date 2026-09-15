import type { Board, Piece, Position, Color } from '../types';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

export function fileOf(pos: Position): string {
  return pos[0];
}

export function rankOf(pos: Position): number {
  return parseInt(pos[1], 10);
}

export function makePos(file: string, rank: number): Position {
  return `${file}${rank}`;
}

export function inBounds(pos: Position): boolean {
  const f = pos[0];
  const r = rankOf(pos);
  return FILES.includes(f as (typeof FILES)[number]) && r >= 1 && r <= 8;
}

export function shift(pos: Position, df: number, dr: number): Position {
  const f = String.fromCharCode(pos.charCodeAt(0) + df);
  const r = rankOf(pos) + dr;
  return makePos(f, r);
}

export function tryShift(pos: Position, df: number, dr: number): Position | null {
  const np = shift(pos, df, dr);
  return inBounds(np) ? np : null;
}

export function createEmptyBoard(): Board {
  return new Map();
}

export function getPiece(board: Board, pos: Position): Piece | undefined {
  return board.get(pos);
}

export function setPiece(board: Board, pos: Position, piece: Piece | undefined): void {
  if (piece) {
    board.set(pos, piece);
  } else {
    board.delete(pos);
  }
}

export function cloneBoard(board: Board): Board {
  const cloned = new Map<string, Piece>();
  for (const [pos, piece] of board) {
    cloned.set(pos, { ...piece });
  }
  return cloned;
}

export function movePiece(
  board: Board,
  from: Position,
  to: Position,
): { captured?: Piece; piece: Piece } {
  const piece = board.get(from);
  if (!piece) throw new Error(`No piece at ${from}`);
  const captured = board.get(to);
  board.delete(from);
  piece.position = to;
  piece.hasMoved = true;
  board.set(to, piece);
  return { captured, piece };
}

export function allPieces(board: Board, owner?: Color): Piece[] {
  const pieces: Piece[] = [];
  for (const piece of board.values()) {
    if (!owner || piece.owner === owner) pieces.push(piece);
  }
  return pieces;
}

export function findKing(board: Board, owner: Color): Piece | undefined {
  for (const piece of board.values()) {
    if (piece.owner === owner && piece.type === 'king') return piece;
  }
  return undefined;
}

export function allPositions(): Position[] {
  const positions: Position[] = [];
  for (let r = 8; r >= 1; r--) {
    for (const f of FILES) positions.push(makePos(f, r));
  }
  return positions;
}
