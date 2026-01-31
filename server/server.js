import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Player, Deck, HandState } from './game.js';
import { evaluateHand } from './evaluate.js';
import { Bot, generateBotId } from './bot.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const rooms = {}; // roomId -> game state
const turnTimers = {}; // roomId -> timerId

// Constants
const TURN_TIME_LIMIT = 30000; // 30 seconds
const BOT_ACTION_DELAY = 1000;

// Generate unique room ID

// Generate unique room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Get game state for a room
function getGameState(roomId) {
  return rooms[roomId];
}

// Broadcast game state to room
function broadcastGameState(roomId) {
  const gameState = rooms[roomId];
  if (gameState) {
    const isShowdown = gameState.handState && gameState.handState.phase === 'showdown';
    io.to(roomId).emit('gameStateUpdate', {
      players: gameState.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        currentBet: p.currentBet,
        hasFolded: p.hasFolded,
        isAllIn: p.isAllIn,
        hasActed: p.hasActed,
        // Only send hand during showdown
        hand: isShowdown && !p.hasFolded ? p.hand : null
      })),
      roomId: roomId,
      gameStarted: gameState.gameStarted,
      gameLog: gameState.gameLog || [],
      handState: gameState.handState ? {
        phase: gameState.handState.phase,
        communityCards: gameState.handState.communityCards,
        pot: gameState.handState.pot,
        currentBet: gameState.handState.currentBet,
        currentPlayerIndex: gameState.handState.currentPlayerIndex,
        dealerIndex: gameState.handState.dealerIndex,
        winners: gameState.handState.winners || []
      } : null
    });
  }
}

// Broadcast hand state with player hands (only to respective players)
function broadcastHandState(roomId) {
  const gameState = rooms[roomId];
  if (!gameState || !gameState.handState) return;

  const handStateData = {
    phase: gameState.handState.phase,
    communityCards: gameState.handState.communityCards,
    pot: gameState.handState.pot,
    currentBet: gameState.handState.currentBet,
    currentPlayerIndex: gameState.handState.currentPlayerIndex,
    dealerIndex: gameState.handState.dealerIndex,
    activePots: gameState.handState.potManager ? gameState.handState.potManager.pots.map(p => ({ amount: p.amount })) : []
  };

  // Send to each player with their own hand
  gameState.players.forEach(player => {
    io.to(player.id).emit('handStateUpdate', {
      ...handStateData,
      myHand: player.hand,
      myPlayerId: player.id
    });
  });
}

// Timer Management
function startTurnTimer(roomId) {
  stopTurnTimer(roomId); // Clear existing

  const gameState = rooms[roomId];
  if (!gameState || !gameState.handState || !gameState.gameStarted) return;

  const activePlayers = gameState.players.filter(p => !p.hasFolded && p.chips > 0);
  if (activePlayers.length <= 1) return; // No timer needed if 1 player left (hand ends)

  const currentPlayer = activePlayers[gameState.handState.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.isBot) return; // Bots manage their own timing

  turnTimers[roomId] = setTimeout(() => {
    console.log(`Time expired for player ${currentPlayer.name} (${currentPlayer.id})`);
    // Force action: Check if possible, otherwise Fold
    const canCheck = currentPlayer.currentBet >= gameState.handState.currentBet;
    handlePlayerAction(roomId, currentPlayer.id, canCheck ? { type: 'check' } : { type: 'fold' });
  }, TURN_TIME_LIMIT);
}

function stopTurnTimer(roomId) {
  if (turnTimers[roomId]) {
    clearTimeout(turnTimers[roomId]);
    delete turnTimers[roomId];
  }
}

