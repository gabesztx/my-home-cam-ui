import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import net from 'net';
import path from 'path';

import { config } from '../config/env';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const parseHostPort = (serviceUrl: string) => {
  const u = new URL(serviceUrl);
  const isHttps = u.protocol === 'https:';
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : isHttps ? 443 : 80,
  };
};

const canConnect = async (host: string, port: number, timeoutMs: number) => {
  return await new Promise<boolean>((resolve) => {
    const socket = new net.Socket();

    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));

    socket.connect(port, host);
  });
};

export class AiServiceRunnerService {
  private child: ChildProcessWithoutNullStreams | null = null;
  private starting = false;

  async ensureRunning() {
    if (!config.aiEnabled) return;
    if (this.child) return;
    if (this.starting) return;

    const { host, port } = parseHostPort(config.aiServiceUrl);

    // Ha már fut valahol (pl. systemd/tmux), nem indítjuk újra.
    if (await canConnect(host, port, 250)) {
      console.log(`[ai-service] already listening on ${host}:${port}`);
      return;
    }

    this.starting = true;
    try {
      const aiServiceDir = path.resolve(__dirname, '../../../ai-service');
      const uvicornPath = path.join(aiServiceDir, '.venv/bin/uvicorn');

      // Fontos: a venv-et egyszer telepíteni kell (ai-service/README)
      console.log(`[ai-service] starting via ${uvicornPath} (cwd=${aiServiceDir})`);

      this.child = spawn(
        uvicornPath,
        ['app:app', '--host', host, '--port', String(port)],
        {
          cwd: aiServiceDir,
          env: {
            ...process.env,
            // a python service saját küszöbe
            AI_CONFIDENCE: String(config.aiConfidence),
            // CPU-only + NNPACK warning elkerülése (harmless, de zajos)
            TORCH_DISABLE_NNPACK: '1',
            CUDA_VISIBLE_DEVICES: '',
          },
          stdio: 'pipe',
        }
      );

      this.child.stdout.on('data', (d) => console.log(`[ai-service] ${String(d).trimEnd()}`));
      this.child.stderr.on('data', (d) => console.error(`[ai-service] ${String(d).trimEnd()}`));

      this.child.on('exit', (code, signal) => {
        console.warn(`[ai-service] exited (code=${code}, signal=${signal})`);
        this.child = null;
      });

      // Várunk egy kicsit, hogy felálljon
      for (let i = 0; i < 20; i++) {
        if (await canConnect(host, port, 250)) {
          console.log(`[ai-service] ready on ${host}:${port}`);
          return;
        }
        await wait(150);
      }

      console.warn('[ai-service] did not become ready in time');
    } finally {
      this.starting = false;
    }
  }

  async stop() {
    if (!this.child) return;
    try {
      this.child.kill('SIGTERM');
    } finally {
      this.child = null;
    }
  }
}

export const aiServiceRunnerService = new AiServiceRunnerService();
