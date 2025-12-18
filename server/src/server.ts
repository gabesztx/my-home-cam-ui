import app from './app';
import { config } from './config/env';

const port = config.port;

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Media Root: ${config.mediaRoot}`);
});
