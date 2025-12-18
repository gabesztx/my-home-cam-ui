import app from './app';
import { config } from './config/env';

const port = config.PORT;

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Environment: ${config.NODE_ENV}`);
});
