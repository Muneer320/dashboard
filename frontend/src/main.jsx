import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tokens.css';
import App from './App';
import { UserAuthProvider } from './lib/UserAuthContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <UserAuthProvider>
    <aside role="note" style={{position:'relative',zIndex:50,padding:'10px 16px',background:'#2d2144',color:'#f1efe8',font:'13px/1.5 system-ui',textAlign:'center'}}>
      Historical archive of Ascent 2026. Participant services and checkout are closed. Explore the source; do not enter real personal data.
    </aside>
    <App />
  </UserAuthProvider>
);
