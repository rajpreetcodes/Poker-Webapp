# Texas Hold'em Poker Web Application

A real-time multiplayer Texas Hold'em poker game with AI bots, built with Node.js, Express, Socket.IO, and React.

![Poker Game](https://img.shields.io/badge/Game-Poker-green)
![Node.js](https://img.shields.io/badge/Node.js-v16+-blue)
![React](https://img.shields.io/badge/React-18-blue)

## Features

### Core Gameplay
- ✅ **Real-time Multiplayer**: Play with friends using Socket.IO
- ✅ **AI Bots**: Add intelligent bots with different personalities
- ✅ **Side Pot Logic**: Proper handling of all-in scenarios with multiple pots
- ✅ **Turn Timer**: 30-second timer to prevent game stalls
- ✅ **Minimum Raise Validation**: 20 chips preflop, 10 chips post-flop

### UI/UX
- ✅ **Professional Poker Table**: Realistic felt design with smooth animations
- ✅ **Card Dealing Animations**: Smooth card dealing from dealer to players
- ✅ **Live Action Log**: Real-time game log showing all player actions
- ✅ **Responsive Design**: Works on desktop and tablet devices
- ✅ **Exit Button**: Easy return to lobby

### Technical Features
- ✅ **WebSocket Communication**: Real-time bidirectional communication
- ✅ **Room-based Games**: Create or join specific game rooms
- ✅ **Bot Fallback Logic**: Bots automatically adjust invalid actions
- ✅ **Error Handling**: Robust error handling for edge cases

## Tech Stack

**Backend:**
- Node.js
- Express.js
- Socket.IO

**Frontend:**
- React 18
- Vite
- Socket.IO Client

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/poker-webapp.git
   cd poker-webapp
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd server && npm install
   cd ../client && npm install
   cd ..
   ```

3. **Run the application**
   ```bash
   npm run dev
   ```

   This will start:
   - Server on `http://localhost:3001`
   - Client on `http://localhost:5173`

4. **Open your browser**
   Navigate to `http://localhost:5173`

## Project Structure

```
poker-webapp/
├── server/
│   ├── server.js       # Main server file with Socket.IO logic
│   ├── game.js         # Game logic (Player, Deck, HandState, PotManager)
│   ├── bot.js          # Bot AI logic
│   └── evaluate.js     # Hand evaluation logic
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Lobby.jsx    # Room creation/joining
│   │   │   ├── Table.jsx    # Main game table
│   │   │   └── Table.css    # Poker table styles
│   │   ├── hooks/
│   │   │   └── useCardDealing.js  # Card animation logic
│   │   ├── App.jsx          # Main app component
│   │   └── socket.js        # Socket.IO client setup
│   └── public/
│       └── cards/           # Card images
├── scripts/
│   └── test-side-pots.js    # Unit tests for side pot logic
└── package.json
```

## How to Play

1. **Create or Join a Room**
   - Enter your player name
   - Create a new room or join an existing one with a Room ID

2. **Add Bots (Optional)**
   - Click "+ Add Bot" to add AI players
   - Bots have different personalities (aggressive, passive, etc.)

3. **Start the Game**
   - Click "Start Game" when ready
   - Minimum 2 players required

4. **Game Actions**
   - **Fold**: Give up your hand
   - **Check**: Pass the action (when no bet to call)
   - **Call**: Match the current bet
   - **Raise**: Increase the bet (minimum 20 preflop, 10 post-flop)
   - **All-In**: Bet all your chips

5. **Exit Game**
   - Click "Exit Game" button to return to lobby

## Game Rules

- **Starting Chips**: 1000 per player
- **Blinds**: Small blind 10, Big blind 20
- **Betting Rounds**: Preflop, Flop, Turn, River
- **Turn Timer**: 30 seconds per action
- **Minimum Raise**: 20 chips preflop, 10 chips post-flop

## Development

### Running Tests
```bash
node scripts/test-side-pots.js
```

### Building for Production
```bash
cd client
npm run build
```

## Known Issues & Future Improvements

- [ ] Add authentication system
- [ ] Implement database for persistent game history
- [ ] Add tournament mode
- [ ] Mobile responsive design improvements
- [ ] Add sound effects
- [ ] Implement chat system

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for learning or personal use.

## Credits

Created by [Your Name]

Card images from [source]

## Support

For issues or questions, please open an issue on GitHub.
