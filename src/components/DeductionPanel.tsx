import { useState } from 'react';
import type { Piece, Color, Board as BoardType, PieceType, Move } from '../types';
import { PIECE_SYMBOLS } from '../types';

interface DeductionPanelProps {
  opponentPieces: Piece[];
  opponentColor: Color;
  pieceNumbers: Map<string, number>;
  possibleTypes: Map<string, Set<PieceType>>;
  capturedPieceIds: Set<string>;
  board: BoardType;
  history: Move[];
  selectedPieceId: string | null;
  onSelectPiece: (id: string) => void;
}

const ALL_TYPES_ORDER: PieceType[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];

export function DeductionPanel({
  opponentPieces,
  opponentColor,
  pieceNumbers,
  possibleTypes,
  capturedPieceIds,
  history,
  selectedPieceId,
  onSelectPiece,
}: DeductionPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  const sortedPieces = [...opponentPieces].sort((a, b) => {
    const na = pieceNumbers.get(a.id) ?? 99;
    const nb = pieceNumbers.get(b.id) ?? 99;
    return na - nb;
  });

  function pieceMoves(pieceId: string): Move[] {
    return history.filter((m) => m.pieceId === pieceId);
  }

  if (collapsed) {
    return (
      <div className="deduction-panel collapsed">
        <button className="toggle-btn" onClick={() => setCollapsed(false)}>
          Дедукция ▶
        </button>
      </div>
    );
  }

  return (
    <div className="deduction-panel">
      <div className="panel-header">
        <h3>Дедукция ({opponentColor === 'white' ? 'Белые' : 'Чёрные'})</h3>
        <div className="panel-controls">
          <label className="debug-toggle">
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
            />
            <span>debug</span>
          </label>
          <button className="toggle-btn" onClick={() => setCollapsed(true)}>
            ▼
          </button>
        </div>
      </div>

      <table className="deduction-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Типы</th>
            <th>Статус</th>
            {debugMode && <th>Реал</th>}
          </tr>
        </thead>
        <tbody>
          {sortedPieces.map((piece) => {
            const num = pieceNumbers.get(piece.id) ?? '?';
            const captured = capturedPieceIds.has(piece.id);
            const types = possibleTypes.get(piece.id);
            const isRevealed = types && types.size === 1;
            const isSelected = selectedPieceId === piece.id;

            const deducedType = isRevealed ? [...types!][0] : null;
            const realType = piece.type;
            const mismatch = debugMode && deducedType && deducedType !== realType;

            return (
              <tr
                key={piece.id}
                className={`${captured ? 'captured' : ''} ${isSelected ? 'selected-row' : ''} ${mismatch ? 'deduction-mismatch' : ''}`}
                onClick={() => onSelectPiece(piece.id)}
              >
                <td className="num-cell">{num}</td>
                <td className="types-cell">
                  {isRevealed ? (
                    <span className={`piece revealed ${opponentColor}`}>
                      {PIECE_SYMBOLS[opponentColor][deducedType as keyof typeof PIECE_SYMBOLS[Color]]}
                    </span>
                  ) : (
                    <span className="types-list">
                      {ALL_TYPES_ORDER.map((t) => {
                        const possible = types?.has(t);
                        return (
                          <span
                            key={t}
                            className={`type-icon ${possible ? 'possible' : 'eliminated'} ${opponentColor}`}
                          >
                            {PIECE_SYMBOLS[opponentColor][t]}
                          </span>
                        );
                      })}
                    </span>
                  )}
                </td>
                <td className="status-cell">
                  {captured ? 'взят' : isRevealed ? 'вскрыт' : 'скрыт'}
                </td>
                {debugMode && (
                  <td className="real-cell">
                    <span className={`piece ${opponentColor}`}>{PIECE_SYMBOLS[opponentColor][realType]}</span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {selectedPieceId && (() => {
        const piece = opponentPieces.find((p) => p.id === selectedPieceId);
        if (!piece) return null;
        const num = pieceNumbers.get(piece.id) ?? '?';
        const moves = pieceMoves(piece.id);
        const captured = capturedPieceIds.has(piece.id);

        return (
          <div className="deduction-detail">
            <h4>Фигура №{num} {captured && '(взята)'}</h4>
            <div className="detail-history">
              {moves.length === 0 ? (
                <span className="muted">Ещё не ходила</span>
              ) : (
                moves.map((m, i) => (
                  <div key={i} className="history-row">
                    <span className="move-num">{i + 1}.</span>
                    <span>{m.from} → {m.to}</span>
                    {m.capturedPieceId && <span className="capture-mark"> взятие</span>}
                    {m.promotedTo && <span className="promo-mark"> →{PIECE_SYMBOLS[opponentColor][m.promotedTo]}</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