// Start a new hand
function startHand(roomId) {
  const gameState = rooms[roomId];
  if (!gameState || gameState.players.length < 2) return;

  // Reset players for new hand
  gameState.players.forEach(player => {
    player.resetForNewHand();
  });

  // Create new deck and shuffle
  gameState.deck = new Deck();
  gameState.deck.shuffle();

  // Deal cards to players
  gameState.players.forEach(player => {
    player.hand = gameState.deck.dealCards(2);
  });

  // Set up blinds
  const activePlayers = gameState.players.filter(p => p.chips > 0);
  if (activePlayers.length < 2) return;

  gameState.handState = new HandState();
  // Rotate dealer
  gameState.dealerIndex = (gameState.dealerIndex + 1) % activePlayers.length;
  gameState.handState.dealerIndex = gameState.dealerIndex;
  gameState.handState.smallBlindIndex = (gameState.handState.dealerIndex + 1) % activePlayers.length;
  gameState.handState.bigBlindIndex = (gameState.handState.smallBlindIndex + 1) % activePlayers.length;

  const smallBlind = Math.min(10, activePlayers[gameState.handState.smallBlindIndex].chips);
  const bigBlind = Math.min(20, activePlayers[gameState.handState.bigBlindIndex].chips);

  activePlayers[gameState.handState.smallBlindIndex].bet(smallBlind);
  activePlayers[gameState.handState.bigBlindIndex].bet(bigBlind);

  gameState.handState.currentBet = bigBlind;
  gameState.handState.pot = smallBlind + bigBlind;
  gameState.handState.currentPlayerIndex = (gameState.handState.bigBlindIndex + 1) % activePlayers.length;
  gameState.handState.blindsPosted = true;

  broadcastGameState(roomId);
  broadcastHandState(roomId);

  startTurnTimer(roomId);

  // Check for bot actions after a delay
  setTimeout(() => {
    processBotActions(roomId);
  }, 500);
}

// Process betting round
function processBettingRound(roomId) {
  const gameState = rooms[roomId];
  if (!gameState || !gameState.handState) return;

  const activePlayers = gameState.players.filter(p => !p.hasFolded && p.chips > 0);
  if (activePlayers.length <= 1) {
    // Only one player left, they win
    endHand(roomId);
    return;
  }

  // Check if betting round is complete
  const allActed = activePlayers.every(p => p.hasActed || p.isAllIn);
  const allBetsEqual = activePlayers.every(p => p.currentBet === gameState.handState.currentBet || p.isAllIn);

  if (allActed && allBetsEqual) {
    // Collect bets into Pots before moving phase
    if (gameState.handState.potManager) {
      // We pass ALL players because we need to process everyone's round bets
      gameState.handState.potManager.collectBets(gameState.players);
    }

    // Move to next phase
    if (gameState.handState.phase === 'preflop') {
      gameState.handState.communityCards = gameState.deck.dealCards(3);
      gameState.handState.phase = 'flop';
    } else if (gameState.handState.phase === 'flop') {
      gameState.handState.communityCards.push(gameState.deck.deal());
      gameState.handState.phase = 'turn';
    } else if (gameState.handState.phase === 'turn') {
      gameState.handState.communityCards.push(gameState.deck.deal());
      gameState.handState.phase = 'river';
    } else if (gameState.handState.phase === 'river') {
      endHand(roomId);
      return;
    }

    // Reset for new betting round
    activePlayers.forEach(player => {
      player.resetForNewBettingRound();
    });
    gameState.handState.currentBet = 0;

    // Find first active player after dealer (dealerIndex is index into activePlayers)
    const dealerPlayer = activePlayers[gameState.handState.dealerIndex];
    let dealerIndexInAll = gameState.players.findIndex(p => p.id === dealerPlayer.id);
    let nextIndex = (dealerIndexInAll + 1) % gameState.players.length;
    while (gameState.players[nextIndex].hasFolded || gameState.players[nextIndex].chips === 0) {
      nextIndex = (nextIndex + 1) % gameState.players.length;
    }
    // Convert to index in activePlayers array
    const nextPlayer = gameState.players[nextIndex];
    gameState.handState.currentPlayerIndex = activePlayers.findIndex(p => p.id === nextPlayer.id);
  }

  broadcastGameState(roomId);
  broadcastHandState(roomId);

  if (gameState.gameStarted && gameState.handState && activePlayers.length > 1) {
    if (!allActed || !allBetsEqual) {
      startTurnTimer(roomId);
    }
    // Check for bot actions after a delay
    setTimeout(() => {
      processBotActions(roomId);
    }, 500);
  }
}

