const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const webhookPatch = `
// Middleware
let webhookSetUrl = '';
app.use(async (req, res, next) => {
    if (MONGODB_URI) {
       try { await connectToDatabase(); } catch(e) {}
    }

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    if (host && !host.includes('localhost')) {
       const currentUrl = \`\${protocol}://\${host}/api/telegram/webhook\`;
       if (webhookSetUrl !== currentUrl) {
           webhookSetUrl = currentUrl;
           try {
              const ax = require('axios').default;
              ax.post(\`https://api.telegram.org/bot8681414506:AAF5y22jn9namCG-7MEQxFX4WqOyeauyM14/setWebhook\`, { url: currentUrl })
                .then(()=>console.log('Webhook set to', currentUrl))
                .catch(()=>console.log('Webhook set failed'));
           } catch(e) {}
       }
    }
    
    // Try to get auth token
`;

code = code.replace(/\/\/ Middleware[\s\S]*?\/\/ Try to get auth token/, webhookPatch);

fs.writeFileSync('server.ts', code);
