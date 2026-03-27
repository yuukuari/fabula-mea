import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { migrateFromSingleBook } from '@/lib/migration';

// Migrate existing single-book data to multi-book format (one-time)
migrateFromSingleBook();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
