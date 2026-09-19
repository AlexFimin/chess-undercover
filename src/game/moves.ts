import type { Board, Piece, Position, PieceType, Color } from '../types';
import { ALL_PIECE_TYPES } from '../types';
import { tryShift, rankOf, getPiece } from './board';

const KNIGHT_OFFSETS: [number, number][] = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];

const KING_OFFSETS: [number, number][] = [
  [0, 1], [1, 1], [1, 0], [1, -1],
  [0, -1], [-1, -1], [-1, 0], [-1, 1],
];

const ROOK_DIRECTIONS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const BISHOP_DIRECTIONS: [number, number][] = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
const QUEEN_DIRECTIONS: [number, number][] = [...ROOK_DIRECTIONS, ...BISHOP_DIRECTIONS];

function pawnDirection(owner: Color): number {
  return owner === 'white' ? 1 : -1;
}

function pawnStartRank(owner: Color): number {
  return owner === 'white' ? 2 : 7;
}

export function getValidMoves(piece: Piece, board: Board): Position[] {
  switch (piece.type) {
    case 'pawn': return pawnMoves(piece, board);
    case 'knight': return knightMoves(piece, board);
    case 'bishop': return slidingMoves(piece, board, BISHOP_DIRECTIONS);
    case 'rook': return slidingMoves(piece, board, ROOK_DIRECTIONS);
    case 'queen': return slidingMoves(piece, board, QUEEN_DIRECTIONS);
    case 'king': return kingMoves(piece, board);
  }
}

function pawnMoves(piece: Piece, board: Board): Position[] {
  const moves: Position[] = [];
  const dir = pawnDirection(piece.owner);
  const startRank = pawnStartRank(piece.owner);
  const canDouble = rankOf(piece.position) === startRank && !piece.hasMoved;

  // Forward 1
  const oneStep = tryShift(piece.position, 0, dir);
  if (oneStep && !getPiece(board, oneStep)) {
    moves.push(oneStep);
    // Forward 2 (only from start rank, if path clear)
    if (canDouble) {
      const twoStep = tryShift(piece.position, 0, dir * 2);
      if (twoStep && !getPiece(board, twoStep)) moves.push(twoStep);
    }
  }

  // Captures (diagonal)
  for (const df of [-1, 1]) {
    const target = tryShift(piece.position, df, dir);
    if (target) {
      const targetPiece = getPiece(board, target);
      if (targetPiece && targetPiece.owner !== piece.owner) moves.push(target);
    }
  }

  return moves;
}

function knightMoves(piece: Piece, board: Board): Position[] {
  const moves: Position[] = [];
  for (const [df, dr] of KNIGHT_OFFSETS) {
    const target = tryShift(piece.position, df, dr);
    if (!target) continue;
    const targetPiece = getPiece(board, target);
    if (!targetPiece || targetPiece.owner !== piece.owner) moves.push(target);
  }
  return moves;
}

function slidingMoves(
  piece: Piece,
  board: Board,
  directions: [number, number][],
): Position[] {
  const moves: Position[] = [];
  for (const [df, dr] of directions) {
    let pos = piece.position;
    while (true) {
      const next = tryShift(pos, df, dr);
      if (!next) break;
      const targetPiece = getPiece(board, next);
      if (!targetPiece) {
        moves.push(next);
      } else {
        if (targetPiece.owner !== piece.owner) moves.push(next);
        break;
      }
      pos = next;
    }
  }
  return moves;
}

function kingMoves(piece: Piece, board: Board): Position[] {
  const moves: Position[] = [];
  for (const [df, dr] of KING_OFFSETS) {
    const target = tryShift(piece.position, df, dr);
    if (!target) continue;
    const targetPiece = getPiece(board, target);
    if (!targetPiece || targetPiece.owner !== piece.owner) moves.push(target);
  }
  return moves;
}

// === Deduction ===

export function canMove(
  type: PieceType,
  from: Position,
  to: Position,
  owner: Color,
  isCapture: boolean,
  hasMoved: boolean,
): boolean {
  switch (type) {
    case 'pawn': return canPawnMove(from, to, owner, isCapture, hasMoved);
    case 'knight': return canKnightMove(from, to);
    case 'bishop': return canSlide(from, to, BISHOP_DIRECTIONS);
    case 'rook': return canSlide(from, to, ROOK_DIRECTIONS);
    case 'queen': return canSlide(from, to, QUEEN_DIRECTIONS);
    case 'king': return canKingMove(from, to);
  }
}

function fileDiff(a: Position, b: Position): number {
  return Math.abs(a.charCodeAt(0) - b.charCodeAt(0));
}

function rankDiff(a: Position, b: Position): number {
  return Math.abs(rankOf(a) - rankOf(b));
}

