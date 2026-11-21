import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {initApiBaseFromQueryAndInstallFetchBridge} from './utils/apiBase';
import {AppErrorBoundary} from './components/AppErrorBoundary';

initApiBaseFromQueryAndInstallFetchBridge();

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
