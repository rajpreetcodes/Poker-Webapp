import { useState, useEffect } from 'react';
import socket from './socket';
import Lobby from './components/Lobby';
import Table from './components/Table';
import './App.css';

function App() {
  const [roomId, setRoomId] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [gameState, setGameState] = useState(null);
  const [handState, setHandState] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [myHand, setMyHand] = useState([]);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server');
      setMyPlayerId(socket.id);
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setIsConnected(false);
      setError('Failed to connect to server. Please make sure the server is running.');
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      setError(null);
    });

    socket.on('reconnect_attempt', () => {
      console.log('Attempting to reconnect...');
    });

    socket.on('reconnect_failed', () => {
      console.error('Reconnection failed');
      setError('Unable to reconnect to server. Please refresh the page.');
    });

    socket.on('roomCreated', ({ roomId }) => {
      setRoomId(roomId);
      setError(null);
    });

    socket.on('gameStateUpdate', (state) => {
      setGameState(state);
      if (state.roomId) {
        setRoomId(state.roomId);
      }
    });

    socket.on('handStateUpdate', (state) => {
      setHandState(state);
      if (state.myHand) {
        setMyHand(state.myHand);
      }
      if (state.myPlayerId) {
        setMyPlayerId(state.myPlayerId);
      }
    });

    socket.on('error', ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 5000);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('reconnect');
      socket.off('reconnect_attempt');
      socket.off('reconnect_failed');
      socket.off('roomCreated');
      socket.off('gameStateUpdate');
      socket.off('handStateUpdate');
      socket.off('error');
    };
  }, []);

  const handleJoinRoom = (name, id) => {
    setPlayerName(name);
    if (id) {
      socket.emit('joinRoom', { roomId: id, playerName: name });
    } else {
      socket.emit('createRoom', { playerName: name });
    }
  };

  return (
    <div className="app">
      {/* Connection status only in Lobby - when in room it's shown inside table header */}
      {!roomId && (
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      )}
      {error && <div className="error-message">{error}</div>}
      {!isConnected && !roomId && (
        <div className="connection-warning">
          <p>Connecting to server...</p>
          <p className="hint">Make sure the server is running on http://localhost:3001</p>
        </div>
      )}
      {!roomId ? (
        <Lobby onJoinRoom={handleJoinRoom} isConnected={isConnected} />
      ) : (
        <Table
          gameState={gameState}
          handState={handState}
          myPlayerId={myPlayerId}
          myHand={myHand}
          playerName={playerName}
          isConnected={isConnected}
        />
      )}
    </div>
  );
}

export default App;
