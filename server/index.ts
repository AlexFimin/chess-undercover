import { createServer } from 'http';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import type { Position, PieceType } from '../src/types';
import {
  createRoom,
  joinRoom,
  getRoom,
  getRoomBySocket,
  getPlayer,
  getOpponent,
  removeRoom,
  setSetup,
  bothSetupsReady,
} from './rooms';
import {
  createGameState,
  getMyPieces,
  getPublicPieces,
  validateMove,
  applyMove,
  pieceNumbersToRecord,
} from './game';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');

const app = express();
app.use(express.static(distPath));
// SPA fallback: любые маршруты отдаём index.html
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('create_room', () => {
    const room = createRoom(socket.id);
    socket.join(room.code);
    socket.emit('room_created', { code: room.code, color: 'white' });
    socket.emit('waiting_for_opponent');
    console.log(`[create_room] ${room.code} by ${socket.id}`);
  });

  socket.on('join_room', (data: { code: string }) => {
    const room = joinRoom(socket.id, data.code);
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена или заполнена' });
      return;
    }
    socket.join(room.code);
    socket.emit('room_joined', { code: room.code, color: 'black' });
    io.to(room.code).emit('opponent_joined');
    console.log(`[join_room] ${socket.id} joined ${room.code}`);
  });

  socket.on('submit_setup', (data: { pieces: { id: string; type: PieceType; owner: string; position: Position; hasMoved: boolean }[] }) => {
    const player = getPlayer(socket.id);
    if (!player) {
      socket.emit('error', { message: 'Вы не в комнате' });
      return;
    }
    const pieces = data.pieces.map((p) => ({ ...p, owner: player.color })) as any;
    setSetup(socket.id, pieces);

    const room = getRoomBySocket(socket.id)!;
    if (bothSetupsReady(room)) {
      const whiteSetup = room.players.find((p) => p.color === 'white')!.setup!;
      const blackSetup = room.players.find((p) => p.color === 'black')!.setup!;
      room.game = createGameState(whiteSetup, blackSetup);

      for (const p of room.players) {
        const myPieces = getMyPieces(room.game.board, p.color);
        const opponentPieces = getPublicPieces(room.game.board, p.color === 'white' ? 'black' : 'white');
        io.to(p.socketId).emit('game_started', {
          myPieces,
          opponentPieces,
          pieceNumbers: pieceNumbersToRecord(room.game.pieceNumbers),
          myColor: p.color,
        });
      }
      console.log(`[game_started] room ${room.code}`);
    } else {
      socket.emit('waiting_for_opponent');
    }
  });

  socket.on('make_move', (data: { from: Position; to: Position }) => {
    const player = getPlayer(socket.id);
    const room = getRoomBySocket(socket.id);
    if (!player || !room || !room.game) {
      socket.emit('error', { message: 'Игра не найдена' });
      return;
    }

    const validation = validateMove(room.game, data.from, data.to, player.color);
    if (!validation.valid) {
      socket.emit('error', { message: validation.error ?? 'Неверный ход' });
      return;
    }

    if (validation.needsPromotion) {
      room.game.pendingPromotion = { pieceId: room.game.board.get(data.from)!.id, from: data.from, to: data.to };
      socket.emit('promotion_request', {
        pieceId: room.game.pendingPromotion.pieceId,
        from: data.from,
        to: data.to,
      });
      return;
    }

    const wireMove = applyMove(room.game, data.from, data.to);
    const moveResult = {
      move: wireMove,
      currentPlayer: room.game.currentPlayer,
      winner: room.game.winner,
    };

    io.to(room.code).emit('move_result', moveResult);
    console.log(`[move] room ${room.code}: ${wireMove.from}→${wireMove.to}${wireMove.capturedPieceId ? ' (capture)' : ''}`);
  });

  socket.on('choose_promotion', (data: { promotedTo: PieceType }) => {
    const room = getRoomBySocket(socket.id);
    if (!room || !room.game || !room.game.pendingPromotion) {
      socket.emit('error', { message: 'Нет ожидающего превращения' });
      return;
    }

    const { from, to } = room.game.pendingPromotion;
    const wireMove = applyMove(room.game, from, to, data.promotedTo);
    const moveResult = {
      move: wireMove,
      currentPlayer: room.game.currentPlayer,
      winner: room.game.winner,
    };

    io.to(room.code).emit('move_result', moveResult);
    console.log(`[promotion] room ${room.code}: ${wireMove.from}→${wireMove.to} →${data.promotedTo}`);
  });

  socket.on('leave_room', () => {
    handleLeave(socket.id);
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    handleLeave(socket.id);
  });
});

function handleLeave(socketId: string) {
  const room = getRoomBySocket(socketId);
  if (!room) return;
  const opponent = getOpponent(socketId);
  if (opponent) {
    io.to(opponent.socketId).emit('opponent_left');
  }
  removeRoom(room.code);
  console.log(`[leave] room ${room.code} removed`);
}

const PORT = parseInt(process.env.PORT ?? '3001', 10);
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
