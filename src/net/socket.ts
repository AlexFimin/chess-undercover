import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { Color, Piece, PieceType, Position } from '../types';
import type { GameStartedMsg, MoveResultMsg, GameRestoredMsg, WireMove } from '../types';

export function createSocket(): Socket {
  return io();
}

// === Типы событий (документация wire-протокола) ===

export interface ServerEvents {
  room_created: (data: { code: string; color: Color; token: string }) => void;
  room_joined: (data: { code: string; color: Color; token: string }) => void;
  waiting_for_opponent: () => void;
  opponent_joined: () => void;
  game_started: (data: GameStartedMsg) => void;
  reconnect_ok: (data: GameRestoredMsg) => void;
  reconnect_failed: (data: { message: string }) => void;
  move_result: (data: MoveResultMsg) => void;
  promotion_request: (data: { pieceId: string; from: Position; to: Position }) => void;
  opponent_disconnected: (data: { graceUntil: number }) => void;
  opponent_reconnected: () => void;
  opponent_left: () => void;
  error: (data: { message: string }) => void;
}

export interface ClientEvents {
  create_room: () => void;
  join_room: (data: { code: string }) => void;
  reconnect: (data: { code: string; token: string }) => void;
  submit_setup: (data: { pieces: Piece[] }) => void;
  make_move: (data: { from: Position; to: Position }) => void;
  choose_promotion: (data: { promotedTo: PieceType }) => void;
  leave_room: () => void;
}

export type { WireMove };
