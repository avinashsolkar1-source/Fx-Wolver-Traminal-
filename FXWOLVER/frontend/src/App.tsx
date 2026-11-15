import React from 'react';
import MainLayout from './components/Layout/MainLayout';
import { useWebSocket } from './hooks/useWebSocket';

export default function App() {
  // Establish and maintain the WebSocket connection for the entire session
  useWebSocket();

  return <MainLayout />;
}
