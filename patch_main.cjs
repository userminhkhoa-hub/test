const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

const fetchPatch = `
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
`;

code = code.replace(/const originalFetch[\s\S]*?(?=createRoot)/, fetchPatch);
fs.writeFileSync('src/main.tsx', code);