// Process bot actions
function processBotActions(roomId) {
  const gameState = rooms[roomId];
  if (!gameState || !gameState.handState || !gameState.gameStarted) return;

  const activePlayers = gameState.players.filter(p => !p.hasFolded && p.chips > 0);
  if (activePlayers.length <= 1) return;

  const currentPlayer = activePlayers[gameState.handState.currentPlayerIndex];

  if (currentPlayer && currentPlayer.isBot && !currentPlayer.hasActed && !currentPlayer.isAllIn) {
    console.log(`Bot ${currentPlayer.name} is thinking...`);
    // Bot's turn - make decision after a delay
    setTimeout(() => {
      // Re-check state in case it changed
      const gameStateCheck = rooms[roomId];
      if (!gameStateCheck || !gameStateCheck.handState) return;

      const activePlayersCheck = gameStateCheck.players.filter(p => !p.hasFolded && p.chips > 0);
      const currentPlayerCheck = activePlayersCheck[gameStateCheck.handState.currentPlayerIndex];

      if (currentPlayerCheck && currentPlayerCheck.isBot && currentPlayerCheck.id === currentPlayer.id) {
        const decision = currentPlayerCheck.makeDecision(gameStateCheck, gameStateCheck.handState);
        console.log(`Bot ${currentPlayerCheck.name} decided:`, decision);
        if (decision) {
          handlePlayerAction(roomId, currentPlayerCheck.id, decision);
        } else {
          console.error(`Bot ${currentPlayerCheck.name} returned null decision! Forcing fold.`);
          handlePlayerAction(roomId, currentPlayerCheck.id, { type: 'fold' });
        }
      }
    }, 1000 + Math.random() * 1000); // 1-2 second delay for realism
  }
}

