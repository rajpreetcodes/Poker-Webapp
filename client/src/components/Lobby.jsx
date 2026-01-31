import { useState } from 'react';
import './Lobby.css';

function Lobby({ onJoinRoom, isConnected }) {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (playerName.trim()) {
      onJoinRoom(playerName.trim(), null);
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (playerName.trim() && roomId.trim()) {
      onJoinRoom(playerName.trim(), roomId.trim().toUpperCase());
    }
  };

  return (
    <div className="lobby">
      <div className="lobby-container">
        <h1>Texas Hold'em Poker</h1>
        <div className="lobby-form">
          <div className="form-group">
            <label htmlFor="playerName">Player Name:</label>
            <input
              type="text"
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
            />
          </div>
          <div className="form-group">
            <label htmlFor="roomId">Room ID (optional):</label>
            <input
              type="text"
              id="roomId"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="Enter room ID to join"
              maxLength={6}
            />
          </div>
          <div className="button-group">
            <button 
              onClick={handleCreateRoom} 
              className="btn btn-primary"
              disabled={!isConnected}
            >
              Create Room
            </button>
            <button 
              onClick={handleJoinRoom} 
              className="btn btn-secondary"
              disabled={!isConnected}
            >
              Join Room
            </button>
          </div>
          {!isConnected && (
            <p className="connection-hint">Please wait for connection to server...</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Lobby;
