import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Detect if using Supabase or local database
const isSupabase = process.env.DB_HOST?.includes('supabase.co') || false;
const isProduction = process.env.NODE_ENV === 'production';

console.log('Database configuration:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  isSupabase,
  isProduction,
  ssl: isSupabase || isProduction
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: isSupabase || isProduction ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
  client_encoding: 'utf8',
  application_name: 'finances-api',
  // Force IPv4 for Supabase connections to avoid IPv6 issues on Render
  ...(isSupabase && {
    keepAlive: true,
    keepAliveInitialDelayMillis: 0,
    // Force IPv4 to avoid ENETUNREACH errors
    family: 4,
  }),
  // Production-specific settings
  ...(isProduction && {
    statement_timeout: 30000,
    query_timeout: 30000,
    // Additional connection pooling for production
    acquireTimeoutMillis: 30000,
  })
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
  // Don't exit the process, just log the error
  // process.exit(-1);
});

pool.on('connect', () => {
  console.log('Successfully connected to database');
});

// Test connection on startup
pool.connect()
  .then(client => {
    console.log('✅ Initial database connection successful');
    client.release();
  })
  .catch(err => {
    console.error('❌ Initial database connection failed:', err.message);
    console.error('Full error:', err);
  });

export default pool; 