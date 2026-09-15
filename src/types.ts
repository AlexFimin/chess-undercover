export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type Color = 'white' | 'black';
export type Position = string; // 'a1', 'e4', etc.

export interface Piece {
  id: string;
  type: PieceType;
  owner: Color;
  position: Position;
  hasMoved: boolean;
}

export type Board = Map<Position, Piece>;

export type GamePhase = 'setup' | 'playing' | 'finished';

export interface Move {
  from: Position;
  to: Position;
  pieceId: string;
  capturedPieceId?: string;
  pieceType: PieceType; // тип на момент хода (до превращения)
  promotedTo?: PieceType;
  turn: number;
}

export const ALL_PIECE_TYPES: PieceType[] = [
  'king',
  'queen',
  'rook',
  'bishop',
  'knight',
  'pawn',
];

export const PIECE_SYMBOLS: Record<Color, Record<PieceType, string>> = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
};

export const GENERIC_SYMBOL = '?';

export const STANDARD_PIECES: PieceType[] = [
  'rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook',
  'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn',
];

// === Wire protocol types ===

export interface PublicPiece {
  id: string;
  type: PieceType | null;
  owner: Color;
  position: Position;
  hasMoved: boolean;
}

export interface WireMove {
  from: Position;
  to: Position;
  pieceId: string;
  owner: Color;
  isCapture: boolean;
  hadMoved: boolean;
  capturedPieceId?: string;
  capturedPieceType?: PieceType;
  promotedTo?: PieceType;
}

export interface GameStartedMsg {
  myPieces: Piece[];
  opponentPieces: PublicPiece[];
  pieceNumbers: Record<string, number>;
  myColor: Color;
}

export interface MoveResultMsg {
  move: WireMove;
  currentPlayer: Color;
  winner: Color | null;
}
