import { randomUUID } from 'node:crypto';
import type { Color, Piece } from '../src/types';
import type { ServerGameState } from './game';

export interface RoomPlayer {
  // null = РёРіСЂРѕРє РѕС‚РєР»СЋС‡С‘РЅ (grace-РѕРєРЅРѕ) РёР»Рё РїРѕС‚РµСЂСЏРЅ РѕРєРѕРЅС‡Р°С‚РµР»СЊРЅРѕ
  socketId: string | null;
  // РЎРµРєСЂРµС‚РЅС‹Р№ С‚РѕРєРµРЅ РґР»СЏ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ СЃРµСЃСЃРёРё
  token: string;
  color: Color;
  setup: Piece[] | null;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
  // РњРѕРјРµРЅС‚ (epoch ms), РґРѕ РєРѕС‚РѕСЂРѕРіРѕ РґРµР№СЃС‚РІСѓРµС‚ grace-РѕРєРЅРѕ РѕС‚РєР»СЋС‡РµРЅРёСЏ
  graceUntil: number | null;
}

export interface Room {
  code: string;
  players: RoomPlayer[];
  game: ServerGameState | null;
}

const rooms = new Map<string, Room>();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  if (rooms.has(code)) return generateCode();
  return code;
}

export function createRoom(socketId: string): Room {
  const code = generateCode();
  const room: Room = {
    code,
    players: [{
      socketId,
      token: randomUUID(),
      color: 'white',
      setup: null,
      disconnectTimer: null,
      graceUntil: null,
    }],
    game: null,
  };
  rooms.set(code, room);
  return room;
}

export function joinRoom(socketId: string, code: string): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.players.length >= 2) return null;

  room.players.push({
    socketId,
    token: randomUUID(),
    color: 'black',
    setup: null,
    disconnectTimer: null,
    graceUntil: null,
  });
  return room;
}

export function getRoom(code: string): Room | null {
  return rooms.get(code.toUpperCase()) ?? null;
}

export function getRoomBySocket(socketId: string): Room | null {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.socketId === socketId)) return room;
  }
  return null;
}

export function getPlayer(socketId: string): RoomPlayer | null {
  const room = getRoomBySocket(socketId);
  if (!room) return null;
  return room.players.find((p) => p.socketId === socketId) ?? null;
}

export function getOpponent(socketId: string): RoomPlayer | null {
  const room = getRoomBySocket(socketId);
  if (!room || room.players.length < 2) return null;
  return room.players.find((p) => p.socketId !== socketId) ?? null;
}

export function removeRoom(code: string): void {
  const key = code.toUpperCase();
  const room = rooms.get(key);
  if (room) {
    for (const p of room.players) {
      if (p.disconnectTimer) {
        clearTimeout(p.disconnectTimer);
        p.disconnectTimer = null;
      }
    }
    rooms.delete(key);
  }
}

export function setSetup(socketId: string, pieces: Piece[]): boolean {
  const player = getPlayer(socketId);
  if (!player) return false;
  player.setup = pieces;
  return true;
}

export function bothSetupsReady(room: Room): boolean {
  return room.players.length === 2 && room.players.every((p) => p.setup !== null);
}
