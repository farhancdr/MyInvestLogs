import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './index.css';

/**
 * shadcn switches theme on a `.dark` class rather than a media query, so the
 * OS preference has to be mirrored onto the root element.
 */
const media = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = (dark: boolean) =>
  document.documentElement.classList.toggle('dark', dark);

applyTheme(media.matches);
media.addEventListener('change', (e) => applyTheme(e.matches));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
