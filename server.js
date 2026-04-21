// ============================================================
// server.js — Local dev server with Supabase API proxy
// Serves static files + proxies Management API calls to bypass CORS
// ============================================================

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const mimeTypes = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.sql': 'text/plain', '.webp': 'image/webp', '.mp4': 'video/mp4',
};

function proxyToSupabase(options, postData, res) {
    const proxyReq = https.request(options, proxyRes => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
            res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(data);
        });
    });
    proxyReq.on('error', err => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    });
    if (postData) proxyReq.write(postData);
    proxyReq.end();
}

const server = http.createServer((req, res) => {
    // ── Proxy: Execute SQL via Management API ──────────────
    if (req.url === '/api/execute-sql' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { ref, accessToken, query } = JSON.parse(body);
                const postData = JSON.stringify({ query });
                proxyToSupabase({
                    hostname: 'api.supabase.com',
                    path: `/v1/projects/${ref}/database/query`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Length': Buffer.byteLength(postData)
                    }
                }, postData, res);
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid request body' }));
            }
        });
        return;
    }

    // ── Proxy: Test access token ──────────────────────────
    if (req.url.startsWith('/api/supabase-project/') && req.method === 'GET') {
        const ref = req.url.split('/api/supabase-project/')[1];
        const token = (req.headers['authorization'] || '').replace('Bearer ', '');
        proxyToSupabase({
            hostname: 'api.supabase.com',
            path: `/v1/projects/${ref}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        }, null, res);
        return;
    }

    // ── Write Supabase config into js/supabase.js (called after installation) ──
    if (req.url === '/api/write-supabase-config' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const configData = JSON.parse(body);
                const supabasePath = path.join(__dirname, 'js', 'supabase.js');
                let content = fs.readFileSync(supabasePath, 'utf8');

                // Build the config object to embed
                const embeddedConfig = JSON.stringify({
                    url: configData.url || '',
                    anon_key: configData.anon_key || '',
                    service_key: configData.service_key || ''
                });

                // Replace the INSTALLED_CONFIG line
                content = content.replace(
                    /const INSTALLED_CONFIG = \{[^}]*\};/,
                    `const INSTALLED_CONFIG = ${embeddedConfig};`
                );

                fs.writeFileSync(supabasePath, content, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // ── Static file serving ───────────────────────────────
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(err.code === 'ENOENT' ? 404 : 500);
            res.end(err.code === 'ENOENT' ? 'Not Found' : 'Server Error');
        } else {
            // Auto-inject config embed script into HTML pages if config is empty
            if (ext === '.html' && needsConfigEmbed()) {
                let html = data.toString('utf8');
                const embedScript = `
<script>
(function(){
  var c;try{c=JSON.parse(localStorage.getItem('supabase_config'));}catch(e){}
  if(c&&c.url&&c.anon_key){
    fetch('/api/write-supabase-config',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({url:c.url,anon_key:c.anon_key,service_key:c.service_key||''})
    }).then(function(r){return r.json();}).then(function(d){
      if(d.success){console.log('✅ Config auto-embedded into supabase.js');location.reload();}
    }).catch(function(){});
  }
})();
</script>`;
                html = html.replace('</body>', embedScript + '\n</body>');
                res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
                res.end(html);
            } else {
                res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
                res.end(data);
            }
        }
    });
});

// Check if supabase.js INSTALLED_CONFIG is empty (needs credentials)
function needsConfigEmbed() {
    try {
        const content = fs.readFileSync(path.join(__dirname, 'js', 'supabase.js'), 'utf8');
        const match = content.match(/INSTALLED_CONFIG\s*=\s*(\{[^}]+\})/);
        if (match) {
            const config = JSON.parse(match[1]);
            return !config.url; // needs embed if URL is empty
        }
        return true;
    } catch (e) {
        return false;
    }
}

server.listen(PORT, () => {
    console.log(`\n  🚀 Server running at http://127.0.0.1:${PORT}`);
    console.log(`  📦 Install:  http://127.0.0.1:${PORT}/install.html`);
    if (needsConfigEmbed()) {
        console.log(`\n  ⚠️  Supabase config belum ter-embed di js/supabase.js`);
        console.log(`  📌 Buka http://127.0.0.1:${PORT} di browser admin untuk auto-embed.\n`);
    } else {
        console.log(`  ✅ Supabase config sudah ter-embed di js/supabase.js\n`);
    }
});
