// Hand evaluation for Texas Hold'em Poker

export function evaluateHand(sevenCards) {
  if (!sevenCards || sevenCards.length < 5) {
    return { rank: 'Invalid', score: 0 };
  }

  // Generate all possible 5-card combinations from 7 cards
  const combinations = getCombinations(sevenCards, 5);
  let bestHand = null;
  let bestScore = 0;

  for (const combo of combinations) {
    const evaluation = evaluateFiveCards(combo);
    if (evaluation.score > bestScore) {
      bestScore = evaluation.score;
      bestHand = evaluation;
    }
  }

  return bestHand;
}

function getCombinations(arr, k) {
  if (k === 1) return arr.map(x => [x]);
  if (k === arr.length) return [arr];
  
  const combinations = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const head = arr[i];
    const tailCombos = getCombinations(arr.slice(i + 1), k - 1);
    for (const combo of tailCombos) {
      combinations.push([head, ...combo]);
    }
  }
  return combinations;
}

function evaluateFiveCards(cards) {
  const sorted = [...cards].sort((a, b) => {
    const rankOrder = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
    return rankOrder[b.rank] - rankOrder[a.rank];
  });

  const ranks = sorted.map(c => c.rank);
  const suits = sorted.map(c => c.suit);
  const rankCounts = {};
  ranks.forEach(rank => {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  });

  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const isFlush = suits.every(suit => suit === suits[0]);
  const rankValues = ranks.map(r => {
    const rankOrder = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
    return rankOrder[r];
  });
  const sortedValues = [...rankValues].sort((a, b) => b - a);

  // Check for straight
  let isStraight = false;
  let straightHigh = 0;
  const uniqueValues = [...new Set(sortedValues)].sort((a, b) => b - a);
  
  // Check for regular straight
  for (let i = 0; i <= uniqueValues.length - 5; i++) {
    let consecutive = true;
    for (let j = 1; j < 5; j++) {
      if (uniqueValues[i + j] !== uniqueValues[i] - j) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) {
      isStraight = true;
      straightHigh = uniqueValues[i];
      break;
    }
  }

  // Check for A-2-3-4-5 straight (wheel)
  if (!isStraight && uniqueValues.includes(14) && uniqueValues.includes(5) && uniqueValues.includes(4) && uniqueValues.includes(3) && uniqueValues.includes(2)) {
    isStraight = true;
    straightHigh = 5; // Ace plays low
  }

  // Royal Flush
  if (isFlush && isStraight && straightHigh === 14) {
    return { rank: 'Royal Flush', score: 9000000 + straightHigh, cards: sorted };
  }

  // Straight Flush
  if (isFlush && isStraight) {
    return { rank: 'Straight Flush', score: 8000000 + straightHigh, cards: sorted };
  }

  // Four of a Kind
  if (counts[0] === 4) {
    const fourKind = Object.keys(rankCounts).find(r => rankCounts[r] === 4);
    const kicker = Object.keys(rankCounts).find(r => rankCounts[r] === 1);
    const rankOrder = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
    return { rank: 'Four of a Kind', score: 7000000 + rankOrder[fourKind] * 100 + rankOrder[kicker], cards: sorted };
  }

  // Full House
  if (counts[0] === 3 && counts[1] === 2) {
    const threeKind = Object.keys(rankCounts).find(r => rankCounts[r] === 3);
    const pair = Object.keys(rankCounts).find(r => rankCounts[r] === 2);
    const rankOrder = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
    return { rank: 'Full House', score: 6000000 + rankOrder[threeKind] * 100 + rankOrder[pair], cards: sorted };
  }

  // Flush
  if (isFlush) {
    let flushScore = 5000000;
    for (let i = 0; i < 5; i++) {
      flushScore += sortedValues[i] * Math.pow(100, 4 - i);
    }
    return { rank: 'Flush', score: flushScore, cards: sorted };
  }

  // Straight
  if (isStraight) {
    return { rank: 'Straight', score: 4000000 + straightHigh, cards: sorted };
  }

  // Three of a Kind
  if (counts[0] === 3) {
    const threeKind = Object.keys(rankCounts).find(r => rankCounts[r] === 3);
    const kickers = Object.keys(rankCounts).filter(r => rankCounts[r] === 1).sort((a, b) => {
      const rankOrder = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
      return rankOrder[b] - rankOrder[a];
    });
    const rankOrder = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
    return { rank: 'Three of a Kind', score: 3000000 + rankOrder[threeKind] * 10000 + rankOrder[kickers[0]] * 100 + rankOrder[kickers[1]], cards: sorted };
  }

  // Two Pair
  if (counts[0] === 2 && counts[1] === 2) {
    const pairs = Object.keys(rankCounts).filter(r => rankCounts[r] === 2).sort((a, b) => {
      const rankOrder = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
      return rankOrder[b] - rankOrder[a];
    });
    const kicker = Object.keys(rankCounts).find(r => rankCounts[r] === 1);
    const rankOrder = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
    return { rank: 'Two Pair', score: 2000000 + rankOrder[pairs[0]] * 10000 + rankOrder[pairs[1]] * 100 + rankOrder[kicker], cards: sorted };
  }

  // One Pair
  if (counts[0] === 2) {
    const pair = Object.keys(rankCounts).find(r => rankCounts[r] === 2);
    const kickers = Object.keys(rankCounts).filter(r => rankCounts[r] === 1).sort((a, b) => {
      const rankOrder = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
      return rankOrder[b] - rankOrder[a];
    });
    const rankOrder = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
    return { rank: 'One Pair', score: 1000000 + rankOrder[pair] * 10000 + rankOrder[kickers[0]] * 100 + rankOrder[kickers[1]] * 10 + rankOrder[kickers[2]], cards: sorted };
  }

  // High Card
  let highCardScore = 0;
  for (let i = 0; i < 5; i++) {
    highCardScore += sortedValues[i] * Math.pow(100, 4 - i);
  }
  return { rank: 'High Card', score: highCardScore, cards: sorted };
}
