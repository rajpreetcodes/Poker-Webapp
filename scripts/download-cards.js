// Script to download card images from a free source
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suits = ['S', 'H', 'D', 'C']; // Spades, Hearts, Diamonds, Clubs
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Using a free card image API - using code.google.com archive or similar
// Alternative: Using a simple SVG-based approach or downloading from a reliable source
const cardsDir = path.join(__dirname, '../client/public/cards');

// Create cards directory if it doesn't exist
if (!fs.existsSync(cardsDir)) {
  fs.mkdirSync(cardsDir, { recursive: true });
}

// Function to create SVG card images
function createCardSVG(rank, suit) {
  const suitSymbols = {
    'S': { symbol: '♠', color: 'black' },
    'H': { symbol: '♥', color: 'red' },
    'D': { symbol: '♦', color: 'red' },
    'C': { symbol: '♣', color: 'black' }
  };

  const suitInfo = suitSymbols[suit];
  const isRed = suitInfo.color === 'red';
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="140" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="140" height="200" fill="white" stroke="${isRed ? '#d32f2f' : '#212121'}" stroke-width="2" rx="8"/>
  <text x="10" y="30" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${isRed ? '#d32f2f' : '#212121'}">${rank}</text>
  <text x="10" y="55" font-family="Arial, sans-serif" font-size="32" fill="${isRed ? '#d32f2f' : '#212121'}">${suitInfo.symbol}</text>
  <text x="130" y="190" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${isRed ? '#d32f2f' : '#212121'}" text-anchor="end">${rank}</text>
  <text x="130" y="165" font-family="Arial, sans-serif" font-size="32" fill="${isRed ? '#d32f2f' : '#212121'}" text-anchor="end">${suitInfo.symbol}</text>
  <text x="70" y="110" font-family="Arial, sans-serif" font-size="64" fill="${isRed ? '#d32f2f' : '#212121'}" text-anchor="middle" dominant-baseline="middle">${suitInfo.symbol}</text>
</svg>`;
}

// Create all card images
console.log('Creating card images...');
for (const suit of suits) {
  for (const rank of ranks) {
    const filename = `${rank}${suit}.svg`;
    const filepath = path.join(cardsDir, filename);
    const svg = createCardSVG(rank, suit);
    fs.writeFileSync(filepath, svg);
    console.log(`Created: ${filename}`);
  }
}

// Create card back
const cardBackSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="140" height="200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="backPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <rect width="20" height="20" fill="#1a237e"/>
      <circle cx="10" cy="10" r="8" fill="#283593" opacity="0.3"/>
    </pattern>
  </defs>
  <rect width="140" height="200" fill="url(#backPattern)" stroke="#0d47a1" stroke-width="2" rx="8"/>
  <text x="70" y="100" font-family="Arial, sans-serif" font-size="48" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.8">♠</text>
</svg>`;

fs.writeFileSync(path.join(cardsDir, 'back.svg'), cardBackSVG);
console.log('Created: back.svg');

console.log('\nAll card images created successfully!');
