import app from './app';
import { config } from './config/env';
import { aiServiceRunnerService } from './services/aiServiceRunner.service';

const port = config.port;

// Ha AI_ENABLED=true, próbáljuk automatikusan elindítani az ai-service-t
aiServiceRunnerService.ensureRunning().catch((e) => {
  console.error('[ai-service] auto-start failed:', e);
});

process.on('SIGINT', async () => {
  await aiServiceRunnerService.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await aiServiceRunnerService.stop();
  process.exit(0);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Media Root: ${config.mediaRoot}`);
});
