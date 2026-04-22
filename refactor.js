const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// 1. Setup AsyncLocalStorage
const setupCode = `import { AsyncLocalStorage } from 'async_hooks';
const als = new AsyncLocalStorage<string>();

const machineDataMap = new Map<string, any>();
function getMD() {
  const mid = als.getStore() || 'default';
  if (!machineDataMap.has(mid)) {
    machineDataMap.set(mid, {
      accounts: [],
      history: [],
      settings: {
        proxy: { enabled: false, format: '', data: null as any },
        telegram: { enabled: false, botToken: '', chatId: '' },
        uploadDelay: { enabled: true, seconds: 30 }
      }
    });
  }
  return machineDataMap.get(mid);
}

const getAccounts = () => getMD().accounts;
const setAccounts = (v: any) => getMD().accounts = v;
const getHistory = () => getMD().history;
const setHistory = (v: any) => getMD().history = v;
const getSettings = () => getMD().settings;
const setSettings = (v: any) => getMD().settings = v;
`;

code = code.replace(/const DATA_FILE[\s\S]*?uploadDelay: \{ enabled: true, seconds: 30 \}\n\};\n/, setupCode);

// 2. Add middleware to run inside ALS
const middlewareCode = `app.use((req, res, next) => {
  const machineId = req.headers['x-machine-id'] as string || 'default';
  als.run(machineId, () => {
    next();
  });
});\n\n// Middleware`;
code = code.replace('// Middleware', middlewareCode);

// 3. Replace accounts
code = code.replace(/\baccounts\s*=\s*([^;]+);/g, 'setAccounts($1);');
code = code.replace(/\baccounts\b/g, 'getAccounts()');
// fix our own declarations that were just replaced
code = code.replace(/let getAccounts\(\)/g, ''); // just in case
code = code.replace(/const getAccounts\(\)/g, "const getAccounts"); // fix getter

// 4. Replace history
code = code.replace(/\bhistory\s*=\s*([^;]+);/g, 'setHistory($1);');
code = code.replace(/\bhistory\b/g, 'getHistory()');

// 5. Replace settings
code = code.replace(/\bsettings\s*=\s*([^;]+);/g, 'setSettings($1);');
code = code.replace(/\bsettings\.([a-zA-Z0-9_]+)\s*=\s*([^;]+);/g, 'getSettings().$1 = $2;');
code = code.replace(/\bsettings\b/g, 'getSettings()');

// Fix the exact strings in get/set definitions
code = code.replace(/const getAccounts = \(\) => getMD\(\)\.getAccounts\(\);/g, 'const getAccounts = () => getMD().accounts;');
code = code.replace(/const setAccounts = \(v: any\) => getMD\(\)\.getAccounts\(\) = v;/g, 'const setAccounts = (v: any) => getMD().accounts = v;');
code = code.replace(/const getHistory = \(\) => getMD\(\)\.getHistory\(\);/g, 'const getHistory = () => getMD().history;');
code = code.replace(/const setHistory = \(v: any\) => getMD\(\)\.getHistory\(\) = v;/g, 'const setHistory = (v: any) => getMD().history = v;');
code = code.replace(/const getSettings = \(\) => getMD\(\)\.getSettings\(\);/g, 'const getSettings = () => getMD().settings;');
code = code.replace(/const setSettings = \(v: any\) => getMD\(\)\.getSettings\(\) = v;/g, 'const setSettings = (v: any) => getMD().settings = v;');

// 6. Schemas
// Add machineId to schemas
code = code.replace(/const AccountSchema = new mongoose.Schema\({/, "const AccountSchema = new mongoose.Schema({ machineId: { type: String, required: true },");
code = code.replace(/const HistorySchema = new mongoose.Schema\({/, "const HistorySchema = new mongoose.Schema({ machineId: { type: String, required: true },");
code = code.replace(/const SettingsSchema = new mongoose.Schema\({/, "const SettingsSchema = new mongoose.Schema({ machineId: { type: String, required: true },");

fs.writeFileSync('server_refactored.ts', code);
