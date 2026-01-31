// Game logic classes for Texas Hold'em Poker

export class Player {
  constructor(id, name, chips = 1000) {
    this.id = id;
    this.name = name;
    this.chips = chips;
    this.hand = [];
    this.currentBet = 0;
    this.hasFolded = false;
    this.isAllIn = false;
    this.hasActed = false;
  }

  bet(amount) {
    const betAmount = Math.min(amount, this.chips);
    this.chips -= betAmount;
    this.currentBet += betAmount;
    if (this.chips === 0) {
      this.isAllIn = true;
    }
    return betAmount;
  }

  fold() {
    this.hasFolded = true;
  }

  resetForNewHand() {
    this.hand = [];
    this.currentBet = 0;
    this.hasFolded = false;
    this.isAllIn = false;
    this.hasActed = false;
  }

  resetForNewBettingRound() {
    this.currentBet = 0;
    this.hasActed = false;
  }
}

export class Deck {
  constructor() {
    this.cards = [];
    this.initialize();
  }

  initialize() {
    const suits = ['S', 'H', 'D', 'C']; // Spades, Hearts, Diamonds, Clubs
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    this.cards = [];
    for (const suit of suits) {
      for (const rank of ranks) {
        this.cards.push({ suit, rank });
      }
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal() {
    return this.cards.pop();
  }

  dealCards(count) {
    const cards = [];
    for (let i = 0; i < count; i++) {
      cards.push(this.deal());
    }
    return cards;
  }
}

export class HandState {
  constructor() {
    this.phase = 'preflop'; // preflop, flop, turn, river, showdown
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0; // Highest bet in current round
    this.dealerIndex = 0;
    this.smallBlindIndex = 0;
    this.bigBlindIndex = 0;
    this.currentPlayerIndex = 0;
    this.blindsPosted = false;
    this.winners = [];

    // Improved pot management
    this.potManager = new PotManager();
    // Track bets for the current street/round only
    this.roundBets = new Map(); // playerId -> amount
  }

  nextPhase() {
    const phases = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const currentIndex = phases.indexOf(this.phase);
    if (currentIndex < phases.length - 1) {
      this.phase = phases[currentIndex + 1];
      // Reset round bets for new phase
      this.roundBets.clear();
      this.currentBet = 0;
      return true;
    }
    return false;
  }

  getPhaseCardCount() {
    const phaseCards = { preflop: 0, flop: 3, turn: 4, river: 5 };
    return phaseCards[this.phase] || 0;
  }
}

export class PotManager {
  constructor() {
    this.pots = [{ amount: 0, contributors: new Set() }]; // Main pot is index 0
  }

  // Called when a betting round ends
  collectBets(players) {
    // Get players who have chips in front of them (currentBet > 0)
    const activeBets = players.filter(p => p.currentBet > 0);

    if (activeBets.length === 0) return;

    // We process bets in chunks based on the smallest stack amounts to handle all-ins correctly
    while (activeBets.some(p => p.currentBet > 0)) {
      // Find smallest non-zero bet
      const minBet = Math.min(...activeBets.filter(p => p.currentBet > 0).map(p => p.currentBet));

      // Get/Create active pot
      if (this.pots.length === 0) {
        this.pots.push({ amount: 0, contributors: new Set(), winners: [] });
      }
      let currentPot = this.pots[this.pots.length - 1];

      // If the current pot has "closed" (because an all-in player capped it previously), start a new one
      // Wait, we need a flag or check if the current pot is "capped".
      // Simplification: We always start a new pot if the previous one was capped.
      // But how do we track "capped"?
      // Let's use a simpler approach:
      // Loop:
      //   1. Take `minBet` from everyone.
      //   2. Add to current pot.
      //   3. Register contributors.
      //   4. If anyone who contributed went All-In (and has 0 left to bet), we MUST close this pot after this iteration.

      let potClosed = false;
      const contributors = [];

      players.forEach(p => {
        if (p.currentBet > 0) {
          const contribution = Math.min(p.currentBet, minBet);
          p.currentBet -= contribution;
          currentPot.amount += contribution;
          currentPot.contributors.add(p.id);
          contributors.push(p);
        }
      });

      // Check if any contributor is now All-In with 0 pending bets (meaning they capped out exactly here)
      const anyoneCapped = contributors.some(p => p.isAllIn && p.currentBet === 0);

      if (anyoneCapped && activeBets.some(p => p.currentBet > 0)) {
        // If someone capped out, AND there are still bets to process (from others), 
        // then this pot is effectively finished for the capped players.
        // We create a new side pot for the remainder.
        this.pots.push({ amount: 0, contributors: new Set(), winners: [] });
      }
    }
  }

  reset() {
    this.pots = [{ amount: 0, contributors: new Set(), winners: [] }];
  }
}