// Handle player action (extracted from socket handler for reuse)
function handlePlayerAction(roomId, playerId, action) {
  const gameState = rooms[roomId];
  if (!gameState || !gameState.handState) {
    return;
  }

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    return;
  }

  const activePlayers = gameState.players.filter(p => !p.hasFolded && p.chips > 0);
  const currentPlayer = activePlayers[gameState.handState.currentPlayerIndex];

  if (currentPlayer.id !== playerId) {
    return;
  }

  if (player.hasActed && !player.isAllIn) {
    return;
  }

  stopTurnTimer(roomId); // Stop timer as action is received

  // Log action helper
  function logAction(actionType, amount = null) {
    if (!gameState.gameLog) gameState.gameLog = [];
    const logEntry = `${player.name} ${actionType}${amount ? ` $${amount}` : ''}`;
    gameState.gameLog.push(logEntry);
    if (gameState.gameLog.length > 50) gameState.gameLog.shift();
    console.log(`[Game Log] ${logEntry}`);
  }

  // Process action
  switch (action.type) {
    case 'fold':
      player.fold();
      player.hasActed = true;
      logAction('folds');
      break;

    case 'check':
      if (player.currentBet < gameState.handState.currentBet) {
        return;
      }
      player.hasActed = true;
      logAction('checks');
      break;

    case 'call':
      const callAmount = gameState.handState.currentBet - player.currentBet;
      if (callAmount > player.chips) {
        const allInAmount = player.bet(player.chips);
        gameState.handState.pot += allInAmount;
        logAction('calls (All-In)', allInAmount);
      } else {
        const betAmount = player.bet(callAmount);
        gameState.handState.pot += betAmount;
        logAction('calls', callAmount);
      }
      player.hasActed = true;
      break;

    case 'raise':
      if (!action.amount || action.amount <= 0) {
        return;
      }

      // Minimum raise validation
      const minRaise = gameState.handState.phase === 'preflop' ? 20 : 10;
      const currentBet = gameState.handState.currentBet;
      const raiseCallAmount = currentBet - player.currentBet;
      const raiseAboveCall = action.amount - raiseCallAmount;

      // Only enforce min-raise if not going all-in
      if (raiseAboveCall < minRaise && action.amount < player.chips) {
        console.log(`Raise rejected: ${player.name} tried to raise by ${raiseAboveCall}, min is ${minRaise}`);
        // Convert to call for bots to prevent stuck state
        if (player.isBot) {
          console.log(`Bot ${player.name} converting to call instead`);
          const callAmount = gameState.handState.currentBet - player.currentBet;
          if (callAmount > player.chips) {
            const allInAmount = player.bet(player.chips);
            gameState.handState.pot += allInAmount;
            logAction('calls (All-In)', allInAmount);
          } else {
            const betAmount = player.bet(callAmount);
            gameState.handState.pot += betAmount;
            logAction('calls', callAmount);
          }
          player.hasActed = true;
          break;
        }
        return;
      }

      const totalBet = player.currentBet + action.amount;
      if (totalBet <= gameState.handState.currentBet) {
        // Invalid raise - convert to call for bots
        if (player.isBot) {
          console.log(`Bot ${player.name} raise below current bet, converting to call`);
          const callAmount = gameState.handState.currentBet - player.currentBet;
          if (callAmount > player.chips) {
            const allInAmount = player.bet(player.chips);
            gameState.handState.pot += allInAmount;
            logAction('calls (All-In)', allInAmount);
          } else {
            const betAmount = player.bet(callAmount);
            gameState.handState.pot += betAmount;
            logAction('calls', callAmount);
          }
          player.hasActed = true;
          break;
        }
        return;
      }
      if (totalBet > player.chips + player.currentBet) {
        return;
      }
      const raiseAmount = player.bet(action.amount);
      gameState.handState.currentBet = player.currentBet;
      gameState.handState.pot += raiseAmount;
      logAction('raises to', player.currentBet);

      // Reset all players' hasActed since there's a new bet
      activePlayers.forEach(p => {
        if (p.id !== player.id) {
          p.hasActed = false;
        }
      });
      player.hasActed = true;
      break;
  }

  // Move to next player. Use post-action active list (chips > 0) so all-in player is excluded;
  // otherwise currentPlayerIndex would point at the wrong player when processBotActions runs.
  const activeAfterAction = gameState.players.filter(p => !p.hasFolded && p.chips > 0);
  const currentPlayerId = currentPlayer.id;
  const currentIndexInFull = gameState.players.findIndex(p => p.id === currentPlayerId);
  let nextIndexInFull = (currentIndexInFull + 1) % gameState.players.length;
  let attempts = 0;
  while ((gameState.players[nextIndexInFull].hasFolded || gameState.players[nextIndexInFull].chips === 0) && attempts < gameState.players.length) {
    nextIndexInFull = (nextIndexInFull + 1) % gameState.players.length;
    attempts++;
  }
  const nextPlayer = gameState.players[nextIndexInFull];
  gameState.handState.currentPlayerIndex = activeAfterAction.findIndex(p => p.id === nextPlayer.id);
  if (gameState.handState.currentPlayerIndex < 0) {
    gameState.handState.currentPlayerIndex = 0;
  }

  broadcastGameState(roomId);
  broadcastHandState(roomId);

  startTurnTimer(roomId); // Restart timer for next player (or current if action failed/round continues)

  // Process betting round and bot actions
  setTimeout(() => {
    processBettingRound(roomId);
  }, 100);
}

// Add bot to room
function addBotToRoom(roomId) {
  const gameState = rooms[roomId];
  if (!gameState) return false;

  if (gameState.players.length >= 7) {
    return false; // Room full
  }

  const botId = generateBotId();
  const bot = new Bot(botId);
  gameState.players.push(bot);

  broadcastGameState(roomId);
  return true;
}

// Remove bot from room
function removeBotFromRoom(roomId, botId) {
  const gameState = rooms[roomId];
  if (!gameState) return false;

  const botIndex = gameState.players.findIndex(p => p.id === botId && p.isBot);
  if (botIndex === -1) return false;

  const bot = gameState.players[botIndex];

  // If in active hand, fold them
  if (gameState.handState && !bot.hasFolded) {
    bot.fold();
  }

  gameState.players.splice(botIndex, 1);
  broadcastGameState(roomId);

  if (gameState.handState) {
    broadcastHandState(roomId);
    setTimeout(() => {
      processBettingRound(roomId);
    }, 100);
  }

  return true;
}

