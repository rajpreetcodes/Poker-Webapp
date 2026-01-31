// Bot AI for Texas Hold'em Poker

import { Player } from './game.js';
import { evaluateHand } from './evaluate.js';

export class Bot extends Player {
  constructor(id, name = null, chips = 1000) {
    const botNames = ['Bot Alice', 'Bot Bob', 'Bot Charlie', 'Bot Diana', 'Bot Eve', 'Bot Frank'];
    const randomName = botNames[Math.floor(Math.random() * botNames.length)];
    super(id, name || randomName, chips);
    this.isBot = true;
    this.personality = Math.random(); // 0 = conservative, 1 = aggressive
  }

  // Evaluate hand strength (0-1 scale)
  evaluateHandStrength(hand, communityCards) {
    if (!hand || hand.length < 2) return 0;

    const allCards = [...hand, ...(communityCards || [])];
    if (allCards.length < 2) return 0.1; // Just hole cards, very weak

    if (allCards.length >= 5) {
      const evaluation = evaluateHand(allCards);
      // Normalize score to 0-1 range (rough approximation)
      const normalizedScore = Math.min(evaluation.score / 10000000, 1);
      return normalizedScore;
    }

    // Pre-flop evaluation based on hole cards
    const ranks = hand.map(c => c.rank);
    const suits = hand.map(c => c.suit);
    const isPair = ranks[0] === ranks[1];
    const isSuited = suits[0] === suits[1];

    const rankValues = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
    const highCard = Math.max(...ranks.map(r => rankValues[r] || 0));

    let strength = 0.3; // Base strength

    if (isPair) {
      strength = 0.5 + (highCard / 14) * 0.3; // Pair strength based on rank
    } else if (isSuited) {
      strength = 0.35 + (highCard / 14) * 0.2;
    } else {
      strength = 0.25 + (highCard / 14) * 0.15;
    }

    return Math.min(strength, 0.9);
  }

  // Make a decision based on game state
  makeDecision(gameState, handState) {
    if (this.hasFolded || this.isAllIn || this.hasActed) {
      return null;
    }

    try {
      const handStrength = this.evaluateHandStrength(this.hand, handState.communityCards);
      const callAmount = handState.currentBet - this.currentBet;
      const potOdds = callAmount > 0 ? handState.pot / (handState.pot + callAmount) : 0;
      const canCheck = this.currentBet >= handState.currentBet;
      const stackRatio = this.chips / 1000; // Assuming starting stack of 1000

      // Adjust personality based on stack size (short stack = more aggressive)
      const effectivePersonality = this.personality + (1 - stackRatio) * 0.3;

      // Decision logic
      if (handStrength < 0.2) {
        // Very weak hand - fold unless pot odds are great
        if (callAmount === 0 || (potOdds > 0.5 && callAmount < this.chips * 0.1)) {
          return canCheck ? { type: 'check' } : { type: 'fold' };
        }
        return { type: 'fold' };
      }

      if (handStrength < 0.4) {
        // Weak hand - check/call small bets, fold to big bets
        if (canCheck) {
          return { type: 'check' };
        }
        if (callAmount > this.chips * 0.2) {
          return { type: 'fold' };
        }
        if (callAmount < this.chips * 0.1) {
          return { type: 'call' };
        }
        // Medium bet - depends on personality
        return effectivePersonality > 0.5 ? { type: 'call' } : { type: 'fold' };
      }

      if (handStrength < 0.6) {
        // Medium hand - check/call, sometimes raise
        if (canCheck) {
          return effectivePersonality > 0.6 ? { type: 'check' } : { type: 'check' };
        }
        if (callAmount > this.chips * 0.3) {
          return { type: 'fold' };
        }
        if (callAmount < this.chips * 0.15) {
          return effectivePersonality > 0.4 ?
            { type: 'raise', amount: Math.min(Math.floor(callAmount * 1.5), this.chips * 0.2) } :
            { type: 'call' };
        }
        return { type: 'call' };
      }

      if (handStrength < 0.8) {
        // Strong hand - bet/raise
        if (canCheck) {
          const betAmount = Math.floor(this.chips * (0.15 + effectivePersonality * 0.15));
          return { type: 'raise', amount: Math.min(betAmount, this.chips) };
        }
        if (callAmount > this.chips * 0.4) {
          return { type: 'call' }; // Pot committed
        }
        const raiseAmount = Math.floor(callAmount * (1.5 + effectivePersonality * 0.5));
        return { type: 'raise', amount: Math.min(raiseAmount, this.chips * 0.3) };
      }

      // Very strong hand (0.8+) - aggressive betting
      if (canCheck) {
        const betAmount = Math.floor(this.chips * (0.2 + effectivePersonality * 0.2));
        return { type: 'raise', amount: Math.min(betAmount, this.chips * 0.4) };
      }
      const raiseAmount = Math.floor(callAmount * (2 + effectivePersonality));
      return { type: 'raise', amount: Math.min(raiseAmount, this.chips * 0.5) };
    } catch (error) {
      console.error(`Bot ${this.name} decision error:`, error);
      // Fallback: check if possible, otherwise fold
      const canCheck = this.currentBet >= handState.currentBet;
      return canCheck ? { type: 'check' } : { type: 'fold' };
    }
  }
}

// Generate unique bot ID
let botIdCounter = 0;
export function generateBotId() {
  return `bot_${Date.now()}_${++botIdCounter}`;
}
