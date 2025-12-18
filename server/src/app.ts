import express from 'express';
import path from 'path';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import routes from './routes';
import { requestLogger } from './middlewares/requestLogger';
import { notFound } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

// Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Angular fix for production
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(compression());
const corsOptions = {
  origin: 'http://localhost:4200',
  methods: ['GET', 'OPTIONS'],
  credentials: false,
  allowedHeaders: ['Content-Type', 'Range'],
  exposedHeaders: ['Accept-Ranges', 'Content-Range', 'Content-Length']
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(requestLogger);

// API Routes
app.use('/api', routes);

// Static Serve for Angular Production
const publicPath = path.join(__dirname, '../../client/dist/client/browser');
app.use(express.static(publicPath));

// SPA Fallback
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(publicPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Frontend not built yet. Run npm run build.');
    }
  });
});
// Post-Middlewares
app.use(notFound);
app.use(errorHandler);

export default app;
