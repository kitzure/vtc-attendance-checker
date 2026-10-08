import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const args = process.argv.slice(2);
const param = name => args[args.indexOf(name) + 1];
if (args.includes('--summary') && args.includes('--details')) {
  const summaries = JSON.parse(await readFile(param('--summary'), 'utf8'));
  const details = JSON.parse(await readFile(param('--details'), 'utf8'));
  const data = { modules: summaries.map(s => ({ value: s.moduleCode, text: s.moduleText })), details,
    fallbackTotals: Object.fromEntries(summaries.map(s => [s.moduleCode, s.calendarScheduledHours])),
    calendarEvents: [], calendarAvailable: false, preview: true,
    scrapedAt: args.includes('--date') ? param('--date') : new Date().toISOString() };
  await mkdir(path.join(root, '.local-preview'), { recursive: true });
  await writeFile(path.join(root, '.local-preview/data.json'), JSON.stringify(data));
}
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/dashboard-preview.html' : url.pathname));
    if (!target.startsWith(root + path.sep) || /(?:^|[\\/])\.git(?:[\\/]|$)/.test(target)) { res.writeHead(403); res.end(); return; }
    const content = await readFile(target);
    res.writeHead(200, { 'Content-Type': (types[path.extname(target)] || 'application/octet-stream') + ';charset=utf-8', 'Cache-Control': 'no-store' }); res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
});
const port = args.includes('--port') ? +param('--port') : 4173;
server.listen(port, '127.0.0.1', () => console.log(`Dashboard preview: http://127.0.0.1:${port}`));
