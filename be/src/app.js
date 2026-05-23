import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRouter from './routes/index.js';
import { initScheduler } from './services/cron.service.js';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
const frontendOrigin = (process.env.FRONTEND_URL || '').replace(/\/$/, '');

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, frontendOrigin || true);
    }
    const normalized = origin.replace(/\/$/, '');
    if (!frontendOrigin || normalized === frontendOrigin) {
      return callback(null, origin);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root health-check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Six 7 Bill Splitter Backend API is running.',
    timestamp: new Date().toISOString()
  });
});

// Mount consolidated API router
app.use('/api', apiRouter);

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

// Initialize Cron Scheduler (runs hourly sweeps in background)
initScheduler();

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;
