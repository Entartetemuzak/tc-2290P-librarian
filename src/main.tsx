import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AppProvider from './state/AppProvider';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('The page has no #root element.');

createRoot(root).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
