import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

content = content.replace(/getMD\(\)\.getMD\(\)\./g, 'getMD().');
content = content.replace(/'\/api\/getMD\(\)\.accounts(.*?)/g, "'/api/accounts$1");
content = content.replace(/`https:\/\/graph\.facebook\.com\/\$\{FB_API_VERSION\}\/me\/getMD\(\)\.accounts`/g, "`https://graph.facebook.com/${FB_API_VERSION}/me/accounts`");

fs.writeFileSync('server.ts', content);
