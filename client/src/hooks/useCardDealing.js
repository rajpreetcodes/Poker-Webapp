/**
 * React Hook for Professional Card Dealing Animations
 * 
 * Manages card dealing state, tracks animation progress, and handles
 * sequential dealing with proper cleanup and state safety.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  dealCardsSequentially,
  getDealerDeckPosition,
  getCardDestination,
  createAnimationId
} from '../utils/cardDealing';

/**
 * Hook for managing card dealing animations
 * 
 * @param {Object} options
 * @param {HTMLElement} options.tableRef - Reference to poker table element
 * @param {Array} options.communityCards - Current community cards
 * @param {Array} options.playerHands - Current player hands {playerId, cards}
 * @param {number} options.delayBetweenCards - Delay between cards in ms (default: 150)
 * @param {number} options.animationDuration - Duration per card in ms (default: 600)
 * @returns {Object} { isDealing, dealtCardIds, dealCommunityCards, dealPlayerHand }
 */
export function useCardDealing({
  tableRef,
  communityCards = [],
  playerHands = [],
  delayBetweenCards = 150,
  animationDuration = 600
}) {
  const [isDealing, setIsDealing] = useState(false);
  const [dealtCardIds, setDealtCardIds] = useState(new Set());
  /** Cards that have been dealt and should show face-up (flip animation done). */
  const [flippedCardIds, setFlippedCardIds] = useState(new Set());
  const prevCommunityCardsRef = useRef([]);
  const prevPlayerHandsRef = useRef([]);
  const animationIdRef = useRef(null);
  const cardElementRefsRef = useRef(new Map());
  const communityFlipTimerRef = useRef(null);
  const dealtCardIdsRef = useRef(dealtCardIds);
  const communityCardsRef = useRef(communityCards);
  dealtCardIdsRef.current = dealtCardIds;
  communityCardsRef.current = communityCards;

  /**
   * Register a card element for animation
   * Cards must register themselves to be animated
   */
  const registerCardElement = useCallback((cardId, element) => {
    if (element) {
      cardElementRefsRef.current.set(cardId, element);
    } else {
      cardElementRefsRef.current.delete(cardId);
    }
  }, []);

  /**
   * Deal community cards (flop, turn, river)
   * Detects new cards and animates them sequentially
   */
  const dealCommunityCards = useCallback(async () => {
    if (!tableRef?.current) return;

    const currentCards = communityCardsRef.current || [];
    const prevCards = prevCommunityCardsRef.current || [];
    
    // Find new cards that need animation
    const newCardIndices = [];
    for (let i = prevCards.length; i < currentCards.length; i++) {
      newCardIndices.push(i);
    }

    if (newCardIndices.length === 0) {
      prevCommunityCardsRef.current = currentCards;
      return;
    }

    // Create unique animation ID to prevent duplicate animations
    const animationId = createAnimationId();
    animationIdRef.current = animationId;
    if (communityFlipTimerRef.current) {
      clearTimeout(communityFlipTimerRef.current);
      communityFlipTimerRef.current = null;
    }
    setIsDealing(true);

    try {
      const tableElement = tableRef.current;
      const dealerPos = getDealerDeckPosition(tableElement);
      
      // Get destination positions for community cards
      // Community cards fan slightly, then settle
      const communityCardsContainer = tableElement.querySelector('.community-cards');
      if (!communityCardsContainer) {
        prevCommunityCardsRef.current = currentCards;
        setIsDealing(false);
        return;
      }

      const cardElements = [];
      const toPositions = [];

      // Calculate positions for each new card
      for (const index of newCardIndices) {
        const cardId = `community_${index}`;
        const cardElement = cardElementRefsRef.current.get(cardId);
        
        if (cardElement) {
          cardElements.push(cardElement);
          const destPos = getCardDestination(cardElement);
          toPositions.push(destPos);
        }
      }

      if (cardElements.length > 0) {
        await dealCardsSequentially(
          cardElements,
          dealerPos,
          toPositions,
          delayBetweenCards,
          animationDuration
        );

        const newDealtIds = new Set(dealtCardIdsRef.current);
        newCardIndices.forEach(idx => {
          newDealtIds.add(`community_${idx}`);
        });
        setDealtCardIds(newDealtIds);

        /* Community cards: remain face-down briefly, then flip (professional reveal). */
        const communityIds = newCardIndices.map((idx) => `community_${idx}`);
        const flipDelay = 280;
        communityFlipTimerRef.current = setTimeout(() => {
          communityFlipTimerRef.current = null;
          setFlippedCardIds((prev) => {
            const next = new Set(prev);
            communityIds.forEach((id) => next.add(id));
            return next;
          });
        }, flipDelay);
      }

      prevCommunityCardsRef.current = currentCards;
    } catch (error) {
      console.error('Error dealing community cards:', error);
    } finally {
      // Only clear dealing state if this is still the current animation
      if (animationIdRef.current === animationId) {
        setIsDealing(false);
      }
    }
  }, [tableRef, delayBetweenCards, animationDuration]);

  /**
   * Deal cards to a specific player
   * Used for initial hand dealing
   */
  const dealPlayerHand = useCallback(async (playerId, cards) => {
    if (!tableRef?.current || !cards || cards.length === 0) return;

    const animationId = createAnimationId();
    animationIdRef.current = animationId;
    setIsDealing(true);

    try {
      const tableElement = tableRef.current;
      const dealerPos = getDealerDeckPosition(tableElement);
      
      const cardElements = [];
      const toPositions = [];

      // Get card elements for this player
      for (let i = 0; i < cards.length; i++) {
        const cardId = `player_${playerId}_${i}`;
        const cardElement = cardElementRefsRef.current.get(cardId);
        
        if (cardElement) {
          cardElements.push(cardElement);
          const destPos = getCardDestination(cardElement);
          toPositions.push(destPos);
        }
      }

      if (cardElements.length > 0) {
        await dealCardsSequentially(
          cardElements,
          dealerPos,
          toPositions,
          delayBetweenCards,
          animationDuration
        );

        const newDealtIds = new Set(dealtCardIdsRef.current);
        const playerCardIds = [];
        cards.forEach((_, idx) => {
          const id = `player_${playerId}_${idx}`;
          newDealtIds.add(id);
          playerCardIds.push(id);
        });
        setDealtCardIds(newDealtIds);

        /* My cards: dealt face-down, then flip face-up (fast, subtle, professional). */
        const flipDelay = 120;
        setTimeout(() => {
          setFlippedCardIds((prev) => {
            const next = new Set(prev);
            playerCardIds.forEach((id) => next.add(id));
            return next;
          });
        }, flipDelay);
      }
    } catch (error) {
      console.error('Error dealing player hand:', error);
    } finally {
      if (animationIdRef.current === animationId) {
        setIsDealing(false);
      }
    }
  }, [tableRef, delayBetweenCards, animationDuration]);

  const communityCardsLength = (communityCards || []).length;

  /* Reset flip state when a new hand starts (community cards cleared). */
  useEffect(() => {
    if (communityCardsLength === 0) {
      setFlippedCardIds(new Set());
    }
  }, [communityCardsLength]);

  /* Auto-deal community cards when count increases (flop/turn/river). Stable deps to avoid update loop. */
  useEffect(() => {
    if (communityCardsLength > 0) {
      dealCommunityCards();
    }
  }, [communityCardsLength, dealCommunityCards]);

  return {
    isDealing,
    dealtCardIds,
    flippedCardIds,
    registerCardElement,
    dealCommunityCards,
    dealPlayerHand
  };
}
