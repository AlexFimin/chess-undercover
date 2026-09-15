import type { Piece, Color, Position, PieceType, Board } from '../src/types';
import { ALL_PIECE_TYPES } from '../src/types';
import { getValidMoves, filterPossibleTypes, applyCountDeduction } from '../src/game/moves';
import { cloneBoard, movePiece, allPieces } from '../src/game/board';
import type { PublicPiece, WireMove } from '../src/types';

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

export interface ServerGameState {
  board: Board;
  currentPlayer: Color;
  turn: number;
  pieceNumbers: Map<string, number>;
  capturedPieceIds: Set<string>;
  winner: Color | null;
  pendingPromotion: { pieceId: string; from: Position; to: Position } | null;
}

export function createGameState(whitePieces: Piece[], blackPieces: Piece[]): ServerGameState {
  const board: Board = new Map();
  for (const p of whitePieces) board.set(p.position, { ...p });
  for (const p of blackPieces) board.set(p.position, { ...p });

  const pieceNumbers = new Map<string, number>();
  for (const [id, num] of assignPieceNumbers(whitePieces)) pieceNumbers.set(id, num);
  for (const [id, num] of assignPieceNumbers(blackPieces)) pieceNumbers.set(id, num);

  return {
    board,
    currentPlayer: 'white',
    turn: 0,
    pieceNumbers,
    capturedPieceIds: new Set(),
    winner: null,
    pendingPromotion: null,
  };
}

export function getPublicPieces(board: Board, owner: Color): PublicPiece[] {
  return allPieces(board, owner).map((p) => ({
    id: p.id,
    type: null,
    owner: p.owner,
    position: p.position,
    hasMoved: p.hasMoved,
  }));
}

export function getMyPieces(board: Board, owner: Color): Piece[] {
  return allPieces(board, owner).map((p) => ({ ...p }));
}

export function validateMove(
  state: ServerGameState,
  from: Position,
  to: Position,
  playerColor: Color,
): { valid: boolean; needsPromotion: boolean; error?: string } {
  if (state.winner) return { valid: false, needsPromotion: false, error: 'Game is over' };
  if (state.pendingPromotion) return { valid: false, needsPromotion: false, error: 'Promotion pending' };
  if (state.currentPlayer !== playerColor) return { valid: false, needsPromotion: false, error: 'Not your turn' };

  const piece = state.board.get(from);
  if (!piece) return { valid: false, needsPromotion: false, error: 'No piece at ' + from };
  if (piece.owner !== playerColor) return { valid: false, needsPromotion: false, error: 'Not your piece' };

  const validMoves = getValidMoves(piece, state.board);
  if (!validMoves.includes(to)) return { valid: false, needsPromotion: false, error: 'Invalid move' };

  const promoRank = piece.owner === 'white' ? 8 : 1;
  if (piece.type === 'pawn' && parseInt(to[1], 10) === promoRank) {
    return { valid: true, needsPromotion: true };
  }

  return { valid: true, needsPromotion: false };
}

export function applyMove(
  state: ServerGameState,
  from: Position,
  to: Position,
  promotedTo?: PieceType,
): WireMove {
  const newBoard = cloneBoard(state.board);
  const movingPiece = newBoard.get(from)!;
  const targetPiece = newBoard.get(to);
  const isCapture = !!targetPiece;
  const hadMoved = movingPiece.hasMoved;

  const { captured } = movePiece(newBoard, from, to);

  if (promotedTo) {
    movingPiece.type = promotedTo;
  }

  state.board = newBoard;
  state.turn++;

  const newCapturedIds = new Set(state.capturedPieceIds);
  if (captured) {
    newCapturedIds.add(captured.id);
  }
  state.capturedPieceIds = newCapturedIds;

  let winner: Color | null = null;
  if (captured && captured.type === 'king') {
    winner = state.currentPlayer;
  }
  state.winner = winner;

  state.currentPlayer = winner ? state.currentPlayer : (state.currentPlayer === 'white' ? 'black' : 'white');
  state.pendingPromotion = null;

  return {
    from,
    to,
    pieceId: movingPiece.id,
    owner: movingPiece.owner,
    isCapture,
    hadMoved,
    capturedPieceId: captured?.id,
    capturedPieceType: captured?.type,
    promotedTo,
  };
}

export function pieceNumbersToRecord(map: Map<string, number>): Record<string, number> {
  const rec: Record<string, number> = {};
  for (const [id, num] of map) rec[id] = num;
  return rec;
}
