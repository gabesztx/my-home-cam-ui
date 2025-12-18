import app from './app';
import { config } from './config/env';
import { aiLabelService } from './services/aiLabel.service';

const port = config.port;

// Initialize AI label service
aiLabelService.init().then(() => {
  if (config.aiEnabled) {
    console.log('AI Label Service initialized');
  }
}).catch(error => {
  console.error('Failed to initialize AI Label Service:', error);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Media Root: ${config.mediaRoot}`);
  console.log(`AI Enabled: ${config.aiEnabled}`);
});
