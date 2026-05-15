import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tokens.css';
import App from './App';
import { UserAuthProvider } from './lib/UserAuthContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <UserAuthProvider>
    <App />
  </UserAuthProvider>
);
