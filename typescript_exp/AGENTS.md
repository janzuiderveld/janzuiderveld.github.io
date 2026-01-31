# Repository Guidelines

The concept of this website is that EVERYTHING is rendered on a grid of monospaced characters. The whole site is ASCII art. Always remain in this style, including images, buttons, and other UI elements, unless explicitly instructed otherwise. A future build could include a photorealistic representation of the website, accessible at any moment, and triggered by clicking on any ASCII art.

ALWAYS check the outcome of your work with the Chrome DevTools MCP server. The project is served on http://localhost:3000 (HashRouter → use `#/…` routes).

## Chrome DevTools MCP reset + usage (do exactly this)
1) Kill only the MCP server and the Chrome it launched (regular Chrome is safe):
   - `pkill -f chrome-devtools-mcp`
   - `pkill -f '/chrome-devtools-mcp/chrome-profile'` (optional if helpers linger)
2) Clear stale locks (no data loss):
   - `rm -f ~/.cache/chrome-devtools-mcp/chrome-profile/Singleton* 2>/dev/null || true`
3) Start a fresh isolated session (temp profile auto-cleans):
   - `npx chrome-devtools-mcp@latest --headless --isolated --viewport 1280x720 --logFile /tmp/mcp-devtools.log`
   - Also run a 9:16 viewport for mobile checks (e.g., `--viewport 900x1600`).
4) Use MCP tools to load the page (HashRouter!):
   - Call `new_page` with `url: "http://localhost:3000/#/about"` (or the route you are testing). For home use `http://localhost:3000/#/`.
   - Wait ~1s before `take_screenshot` so the client render finishes.

### If tools say “Transport closed”
- Make sure steps 1–3 ran first; stale MCP/Chrome processes can block.
- Keep Node >= 20.19.0 (Node 23.7.0 works) and Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- Check `/tmp/mcp-devtools.log` for launch issues.

### Quick one-liner capture (hash route)
**IMPORTANT**: The script MUST call `process.exit(0)` after `child.kill()` to prevent hanging. Always include `setTimeout(() => process.exit(0), 500)` as a fallback.

```bash
node - <<'NODE'
import { spawn } from 'node:child_process';
import readline from 'node:readline';
const outPath = `${process.cwd()}/screenshots/about-mcp-1280x720.png`;
const child = spawn('npx', ['chrome-devtools-mcp@latest', '--headless', '--isolated', '--viewport', '1280x720'], { stdio: ['pipe','pipe','pipe'] });
const rl = readline.createInterface({ input: child.stdout });
let id=1, pending=new Map();
const send=(m,p={})=>new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('timeout')),30000);pending.set(id,{res:(v)=>{clearTimeout(t);res(v)},rej});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:id++,method:m,params:p})+'\n');});
const notify=(m,p={})=>child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:m,params:p})+'\n');
rl.on('line',l=>{if(!l.trim())return;let m;try{m=JSON.parse(l);}catch{return;}if(m.id!==undefined&&pending.has(m.id)){const {res,rej}=pending.get(m.id);pending.delete(m.id);m.error?rej(m.error):res(m.result);}});
(async()=>{try{await send('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'codex-script',version:'0.0.5'}});notify('notifications/initialized',{});await send('tools/list',{});await send('tools/call',{name:'new_page',arguments:{url:'http://localhost:3000/#/about',timeout:30000}});await new Promise(r=>setTimeout(r,1500));await send('tools/call',{name:'take_screenshot',arguments:{fullPage:false,filePath:outPath,format:'png'}});console.log('Screenshot saved to',outPath);}catch(e){console.error('Error:',e.message);}finally{child.kill();setTimeout(()=>process.exit(0),500);}})();
NODE
```

### Screenshot with scroll (to capture content further down the page)
```bash
node - <<'NODE'
import { spawn } from 'node:child_process';
import readline from 'node:readline';
const outPath = `${process.cwd()}/screenshots/about-scrolled.png`;
const scrollAmount = 800; // pixels to scroll down
const child = spawn('npx', ['chrome-devtools-mcp@latest', '--headless', '--isolated', '--viewport', '1280x720'], { stdio: ['pipe','pipe','pipe'] });
const rl = readline.createInterface({ input: child.stdout });
let id=1, pending=new Map();
const send=(m,p={})=>new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('timeout')),30000);pending.set(id,{res:(v)=>{clearTimeout(t);res(v)},rej});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:id++,method:m,params:p})+'\n');});
const notify=(m,p={})=>child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:m,params:p})+'\n');
rl.on('line',l=>{if(!l.trim())return;let m;try{m=JSON.parse(l);}catch{return;}if(m.id!==undefined&&pending.has(m.id)){const {res,rej}=pending.get(m.id);pending.delete(m.id);m.error?rej(m.error):res(m.result);}});
(async()=>{try{await send('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'codex-script',version:'0.0.5'}});notify('notifications/initialized',{});await send('tools/list',{});await send('tools/call',{name:'new_page',arguments:{url:'http://localhost:3000/#/about',timeout:30000}});await new Promise(r=>setTimeout(r,1500));await send('tools/call',{name:'scroll_page',arguments:{deltaY:scrollAmount}});await new Promise(r=>setTimeout(r,800));await send('tools/call',{name:'take_screenshot',arguments:{fullPage:false,filePath:outPath,format:'png'}});console.log('Screenshot saved to',outPath);}catch(e){console.error('Error:',e.message);}finally{child.kill();setTimeout(()=>process.exit(0),500);}})();
NODE
```

## Project Structure & Module Organization
- `src/main.tsx` bootstraps React Router; `App.tsx` wires routes for `HomePage`, `CameraPage`, `ConstructionPage`.
- `src/pages` holds route-level screens (keep one component per file, prefer PascalCase names matching the route).
- `src/components` stores reusable widgets and utility hooks; legacy experiments live in `*.bak` or nested folders--clean them up when stabilizing features.
- `src/styles`, `App.css`, and `index.css` carry global tokens; colocate component-specific styles with the component.
- Static artifacts live in `public` (copied verbatim by Vite) and `/assets` (design sources, icons). Built files land in `dist/`; `deploy.sh` publishes that folder to GitHub Pages.

## Build, Test, and Development Commands
- `npm run dev` - start the Vite dev server with HMR on http://localhost:5173.
- `npm run build` - type-check via `tsc -b` and emit production assets into `dist/`.
- `npm run preview` - serve the last build to verify routing before deploying.
- `npm run lint` - run ESLint (`eslint.config.js`) across the repo.
- `./deploy.sh` - helper script for pushing the latest `dist/` output to GitHub Pages; run only after a green build.

## Coding Style & Naming Conventions
- TypeScript + React 18; prefer functional components with hooks and JSX in `.tsx`.
- Use two-space indentation, trailing semicolons, and single quotes unless interpolating variables.
- Components and pages use PascalCase filenames (e.g., `CameraPage.tsx`); hooks live under `src/components` as `useThing.ts`.
- Keep router-visible paths defined in `App.tsx`; mirror route names in folder names.
- Run `npm run lint` before committing; it enforces React Hooks rules and import ordering.

ALWAYS UPDATE THIS FILE WHEN PROJECT GUIDELINES CHANGE, OR YOU LEARN NEW THINGS THAT SHOULD BE DOCUMENTED FOR FUTURE CONTRIBUTORS.