const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf-8');

// The stats block is broken and also needs cacheKey definition
content = content.replace(/app\.get\('\/api\/stats', async \(req, res\) => {[\s\S]*?res\.json\(stats\);\n}\);/g, 
`app.get('/api/stats', async (req, res) => {
  try {
    if (isMongoConnected) {
       getMD().accounts = await Account.find({ machineId: als.getStore() || 'default' }).lean();
       getMD().history = await HistoryModel.find({ machineId: als.getStore() || 'default' }).sort({ _id: -1 }).limit(500).lean();
    }
    const isRefresh = req.query.refresh === 'true';
    const cacheKey = \`stats_\${getMD().accounts.map(a => a.id).join('_')}\`;
    const cachedData = getFromCache(cacheKey);
    if (!isRefresh && cachedData) return res.json(cachedData);

    const today = new Date().toISOString().split('T')[0];
    const uploadedToday = getMD().history.filter(h => h.timestamp.startsWith(today) && h.status === 'success').length;
    
    let totalFollowers = 0;
    let totalPages = 0;
    
    const ax = getAxiosInstance();
    const promises = getMD().accounts.map(async (account) => {
      try {
        const response = await ax.get(\`https://graph.facebook.com/\${FB_API_VERSION}/me/accounts\`, {
          params: { access_token: account.access_token, fields: 'fan_count,followers_count' }
        });
        return response.data.data;
      } catch (e) {
        return [];
      }
    });

    const results = await Promise.all(promises);
    const pagesData = results.flat();
    pagesData.forEach((p: any) => {
      totalPages++;
      totalFollowers += (p.followers_count || p.fan_count || 0);
    });

    const stats = {
      accounts: getMD().accounts.length,
      pages: totalPages, 
      reach: "0", 
      flow: totalFollowers.toLocaleString(),
      uploadedToday,
      views: "0",
      trends: {
        reach: "0%",
        flow: "0%",
        views: "0%"
      }
    };

    setCache(cacheKey, stats);
    res.json(stats);
  } catch (e) {
    console.error('Stats error:', e);
    res.status(500).json({ error: 'Stats error' });
  }
});`);

// Fix duplicate 'getMD().accounts' keys
content = content.replace(/getMD\(\)\.accounts: getMD\(\)\.accounts\.length,/g, "accounts: getMD().accounts.length,");

fs.writeFileSync('server.ts', content);
