const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 4000;
const clients = new Set();
const publicDir = path.join(__dirname, '../public');

function sendEvent(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function handleSSE(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('\n');
  clients.add(res);
  req.on('close', () => {
    clients.delete(res);
  });
}

function broadcast(event) {
  for (const client of clients) {
    sendEvent(client, event);
  }
}

function runAgent() {
  broadcast({ type: 'status', message: 'Analyzing request...' });
  const command = 'ls';
  const args = ['-la'];
  broadcast({ type: 'command', message: `${command} ${args.join(' ')}` });
  const proc = spawn(command, args, { cwd: path.resolve(__dirname, '..') });
  proc.stdout.on('data', (data) => {
    broadcast({ type: 'stdout', message: data.toString() });
  });
  proc.stderr.on('data', (data) => {
    broadcast({ type: 'stderr', message: data.toString() });
  });
  proc.on('close', (code) => {
    broadcast({ type: 'complete', message: `Finished with code ${code}` });
  });
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (err) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/events') {
    return handleSSE(req, res);
  }
  if (req.url === '/api/run' && req.method === 'POST') {
    await parseBody(req);
    runAgent();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  const filePath = req.url === '/' ? path.join(publicDir, 'index.html') : path.join(publicDir, req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const type = ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'text/html';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
