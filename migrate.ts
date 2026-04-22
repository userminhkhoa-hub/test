import { Project } from "ts-morph";

const project = new Project();
project.addSourceFileAtPath("server.ts");
const sourceFile = project.getSourceFileOrThrow("server.ts");

// 1. Add AsyncLocalStorage to top
sourceFile.addImportDeclaration({
    moduleSpecifier: "async_hooks",
    namedImports: ["AsyncLocalStorage"]
});

// Add ALS and map
const code = `
export const als = new AsyncLocalStorage<string>();

const machineDataMap = new Map<string, { accounts: any[], history: any[], settings: any }>();
export function getMD() {
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
    return machineDataMap.get(mid)!;
}
`;
sourceFile.insertText(sourceFile.getVariableStatement("DATA_FILE")!.getEnd(), code);

// Remove the global variables `accounts`, `history`, `settings`
sourceFile.getVariableStatement("accounts")!.remove();
sourceFile.getVariableStatement("history")!.remove();
sourceFile.getVariableStatement("settings")!.remove();

// Replace all usages natively using regex in text, then save
const beforeText = sourceFile.getFullText();
let afterText = beforeText;

// Replace assignments
afterText = afterText.replace(/\baccounts\s*=\s*(.*?);/g, "getMD().accounts = $1;");
afterText = afterText.replace(/\bhistory\s*=\s*(.*?);/g, "getMD().history = $1;");
afterText = afterText.replace(/\bsettings\s*=\s*(.*?);/g, "getMD().settings = $1;");
afterText = afterText.replace(/\bsettings\.([a-zA-Z0-9_]+)\s*=\s*(.*?);/g, "getMD().settings.$1 = $2;");

// Replace reads
afterText = afterText.replace(/\baccounts\b/g, "getMD().accounts");
afterText = afterText.replace(/\bhistory\b/g, "getMD().history");
afterText = afterText.replace(/\bsettings\b/g, "getMD().settings");

// Fix getters setup itself
afterText = afterText.replace(/getMD\(\)\.accounts: any\[\]/g, "accounts: any[]");
afterText = afterText.replace(/getMD\(\)\.history: any\[\]/g, "history: any[]");
afterText = afterText.replace(/getMD\(\)\.settings: any =/g, "settings:");

// 2. Add middleware
afterText = afterText.replace('// Middleware', `
// Middleware
app.use((req, res, next) => {
    const mid = req.headers['x-machine-id'] as string || 'default';
    als.run(mid, () => next());
});
`);

// 3. Mongo schemas
afterText = afterText.replace(/const AccountSchema = new mongoose\.Schema\({/g, "const AccountSchema = new mongoose.Schema({ machineId: String,");
afterText = afterText.replace(/const HistorySchema = new mongoose\.Schema\({/g, "const HistorySchema = new mongoose.Schema({ machineId: String,");
afterText = afterText.replace(/const SettingsSchema = new mongoose\.Schema\({/g, "const SettingsSchema = new mongoose.Schema({ machineId: String,");

// Update mongoose queries to include machineId
afterText = afterText.replace(/Account\.find\(\)/g, "Account.find({ machineId: als.getStore() || 'default' })");
afterText = afterText.replace(/HistoryModel\.find\(\)/g, "HistoryModel.find({ machineId: als.getStore() || 'default' })");
afterText = afterText.replace(/Settings\.findOne\({ key: 'main' }\)/g, "Settings.findOne({ key: 'main', machineId: als.getStore() || 'default' })");
afterText = afterText.replace(/Settings\.findOneAndUpdate\({ key: 'main' }/g, "Settings.findOneAndUpdate({ key: 'main', machineId: als.getStore() || 'default' }");

// Handle Account save/create
afterText = afterText.replace(/const newHist = new HistoryModel\(historyItem\);/g, "const newHist = new HistoryModel({ ...historyItem, machineId: als.getStore() || 'default' });");

// Fix other object instantiations if any
afterText = afterText.replace(/new Account\((.*?)\)/g, "new Account({ ...($1), machineId: als.getStore() || 'default' })");

import fs from "fs";
fs.writeFileSync("server.ts", afterText);
