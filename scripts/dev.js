#!/usr/bin/env node
/**
 * Sobe servidor (Express + Socket.IO) e cliente (Vite) em paralelo,
 * prefixando a saída de cada processo para facilitar a leitura do log.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const targets = [
  { name: 'server', color: '\u001b[35m', cwd: path.join(root, 'server') },
  { name: 'client', color: '\u001b[36m', cwd: path.join(root, 'client') },
];

const reset = '\u001b[0m';
const children = [];

for (const target of targets) {
  const child = spawn('npm', ['run', 'dev'], { cwd: target.cwd, shell: false });
  children.push(child);

  const pipe = (stream, isError) => {
    stream.setEncoding('utf8');
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        process[isError ? 'stderr' : 'stdout'].write(`${target.color}[${target.name}]${reset} ${line}\n`);
      }
    });
  };

  pipe(child.stdout, false);
  pipe(child.stderr, true);

  child.on('exit', (code) => {
    process.stdout.write(`${target.color}[${target.name}]${reset} finalizado com código ${code}\n`);
    for (const other of children) other.kill('SIGTERM');
    process.exit(code ?? 0);
  });
}

const shutdown = () => {
  for (const child of children) child.kill('SIGTERM');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
