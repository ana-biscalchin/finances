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

// Basic route
app.get('/', (req, res) => {
  logger.info('Root route accessed');
  res.json({ message: 'Bem-vindo à API de Finanças! Acesse /api-docs para ver a documentação.' });
});

// Health check route for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(port, '0.0.0.0', () => {
  logger.info(`Servidor rodando na porta ${port}`);
  logger.info(`Servidor acessível em todas as interfaces (0.0.0.0:${port})`);
  logger.info(`Documentação da API disponível em http://localhost:${port}/api-docs`);
}); 