function canPawnMove(
  from: Position,
  to: Position,
  owner: Color,
  isCapture: boolean,
  hasMoved: boolean,
): boolean {
  const dir = pawnDirection(owner);
  const startRank = pawnStartRank(owner);
  const fd = to.charCodeAt(0) - from.charCodeAt(0);
  const rd = rankOf(to) - rankOf(from);

  if (isCapture) {
    // Diagonal capture
    return Math.abs(fd) === 1 && rd === dir;
  }
  // Forward move (straight)
  if (fd !== 0) return false;
  // One step forward
  if (rd === dir) return true;
  // Two steps from start rank
  if (rd === dir * 2 && rankOf(from) === startRank && !hasMoved) return true;
  return false;
}

function canKnightMove(from: Position, to: Position): boolean {
  const fd = fileDiff(from, to);
  const rd = rankDiff(from, to);
  return (fd === 1 && rd === 2) || (fd === 2 && rd === 1);
}

function canKingMove(from: Position, to: Position): boolean {
  return fileDiff(from, to) <= 1 && rankDiff(from, to) <= 1 && !(from === to);
}

function canSlide(from: Position, to: Position, directions: [number, number][]): boolean {
  const fd = to.charCodeAt(0) - from.charCodeAt(0);
  const rd = rankOf(to) - rankOf(from);
  if (fd === 0 && rd === 0) return false;
  for (const [ddf, ddr] of directions) {
    // Check if (fd, rd) is a positive multiple of (ddf, ddr)
    if (ddf === 0) {
      if (fd !== 0) continue;
      if (Math.sign(rd) !== Math.sign(ddr)) continue;
      return true;
    }
    if (ddr === 0) {
      if (rd !== 0) continue;
      if (Math.sign(fd) !== Math.sign(ddf)) continue;
      return true;
    }
    // Both non-zero (diagonal)
    if (fd === 0 || rd === 0) continue;
    if (Math.sign(fd) !== Math.sign(ddf)) continue;
    if (Math.sign(rd) !== Math.sign(ddr)) continue;
    if (Math.abs(fd) === Math.abs(rd)) return true;
    continue;
  }
  return false;
}

export function filterPossibleTypes(
  possibleTypes: PieceType[],
  from: Position,
  to: Position,
  owner: Color,
  isCapture: boolean,
  hasMoved: boolean,
): PieceType[] {
  return possibleTypes.filter((t) =>
    canMove(t, from, to, owner, isCapture, hasMoved),
  );
}

const BASE_MAX_COUNTS: Record<PieceType, number> = {
  king: 1,
  queen: 1,
  rook: 2,
  bishop: 2,
  knight: 2,
  pawn: 8,
};

export function applyCountDeduction(
  possibleTypes: Map<string, Set<PieceType>>,
  opponentPieces: Piece[],
  capturedPieceIds: Set<string>,
  history: Array<{ pieceId: string; promotedTo?: PieceType }>,
  opponentColor: Color,
): Map<string, Set<PieceType>> {
  const maxCounts: Record<PieceType, number> = { ...BASE_MAX_COUNTS };

  for (const m of history) {
    const piece = opponentPieces.find((p) => p.id === m.pieceId);
    if (!piece || piece.owner !== opponentColor) continue;
    if (m.promotedTo) {
      maxCounts.pawn -= 1;
      maxCounts[m.promotedTo] += 1;
    }
  }

  let result = new Map<string, Set<PieceType>>();
  for (const [id, types] of possibleTypes) {
    result.set(id, new Set(types));
  }

  let iteration = 0;
  while (true) {
    iteration++;

    const confirmedCounts: Record<PieceType, number> = {
      king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0,
    };

    for (const piece of opponentPieces) {
      const isCaptured = capturedPieceIds.has(piece.id);
      const types = result.get(piece.id);
      if (!types) continue;

      if (isCaptured || types.size === 1) {
        const confirmedType = [...types][0];
        confirmedCounts[confirmedType] += 1;
      }
    }

    const exhaustedTypes = new Set<PieceType>();
    for (const t of ALL_PIECE_TYPES) {
      if (confirmedCounts[t] >= maxCounts[t]) {
        exhaustedTypes.add(t);
      }
    }

    if (exhaustedTypes.size === 0) break;

    const opponentIds = new Set(opponentPieces.map((p) => p.id));

    let changed = false;
    for (const [pieceId, types] of result) {
      if (!opponentIds.has(pieceId)) continue;

      const isCaptured = capturedPieceIds.has(pieceId);
      if (isCaptured || types.size === 1) continue;

      const filtered = new Set([...types].filter((t) => !exhaustedTypes.has(t)));
      if (filtered.size < types.size && filtered.size > 0) {
        console.log(
          `[deduction iter ${iteration}] piece ${pieceId}: `,
          `${[...types].join(',')} → ${[...filtered].join(',')}`,
          `(exhausted: ${[...exhaustedTypes].join(',')})`,
        );
        result.set(pieceId, filtered);
        changed = true;
      }
    }

    if (!changed) break;

    if (iteration > 20) {
      console.warn('[deduction] max iterations reached, breaking');
      break;
    }
  }

  console.log(
    `[deduction] maxCounts:`, maxCounts,
    `| completed in ${iteration} iteration(s)`,
  );

  return result;
}
