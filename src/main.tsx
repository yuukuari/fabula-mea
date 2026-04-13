import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { migrateFromSingleBook, migrateStorageKeys } from '@/lib/migration';
import { hasSpotifyConfig } from '@/lib/spotify';

// Spotify requires 127.0.0.1 (not "localhost") for local dev redirect URIs.
// Redirect so both main window and OAuth popup share the same origin.
if (hasSpotifyConfig && window.location.hostname === 'localhost') {
  window.location.replace(
    window.location.href.replace('//localhost', '//127.0.0.1'),
  );
}

// Migrate localStorage keys from "ecrire-mon-livre-*" to "fabula-mea-*" (one-time)
migrateStorageKeys();
// Migrate existing single-book data to multi-book format (one-time)
migrateFromSingleBook();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
