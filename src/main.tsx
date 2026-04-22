import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Setup machine ID for per-device data isolation
if (!localStorage.getItem('ais_machine_id')) {
  const newId = Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join('');
  localStorage.setItem('ais_machine_id', newId);
}
const machineId = localStorage.getItem('ais_machine_id') || 'default';


const originalFetch = window.fetch;
window.fetch = async function (...args) {
  let [resource, config] = args;
  
  if (typeof resource === 'string' && resource.startsWith('/api')) {
    config = config || {};
    config.headers = config.headers || {};
    
    const token = localStorage.getItem('auth_token');
    if (token) {
       if (config.headers instanceof Headers) {
          config.headers.append('Authorization', 'Bearer ' + token);
       } else {
          (config.headers as any)['Authorization'] = 'Bearer ' + token;
       }
    }
    
    return originalFetch.call(this, resource, config);
  }
  
  return originalFetch.call(this, ...args);
};
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
