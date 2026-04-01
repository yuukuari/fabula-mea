import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { migrateFromSingleBook, migrateStorageKeys } from '@/lib/migration';

// Migrate localStorage keys from "ecrire-mon-livre-*" to "fabula-mea-*" (one-time)
migrateStorageKeys();
// Migrate existing single-book data to multi-book format (one-time)
migrateFromSingleBook();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
