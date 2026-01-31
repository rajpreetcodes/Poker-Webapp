/**
 * Professional Card Dealing Animation System
 * 
 * Uses transform3d for 60fps performance and handles sequential card dealing
 * with realistic motion, rotation variance, and state safety.
 */

/**
 * Calculate the transform needed to slide a card from dealer position to destination
 * Uses translate3d for GPU acceleration and avoids layout reflow
 * 
 * @param {Object} fromPos - {x, y} dealer deck position in pixels
 * @param {Object} toPos - {x, y} destination position in pixels
 * @param {number} rotation - rotation in degrees (±2-4 for variance)
 * @returns {string} CSS transform string
 */
export function calculateCardTransform(fromPos, toPos, rotation = 0) {
  const deltaX = toPos.x - fromPos.x;
  const deltaY = toPos.y - fromPos.y;
  
  // Use translate3d for GPU acceleration (x, y, z)
  // z: 0 keeps it on the same plane, but enables hardware acceleration
  return `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${rotation}deg)`;
}

/**
 * Generate a slight rotation variance for realism
 * Cards don't land perfectly flat in real dealing
 * 
 * @param {number} index - Card index in sequence
 * @returns {number} Rotation in degrees (-4 to +4)
 */
export function getCardRotation(index) {
  // Use index to create deterministic but varied rotations
  // Alternates between slight left and right tilts
  const baseRotation = (index % 2 === 0 ? 1 : -1) * 2.5;
  const variance = (index % 3) * 0.8; // Small variance based on position
  return baseRotation + variance;
}

/**
 * Get dealer deck position (fixed origin point for all cards)
 * Positioned at top-center of table, slightly above
 * 
 * @param {HTMLElement} tableElement - The poker table DOM element
 * @returns {Object} {x, y} position in pixels relative to table
 */
export function getDealerDeckPosition(tableElement) {
  if (!tableElement) {
    // Fallback: center-top of viewport
    return { x: window.innerWidth / 2, y: 100 };
  }
  
  const rect = tableElement.getBoundingClientRect();
  // Position at top-center of table, slightly above
  return {
    x: rect.left + rect.width / 2,
    y: rect.top - 80 // Above the table
  };
}

/**
 * Get destination position for a card
 * 
 * @param {HTMLElement} targetElement - The target DOM element
 * @returns {Object} {x, y} position in pixels relative to viewport
 */
export function getCardDestination(targetElement) {
  if (!targetElement) {
    return { x: 0, y: 0 };
  }
  
  const rect = targetElement.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

/**
 * Deal a single card with animation
 * Creates CSS animation that slides from dealer to destination
 * 
 * @param {HTMLElement} cardElement - The card DOM element
 * @param {Object} fromPos - Dealer position {x, y}
 * @param {Object} toPos - Destination position {x, y}
 * @param {number} rotation - Rotation in degrees
 * @param {number} duration - Animation duration in ms (default: 600ms)
 * @param {string} easing - CSS easing function (default: cubic-bezier for smooth deceleration)
 * @returns {Promise} Resolves when animation completes
 */
export function dealCard(cardElement, fromPos, toPos, rotation, duration = 600, easing = 'cubic-bezier(0.4, 0, 0.2, 1)') {
  if (!cardElement) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    // Calculate transform values
    const deltaX = toPos.x - fromPos.x;
    const deltaY = toPos.y - fromPos.y;
    
    // Set initial position (at dealer deck)
    // Use transform instead of top/left to avoid layout reflow
    cardElement.style.transform = `translate3d(${-deltaX}px, ${-deltaY}px, 0) rotate(${-rotation}deg)`;
    cardElement.style.opacity = '0';
    cardElement.style.willChange = 'transform, opacity'; // Hint to browser for optimization
    cardElement.style.pointerEvents = 'none'; // Disable interaction during animation
    
    // Force reflow to ensure initial state is applied
    cardElement.offsetHeight;
    
    // Animate to destination
    requestAnimationFrame(() => {
      cardElement.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;
      cardElement.style.transform = `translate3d(0, 0, 0) rotate(${rotation}deg)`;
      cardElement.style.opacity = '1';
      
      // Clean up after animation
      const cleanup = () => {
        cardElement.style.willChange = 'auto';
        cardElement.style.pointerEvents = 'auto'; // Re-enable interaction
        cardElement.removeEventListener('transitionend', cleanup);
        resolve();
      };
      
      cardElement.addEventListener('transitionend', cleanup, { once: true });
      
      // Fallback timeout in case transitionend doesn't fire
      setTimeout(cleanup, duration + 50);
    });
  });
}

/**
 * Deal multiple cards sequentially with delays
 * Prevents all cards from animating at once for realistic dealing
 * 
 * @param {Array} cardElements - Array of card DOM elements
 * @param {Object} fromPos - Dealer position {x, y}
 * @param {Array} toPositions - Array of destination positions [{x, y}, ...]
 * @param {number} delayBetweenCards - Delay in ms between each card (default: 150ms)
 * @param {number} duration - Animation duration per card in ms (default: 600ms)
 * @returns {Promise} Resolves when all cards are dealt
 */
export async function dealCardsSequentially(cardElements, fromPos, toPositions, delayBetweenCards = 150, duration = 600) {
  const promises = [];
  
  for (let i = 0; i < cardElements.length; i++) {
    const cardElement = cardElements[i];
    const toPos = toPositions[i] || toPositions[0]; // Fallback to first position
    const rotation = getCardRotation(i);
    
    // Delay each card by index * delayBetweenCards
    const delay = i * delayBetweenCards;
    
    const promise = new Promise((resolve) => {
      setTimeout(() => {
        dealCard(cardElement, fromPos, toPos, rotation, duration).then(resolve);
      }, delay);
    });
    
    promises.push(promise);
  }
  
  return Promise.all(promises);
}

/**
 * Create a unique animation ID for tracking dealt cards
 * Prevents duplicate animations on fast re-renders
 */
export function createAnimationId() {
  return `deal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
