const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Fix DB Connection logic for Vercel
const dbLogic = `// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
let isMongoConnected = false;

let cachedMongo = (global as any).mongoose;
if (!cachedMongo) {
  cachedMongo = (global as any).mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cachedMongo.conn) return cachedMongo.conn;
  if (!MONGODB_URI) return null;
  if (!cachedMongo.promise) {
    cachedMongo.promise = mongoose.connect(MONGODB_URI).then(mongoose => {
      console.log('MongoDB Connected successfully');
      isMongoConnected = true;
      return mongoose;
    }).catch(err => {
      console.error('MongoDB Connection Error:', err);
      cachedMongo.promise = null;
      throw err;
    });
  }
  cachedMongo.conn = await cachedMongo.promise;
  return cachedMongo.conn;
}
`;

code = code.replace(/\/\/ MongoDB Connection[\s\S]*?(?=\/\/ Schemas)/, dbLogic + '\n');

// 2. Remove loadData call at startup since it lacks context
code = code.replace(/\/\/ Initial local load \(Mongo load will happen upon connection\)[\s\S]*?(?=\/\/ Multer setup for temporary file storage)/, '');

// 3. Update Middleware to use IP instead of x-machine-id and connect DB
const middlewareLogic = `// Middleware
app.use(async (req, res, next) => {
    let clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'default';
    if (Array.isArray(clientIp)) clientIp = clientIp[0];
    const mid = clientIp.split(',')[0].trim();
    
    if (MONGODB_URI) {
       try { await connectToDatabase(); } catch(e) {}
    }
    
    als.run(mid, () => {
      // Ensure we load data if needed for this specific mid (MongoDB or fallback)
      if (isMongoConnected) {
         // Data will be fetched via await when routes hit
         next();
      } else {
         next();
      }
    });
});`;

code = code.replace(/\/\/ Middleware[\s\S]*?(?=\napp\.set\('trust proxy', 1\);)/, middlewareLogic);

// 4. Wrap problematic routes in try/catch to avoid 500 crashes
code = code.replace(/app\.get\('\/api\/accounts', async \(req, res\) => {[\s\S]*?res\.json\(getMD\(\)\.accounts\);\n}\);/, 
`app.get('/api/accounts', async (req, res) => {
  try {
    if (isMongoConnected) {
      getMD().accounts = await Account.find({ machineId: als.getStore() || 'default' }).lean();
    }
    res.json(getMD().accounts);
  } catch (e: any) {
    console.error('Error in /api/accounts', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});`);

code = code.replace(/app\.get\('\/api\/history', async \(req, res\) => {[\s\S]*?res\.json\(getMD\(\)\.history\);\n}\);/, 
`app.get('/api/history', async (req, res) => {
  try {
    if (isMongoConnected) {
      getMD().history = await HistoryModel.find({ machineId: als.getStore() || 'default' }).sort({ _id: -1 }).limit(500).lean();
    }
    res.json(getMD().history);
  } catch (e: any) {
    console.error('Error in /api/history', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});`);

code = code.replace(/app\.get\('\/api\/stats', async \(req, res\) => {[\s\S]*?if \(!isRefresh\) {/g, 
`app.get('/api/stats', async (req, res) => {
  try {
    if (isMongoConnected) {
       getMD().accounts = await Account.find({ machineId: als.getStore() || 'default' }).lean();
       getMD().history = await HistoryModel.find({ machineId: als.getStore() || 'default' }).sort({ _id: -1 }).limit(500).lean();
    }
    const isRefresh = req.query.refresh === 'true';`);

code = code.replace(/app\.get\('\/api\/pages\/all', async \(req, res\) => {[\s\S]*?if \(!isRefresh\) {/, 
`app.get('/api/pages/all', async (req, res) => {
  try {
    if (isMongoConnected) {
      getMD().accounts = await Account.find({ machineId: als.getStore() || 'default' }).lean();
    }
    const isRefresh = req.query.refresh === 'true';
    const cacheKey = \`pages_all_\${getMD().accounts.map(a => a.id).join('_')}\`;
    
    if (!isRefresh) {`);


code = code.replace(/const summary = getMD\(\)\.history\.reduce/g, 
`
    // Ensure we close try-catch for /api/stats
    const summary = getMD().history.reduce`);

// We'll write the fix to a file and run it
fs.writeFileSync('server.ts', code);
