import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
// Hash routing only (design §4.11): `#/p/<project id>` in Phase 2; Phase 1 has one local project.
createRoot(document.getElementById('root')!).render(<App />);