// End hand and determine winners
function endHand(roomId) {
  const gameState = rooms[roomId];
  if (!gameState || !gameState.handState) return;

  /* activePlayers was duplicated here */
  const activePlayers = gameState.players.filter(p => !p.hasFolded);
  stopTurnTimer(roomId);

  // Ensure we collect any final bets if we are ending prematurely or normally
  // (If only 1 player left, we still want to collect bets into the pot structure)
  if (gameState.handState.potManager) {
    gameState.handState.potManager.collectBets(gameState.players);
  }

  if (activePlayers.length === 1) {
    // Only one player left, they win
    // They get the whole main pot plus side pots (simplification: just give them all chips)
    // Actually, we should check which pots they are eligible for.
    // If there were side pots, and everyone else folded, the last survivor wins everything generally.
    // (Unless some side pots were contested by now-folded players? No, if you fold you lose claim.)

    // Simplest approach for "Everyone else folded":
    // The last player gets EVERYTHING in the potManager.

    let totalWinnings = 0;
    if (gameState.handState.potManager) {
      gameState.handState.potManager.pots.forEach(pot => {
        totalWinnings += pot.amount;
      });
    } else {
      totalWinnings = gameState.handState.pot;
    }

    activePlayers[0].chips += totalWinnings;
    gameState.handState.winners = [{
      playerId: activePlayers[0].id,
      playerName: activePlayers[0].name,
      hand: null,
      share: totalWinnings
    }];
  } else {
    // Evaluate all hands
    const evaluations = activePlayers.map(player => {
      const sevenCards = [...player.hand, ...gameState.handState.communityCards];
      const evaluation = evaluateHand(sevenCards);
      return {
        player,
        evaluation
      };
    });

    gameState.handState.winners = [];

    // Distribute each pot separately
    if (gameState.handState.potManager) {
      // Iterate through all pots
      gameState.handState.potManager.pots.forEach((pot, potIndex) => {
        if (pot.amount === 0) return;

        // Find eligible players for this pot (contributors who haven't folded)
        // Note: activePlayers already filters out folded players.
        // So we just check intersection.
        const eligibleEvaluations = evaluations.filter(e =>
          pot.contributors.has(e.player.id)
        );

        if (eligibleEvaluations.length === 0) {
          // Should not happen if logic is correct, but effectively return to house or something?
          // If everyone who contributed folded, then the last player standing logic above handled it.
          // This block is for Showdown. At showdown, eligible players are those who haven't folded.
          return;
        }

        // Find best hand among eligible
        const bestScore = Math.max(...eligibleEvaluations.map(e => e.evaluation.score));
        const winners = eligibleEvaluations.filter(e => e.evaluation.score === bestScore);

        // Distribute pot share
        const share = Math.floor(pot.amount / winners.length);
        winners.forEach(winner => {
          winner.player.chips += share;

          // Add to winners list for UI
          gameState.handState.winners.push({
            playerId: winner.player.id,
            playerName: winner.player.name,
            hand: winner.evaluation,
            share: share,
            potIndex: potIndex,
            isMainPot: potIndex === 0
          });
        });
      });

      // Consolidate winners for cleaner UI (optional, simplified for now)
    } else {
      // Fallback for safety (though potManager should exist)
      // Find best hand(s)
      const bestScore = Math.max(...evaluations.map(e => e.evaluation.score));
      const winners = evaluations.filter(e => e.evaluation.score === bestScore);

      // Distribute pot
      const share = Math.floor(gameState.handState.pot / winners.length);
      winners.forEach(winner => {
        winner.player.chips += share;
      });

      gameState.handState.winners = winners.map(w => ({
        playerId: w.player.id,
        playerName: w.player.name,
        hand: w.evaluation,
        share: share
      }));
    }
  }

  gameState.handState.phase = 'showdown';
  broadcastGameState(roomId);
  broadcastHandState(roomId);

  // After 5 seconds, start new hand
  setTimeout(() => {
    if (rooms[roomId] && rooms[roomId].gameStarted) {
      startHand(roomId);
    }
  }, 5000);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', ({ playerName }) => {
    if (!playerName) {
      socket.emit('error', { message: 'Player name is required' });
      return;
    }

    const roomId = generateRoomId();
    rooms[roomId] = {
      players: [new Player(socket.id, playerName)],
      gameStarted: false,
      handState: null,
      deck: null,
      dealerIndex: 0,
      gameLog: [] // Action log
    };

    socket.join(roomId);
    socket.emit('roomCreated', { roomId });
    broadcastGameState(roomId);
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    if (!roomId || !playerName) {
      socket.emit('error', { message: 'Room ID and player name are required' });
      return;
    }

    const gameState = rooms[roomId];
    if (!gameState) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (gameState.players.length >= 7) {
      socket.emit('error', { message: 'Room full' });
      return;
    }

    // Check if player already in room
    if (gameState.players.some(p => p.id === socket.id)) {
      socket.emit('error', { message: 'Already in room' });
      return;
    }

    gameState.players.push(new Player(socket.id, playerName));
    socket.join(roomId);
    broadcastGameState(roomId);
  });

  socket.on('startGame', ({ roomId }) => {
    const gameState = rooms[roomId];
    if (!gameState) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const humanPlayers = gameState.players.filter(p => !p.isBot);
    if (humanPlayers.length < 1) {
      socket.emit('error', { message: 'Need at least 1 human player to start' });
      return;
    }

    // Auto-add bots if needed to reach minimum 2 players
    while (gameState.players.length < 2) {
      addBotToRoom(roomId);
    }

    if (gameState.gameStarted) {
      socket.emit('error', { message: 'Game already started' });
      return;
    }

    gameState.gameStarted = true;
    gameState.deck = new Deck();
    gameState.deck.shuffle();
    startHand(roomId);
  });

  socket.on('addBot', ({ roomId }) => {
    const gameState = rooms[roomId];
    if (!gameState) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (gameState.gameStarted) {
      socket.emit('error', { message: 'Cannot add bots after game has started' });
      return;
    }

    if (gameState.players.length >= 7) {
      socket.emit('error', { message: 'Room full' });
      return;
    }

    const success = addBotToRoom(roomId);
    if (!success) {
      socket.emit('error', { message: 'Failed to add bot' });
    }
  });

  socket.on('removeBot', ({ roomId, botId }) => {
    const gameState = rooms[roomId];
    if (!gameState) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (gameState.gameStarted) {
      socket.emit('error', { message: 'Cannot remove bots after game has started' });
      return;
    }

    const success = removeBotFromRoom(roomId, botId);
    if (!success) {
      socket.emit('error', { message: 'Failed to remove bot' });
    }
  });

  socket.on('playerAction', ({ roomId, action }) => {
    const gameState = rooms[roomId];
    if (!gameState || !gameState.handState) {
      socket.emit('error', { message: 'No active hand' });
      return;
    }

    const player = gameState.players.find(p => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }

    const activePlayers = gameState.players.filter(p => !p.hasFolded && p.chips > 0);
    const currentPlayer = activePlayers[gameState.handState.currentPlayerIndex];

    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    if (player.hasActed && !player.isAllIn) {
      socket.emit('error', { message: 'Already acted this round' });
      return;
    }

    // Validate action before processing
    if (action.type === 'check' && player.currentBet < gameState.handState.currentBet) {
      socket.emit('error', { message: 'Cannot check, must call or fold' });
      return;
    }

    if (action.type === 'raise') {
      if (!action.amount || action.amount <= 0) {
        socket.emit('error', { message: 'Invalid raise amount' });
        return;
      }
      const totalBet = player.currentBet + action.amount;
      if (totalBet <= gameState.handState.currentBet) {
        socket.emit('error', { message: 'Raise must be higher than current bet' });
        return;
      }
      if (totalBet > player.chips + player.currentBet) {
        socket.emit('error', { message: 'Insufficient chips' });
        return;
      }
    }

    // Use shared handler
    handlePlayerAction(roomId, socket.id, action);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Find and remove player from room
    for (const roomId in rooms) {
      const gameState = rooms[roomId];
      const playerIndex = gameState.players.findIndex(p => p.id === socket.id);

      if (playerIndex !== -1) {
        const player = gameState.players[playerIndex];

        // If in active hand, fold them
        if (gameState.handState && !player.hasFolded) {
          player.fold();
        }

        // Remove player
        gameState.players.splice(playerIndex, 1);

        // If room is empty, delete it
        if (gameState.players.length === 0) {
          delete rooms[roomId];
        } else {
          // Update game state
          broadcastGameState(roomId);
          if (gameState.handState) {
            broadcastHandState(roomId);
            // Check if we need to process betting round
            setTimeout(() => {
              processBettingRound(roomId);
            }, 100);
          }
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
