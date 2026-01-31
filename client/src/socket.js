import { io } from 'socket.io-client';

// Use environment variable for production, fallback to localhost for development
// VITE_SERVER_URL should be set in deployment environment variables
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const socket = io(SERVER_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  timeout: 20000,
  transports: ['websocket', 'polling']
});

// Log connection status for debugging
socket.on('connect', () => {
  console.log('Connected to server:', SERVER_URL);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});

export default socket;
