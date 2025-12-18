import app from './app';
import { config } from './config/env';

const port = config.port;

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Media Root: ${config.mediaRoot}`);
});
