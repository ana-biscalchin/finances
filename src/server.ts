import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middlewares/errorHandler';
import userRoutes from './routes/users';
import createAccountsRouter from './routes/accounts';
import createTransactionsRouter from './routes/transactions';
import createCategoriesRouter from './routes/categories';
import logger from './config/logger';
import { logger as requestLogger } from './middlewares/logger';
import swaggerSpec from '../docs/swagger.json';

// Load environment variables
dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// API Documentation Route
app.use('/api-docs', swaggerUi.serve as any);
app.get('/api-docs', swaggerUi.setup(swaggerSpec) as any);

// Export Swagger JSON
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Application Routes
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/accounts', createAccountsRouter());
app.use('/api/v1/transactions', createTransactionsRouter());
app.use('/api/v1/categories', createCategoriesRouter());

// Debug route to test routing
app.get('/test', (req, res) => {
  res.json({ message: 'Test route working!' });
});

// Debug route to check database configuration
app.get('/debug', (req, res) => {
  res.json({
    message: 'Debug information',
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DB_HOST: process.env.DB_HOST ? `${process.env.DB_HOST.substring(0, 10)}...` : 'NOT_SET',
      DB_PORT: process.env.DB_PORT,
      DB_USER: process.env.DB_USER,
      DB_NAME: process.env.DB_NAME,
      DB_PASSWORD: process.env.DB_PASSWORD ? '[SET]' : 'NOT_SET'
    },
    timestamp: new Date().toISOString()
  });
});

// Database connection test route
app.get('/db-test', async (req, res) => {
  try {
    const pool = require('./config/database').default;
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({
      status: 'Database connection successful',
      result: result.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Basic route
app.get('/', (req, res) => {
  logger.info('Root route accessed');
  res.json({ message: 'Bem-vindo à API de Finanças! Acesse /api-docs para ver a documentação.' });
});

// Health check route for Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'finances-api'
  });
});

// List all routes for debugging
app.get('/routes', (req, res) => {
  const routes: any[] = [];
  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      routes.push(`${Object.keys(middleware.route.methods)[0].toUpperCase()} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler: any) => {
        if (handler.route) {
          routes.push(`${Object.keys(handler.route.methods)[0].toUpperCase()} ${middleware.regexp}${handler.route.path}`);
        }
      });
    }
  });
  res.json({ routes });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(port, '0.0.0.0', () => {
  logger.info(`Servidor rodando na porta ${port}`);
  logger.info(`Servidor acessível em todas as interfaces (0.0.0.0:${port})`);
  logger.info(`Documentação da API disponível em http://localhost:${port}/api-docs`);
}); 