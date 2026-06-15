import { createRoot } from 'react-dom/client';
import { App } from './App';
import './ui/ui.css';

// No StrictMode: it double-invokes effects in dev, which would init PixiJS twice.
createRoot(document.getElementById('root')!).render(<App />);
