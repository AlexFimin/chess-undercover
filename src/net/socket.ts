import { io, type Socket } from 'socket.io-client';
import type { Color, Piece, PieceType, Position } from '../types';
import type { GameStartedMsg, MoveResultMsg, WireMove } from '../types';

type Listener = (...args: any[]) => void;

export interface ClientSocket {
  connect(): void;
  disconnect(): void;
  emit(event: string, data?: any): void;
  on(event: string, fn: Listener): void;
  off(event: string, fn: Listener): void;
}

export function createSocket(): Socket {
  return io();
}

// === Typed event helpers ===

export interface ServerEvents {
  room_created: (data: { code: string; color: Color }) => void;
  room_joined: (data: { code: string; color: Color }) => void;
  waiting_for_opponent: () => void;
  opponent_joined: () => void;
  game_started: (data: GameStartedMsg) => void;
  move_result: (data: MoveResultMsg) => void;
  promotion_request: (data: { pieceId: string; from: Position; to: Position }) => void;
  opponent_left: () => void;
  error: (data: { message: string }) => void;
}

export interface ClientEvents {
  create_room: () => void;
  join_room: (data: { code: string }) => void;
  submit_setup: (data: { pieces: Piece[] }) => void;
  make_move: (data: { from: Position; to: Position }) => void;
  choose_promotion: (data: { promotedTo: PieceType }) => void;
  leave_room: () => void;
}

export type { WireMove };
