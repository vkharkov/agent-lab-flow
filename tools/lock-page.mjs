#!/usr/bin/env node
// Закрывает страницу паролем: AES-GCM, ключ из пароля через PBKDF2-SHA-256, 600 000 итераций.
// Запуск: node tools/lock-page.mjs <открытая страница.html> <папка>/index.html
// Пароль спрашивается в терминале и не печатается. Для проверки можно задать LOCK_PASSWORD.
// Пароль не пишите в аргументы, в файлы и в git.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { webcrypto as wc } from 'node:crypto';
import readline from 'node:readline';

const [src, dest] = process.argv.slice(2);
if (!src || !dest) { console.error('Запуск: node tools/lock-page.mjs <страница.html> <папка>/index.html'); process.exit(1); }

function ask(q) {
  return new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.startsWith(q)) process.stdout.write(q); };
    rl.question(q, a => { rl.close(); process.stdout.write('\n'); res(a.trim()); });
  });
}

let pw = (process.env.LOCK_PASSWORD || '').trim();
if (!pw) {
  pw = await ask('Пароль: ');
  const again = await ask('Ещё раз: ');
  if (pw !== again) { console.error('Пароли не совпали.'); process.exit(1); }
}
if (pw.length < 10) { console.error('Пароль короче 10 знаков.'); process.exit(1); }

const N = 600000;
const salt = wc.getRandomValues(new Uint8Array(16));
const iv = wc.getRandomValues(new Uint8Array(12));
const base = await wc.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
const key = await wc.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: N, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = new Uint8Array(await wc.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(readFileSync(src, 'utf8'))));
const b64 = a => Buffer.from(a).toString('base64');

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Закрытая страница</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f6f6f7;color:#1c1f24;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
form{background:#fff;border:1px solid #dcdfe4;border-radius:12px;padding:24px;width:min(340px,86vw)}h1{font-size:18px;margin:0 0 6px}p{margin:0 0 14px;color:#667085;font-size:14px}
input,button{width:100%;box-sizing:border-box;font:inherit;padding:11px 12px;border-radius:8px}input{border:1px solid #c9ced6;margin-bottom:10px}button{border:0;background:#5560cf;color:#fff;font-weight:600}
#e{color:#c6453f;min-height:20px;margin:10px 0 0}@media(prefers-color-scheme:dark){body{background:#15171b;color:#e7e9ee}form{background:#1c1f24;border-color:#2f343c}input{background:#15171b;color:inherit;border-color:#3a414c}}</style></head>
<body><form id="f"><h1>Закрытая страница</h1><p>Введите пароль.</p><input id="p" type="password" autocomplete="current-password" autofocus aria-label="Пароль"><button>Открыть</button><p id="e" role="alert"></p></form>
<script>
var S="${b64(salt)}",I="${b64(iv)}",C="${b64(ct)}",N=${N};
function d(s){var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
document.getElementById('f').addEventListener('submit',async function(ev){ev.preventDefault();var e=document.getElementById('e');e.textContent='Проверяю…';
 try{var k=await crypto.subtle.importKey('raw',new TextEncoder().encode(document.getElementById('p').value.trim()),'PBKDF2',false,['deriveKey']);
  var key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:d(S),iterations:N,hash:'SHA'+'-256'},k,{name:'AES-GCM',length:256},false,['decrypt']);
  var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:d(I)},key,d(C));var h=new TextDecoder().decode(pt);document.open();document.write(h);document.close();
 }catch(x){e.textContent='Пароль не подошёл.';}});
</script></body></html>
`;
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, html);
console.log('Готово: ' + dest + ' (' + html.length + ' байт). Открытый текст в файл не попал.');
