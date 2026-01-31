import { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { useCardDealing } from '../hooks/useCardDealing';
import './Table.css';

function Table({ gameState, handState, myPlayerId, myHand, playerName, isConnected }) {
  // All hooks must be declared at the top, before any conditional returns
  const [raiseAmount, setRaiseAmount] = useState(20);
  const tableRef = useRef(null);
  const prevPhaseRef = useRef(null);

  // Professional card dealing animation system
  const {
    isDealing,
    dealtCardIds,
    flippedCardIds,
    registerCardElement,
    dealPlayerHand
  } = useCardDealing({
    tableRef,
    communityCards: handState?.communityCards || [],
    delayBetweenCards: 150, // 150ms delay between cards for sequential dealing
    animationDuration: 600  // 600ms per card animation
  });

  // Deal initial player hands when game starts
  // Only trigger once when hand is first received
  const hasDealtInitialHandRef = useRef(false);
  useEffect(() => {
    if (handState && myHand && myHand.length > 0 && !isDealing && !hasDealtInitialHandRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        dealPlayerHand(myPlayerId, myHand);
        hasDealtInitialHandRef.current = true;
      }, 200);
      return () => clearTimeout(timer);
    }
    // Reset when new hand starts (phase changes)
    if (handState?.phase === 'preflop' && myHand && myHand.length === 0) {
      hasDealtInitialHandRef.current = false;
    }
  }, [handState?.phase, myHand, myPlayerId, dealPlayerHand, isDealing]);

  // Early returns after all hooks
  if (!gameState) {
    return <div className="loading">Loading game state...</div>;
  }

  const myPlayer = gameState.players.find(p => p.id === myPlayerId);

  // Calculate raise bounds for slider
  const minRaise = handState && myPlayer
    ? Math.max(handState.currentBet - (myPlayer.currentBet || 0) + 1, 1)
    : 1;
  const maxRaise = myPlayer?.chips || 1000;
  const isMyTurn = handState && handState.currentPlayerIndex !== undefined &&
    gameState.players.filter(p => !p.hasFolded && p.chips > 0)[handState.currentPlayerIndex]?.id === myPlayerId;
  const canAct = isMyTurn && !myPlayer?.hasActed && !myPlayer?.isAllIn;
  const activePlayers = gameState.players.filter(p => !p.hasFolded && p.chips > 0);
  const currentPlayer = handState && activePlayers[handState.currentPlayerIndex];

  const handleAction = (actionType, amount = null) => {
    if (!gameState.roomId) return;
    socket.emit('playerAction', {
      roomId: gameState.roomId,
      action: { type: actionType, amount }
    });
  };

  const handleStartGame = () => {
    if (!gameState.roomId) return;
    socket.emit('startGame', { roomId: gameState.roomId });
  };

  const getCardDisplay = (card, isHidden = false) => {
    if (!card) return null;

    if (isHidden) {
      return (
        <div className="card card-back">
          <img src="/cards/back.svg" alt="Card Back" className="card-image" />
        </div>
      );
    }

    const cardFileName = `${card.rank}${card.suit}.svg`;
    return (
      <div className="card">
        <img
          src={`/cards/${cardFileName}`}
          alt={`${card.rank} of ${card.suit}`}
          className="card-image"
          onError={(e) => {
            // Fallback to text if image fails to load
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML = `
              <span class="card-rank">${card.rank}</span>
              <span class="card-suit">${getSuitSymbol(card.suit)}</span>
            `;
          }}
        />
      </div>
    );
  };

  const getSuitSymbol = (suit) => {
    const suitSymbols = { 'S': '♠', 'H': '♥', 'D': '♦', 'C': '♣' };
    return suitSymbols[suit] || suit;
  };

  const getPlayerPosition = (index, total) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const radius = 200;
    return {
      left: `calc(50% + ${radius * Math.cos(angle)}px)`,
      top: `calc(50% + ${radius * Math.sin(angle)}px)`,
      angle: angle
    };
  };

  // Get dealer position
  const getDealerPosition = () => {
    if (!handState || !gameState || gameState.players.length === 0) return null;

    const activePlayers = gameState.players.filter(p => !p.hasFolded && p.chips > 0);
    if (activePlayers.length === 0) return null;

    const dealerIndex = handState.dealerIndex % activePlayers.length;
    const dealerPlayer = activePlayers[dealerIndex];
    const playerIndex = gameState.players.findIndex(p => p.id === dealerPlayer.id);

    if (playerIndex === -1) return null;

    const position = getPlayerPosition(playerIndex, gameState.players.length);
    return {
      ...position,
      playerIndex: playerIndex
    };
  };

  if (!isConnected) {
    return (
      <div className="table-container">
        <div className="connection-warning">
          <p>⚠️ Connection Lost</p>
          <p className="hint">Trying to reconnect to server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="header-left">
          <span className={`header-connection ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          <h2 className="header-room">Room: {gameState.roomId}</h2>
          {!gameState.gameStarted && (
            <div className="bot-controls">
              <button
                onClick={() => {
                  socket.emit('addBot', { roomId: gameState.roomId });
                }}
                className="btn btn-bot"
                disabled={gameState.players.length >= 7}
              >
                + Add Bot
              </button>
            </div>
          )}
        </div>
        <div className="pot-display">
          Pot: ${handState?.pot || 0}
        </div>
        <button
          className="btn-exit"
          onClick={() => window.location.reload()}
          title="Exit to Lobby"
        >
          Exit Game
        </button>
      </div>

      {/* Game Log Panel */}
      {gameState.gameLog && gameState.gameLog.length > 0 && (
        <div className="game-log-panel">
          <div className="game-log-title">Game Log</div>
          <div className="game-log-entries">
            {gameState.gameLog.slice(-20).reverse().map((entry, idx) => (
              <div key={idx} className="game-log-entry">{entry}</div>
            ))}
          </div>
        </div>
      )}

      <div className="table-area">
        {/* Winner Display - Overlay on table */}
        {handState?.winners && handState.winners.length > 0 && (
          <div className="winner-display">
            <h3>🏆 Winner{handState.winners.length > 1 ? 's' : ''}!</h3>
            {handState.winners.map((winner, idx) => (
              <div key={idx} className="winner-info">
                <span className="winner-name">{winner.playerName}</span>
                {winner.hand && (
                  <span className="winner-hand"> - {winner.hand.rank}</span>
                )}
                <span className="winner-share"> (+${winner.share})</span>
              </div>
            ))}
          </div>
        )}
        <div className="poker-table" ref={tableRef}>
          {/* Animated Dealer Button */}
          {handState && getDealerPosition() && (
            <div
              className="dealer-button"
              style={{
                left: getDealerPosition().left,
                top: getDealerPosition().top
              }}
            >
              <div className="dealer-chip">
                <span className="dealer-text">D</span>
              </div>
            </div>
          )}

          {/* Dealer deck indicator: minimal, no spectacle */}
          <div className="dealer-area">
            <span className="dealer-icon">Deck</span>
          </div>

          {/* Community Cards: dealt face-down, then flip after brief pause */}
          {handState && (
            <div className="community-cards">
              {handState.communityCards.map((card, idx) => {
                const cardId = `community_${idx}`;
                const isDealt = dealtCardIds.has(cardId);
                const isFlipped = flippedCardIds.has(cardId);
                const shouldAnimate = !isDealt && isDealing;
                return (
                  <div
                    key={idx}
                    ref={(el) => registerCardElement(cardId, el)}
                    className={`community-card card-flip-wrapper ${shouldAnimate ? 'card-pending-deal' : 'card-dealt'} ${isFlipped ? 'card-flipped' : ''}`}
                    style={{
                      opacity: shouldAnimate ? 0 : 1,
                      pointerEvents: isDealing && shouldAnimate ? 'none' : 'auto'
                    }}
                  >
                    <div className="card-face back">
                      <div className="card card-back">
                        <img src="/cards/back.svg" alt="" className="card-image" />
                      </div>
                    </div>
                    <div className="card-face front">
                      {getCardDisplay(card)}
                    </div>
                  </div>
                );
              })}
              {handState.phase && (
                <div className="phase-indicator">{handState.phase.toUpperCase()}</div>
              )}
            </div>
          )}

          {/* Players around table */}
          {gameState.players.map((player, idx) => {
            const position = getPlayerPosition(idx, gameState.players.length);
            const isActive = !player.hasFolded && player.chips > 0;
            const isCurrent = currentPlayer?.id === player.id;
            const isMe = player.id === myPlayerId;
            const showCards = handState && !player.hasFolded && (isMe || handState.phase === 'showdown');
            const isDealer = handState && gameState.players.filter(p => !p.hasFolded && p.chips > 0)[handState.dealerIndex]?.id === player.id;

            return (
              <div
                key={player.id}
                className={`player-seat ${isMe ? 'me' : ''} ${isCurrent ? 'current-turn' : ''} ${!isActive ? 'folded' : ''} ${isDealer ? 'dealer-seat' : ''}`}
                style={{
                  left: position.left,
                  top: position.top
                }}
              >
                <div className="player-info">
                  <div className="player-name">
                    {player.name} {isMe && '(You)'} {player.isBot && '🤖'}
                  </div>
                  <div className="player-chips">Chips: ${player.chips}</div>
                  {handState && player.currentBet > 0 && (
                    <div className="player-bet">Bet: ${player.currentBet}</div>
                  )}
                  {player.hasFolded && <div className="folded-indicator">FOLDED</div>}
                  {player.isAllIn && <div className="allin-indicator">ALL IN</div>}
                  {isCurrent && <div className="turn-indicator">→</div>}
                  {showCards && handState && (
                    <div className="player-cards">
                      {isMe ? (
                        myHand.map((card, cardIdx) => {
                          const cardId = `player_${player.id}_${cardIdx}`;
                          const isDealt = dealtCardIds.has(cardId);
                          const shouldAnimate = !isDealt && isDealing;
                          const showFace = isMe || flippedCardIds.has(cardId);
                          return (
                            <div
                              key={cardIdx}
                              ref={(el) => registerCardElement(cardId, el)}
                              className={`player-card card-flip-wrapper ${shouldAnimate ? 'card-pending-deal' : 'card-dealt'} ${showFace ? 'card-flipped' : ''}`}
                              style={{
                                opacity: shouldAnimate ? 0 : 1,
                                pointerEvents: isDealing && shouldAnimate ? 'none' : 'auto'
                              }}
                            >
                              <div className="card-face back">
                                <div className="card card-back">
                                  <img src="/cards/back.svg" alt="" className="card-image" />
                                </div>
                              </div>
                              <div className="card-face front">
                                {getCardDisplay(card)}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        // Show card backs for other players until showdown
                        handState.phase === 'showdown' && player.hand ? (
                          player.hand.map((card, cardIdx) => {
                            const cardId = `player_${player.id}_${cardIdx}`;
                            const isDealt = dealtCardIds.has(cardId);
                            const shouldAnimate = !isDealt && isDealing;

                            return (
                              <div
                                key={cardIdx}
                                ref={(el) => registerCardElement(cardId, el)}
                                className={`player-card ${shouldAnimate ? 'card-pending-deal' : 'card-dealt'}`}
                                style={{
                                  opacity: shouldAnimate ? 0 : 1,
                                  pointerEvents: isDealing && shouldAnimate ? 'none' : 'auto'
                                }}
                              >
                                {getCardDisplay(card)}
                              </div>
                            );
                          })
                        ) : (
                          <>
                            <div className="player-card">{getCardDisplay(null, true)}</div>
                            <div className="player-card">{getCardDisplay(null, true)}</div>
                          </>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* My Hand - Removed from bottom to save space, cards shown at player seat only */}

      {/* Action Buttons */}
      <div className="action-panel">
        {!gameState.gameStarted ? (
          <button
            onClick={handleStartGame}
            className="btn btn-start"
            disabled={isDealing}
          >
            Start Game
          </button>
        ) : (
          <>
            {canAct && !isDealing && (
              <>
                <button
                  onClick={() => handleAction('fold')}
                  className="btn btn-fold"
                  disabled={isDealing}
                >
                  Fold
                </button>
                {handState && myPlayer && myPlayer.currentBet >= handState.currentBet ? (
                  <button
                    onClick={() => handleAction('check')}
                    className="btn btn-check"
                    disabled={isDealing}
                  >
                    Check
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction('call')}
                    className="btn btn-call"
                    disabled={isDealing}
                  >
                    Call ${Math.min(handState?.currentBet - (myPlayer?.currentBet || 0) || 0, myPlayer?.chips || 0)}
                  </button>
                )}
                {/* Raise Controls with Slider - Modern, tactile betting interface */}
                <div className="raise-controls">
                  <div className="raise-slider-container">
                    <label className="raise-label">
                      Raise: ${raiseAmount}
                    </label>
                    <input
                      type="range"
                      min={minRaise}
                      max={maxRaise}
                      value={Math.min(Math.max(raiseAmount, minRaise), maxRaise)}
                      onChange={(e) => {
                        const newAmount = parseInt(e.target.value) || minRaise;
                        setRaiseAmount(Math.min(Math.max(newAmount, minRaise), maxRaise));
                      }}
                      className="raise-slider"
                      disabled={isDealing}
                    />
                    <div className="raise-range-labels">
                      <span>${minRaise}</span>
                      <span>${maxRaise}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAction('raise', raiseAmount)}
                    className="btn btn-raise"
                    disabled={isDealing || raiseAmount < (handState ? handState.currentBet - (myPlayer?.currentBet || 0) + 1 : 1)}
                  >
                    Raise ${raiseAmount}
                  </button>
                </div>

                {/* ALL-IN Button - One-click, decisive action */}
                <button
                  onClick={() => {
                    const allInAmount = myPlayer?.chips || 0;
                    setRaiseAmount(allInAmount);
                    handleAction('raise', allInAmount);
                  }}
                  className="btn btn-allin"
                  disabled={isDealing || !myPlayer || myPlayer.chips === 0}
                >
                  ALL-IN ${myPlayer?.chips || 0}
                </button>
              </>
            )}
            {(!canAct || isDealing) && handState && (
              <div className="waiting-message">
                {isDealing ? 'Dealing cards...' : (isMyTurn ? 'Processing...' : `Waiting for ${currentPlayer?.name || 'other players'}...`)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Table;
