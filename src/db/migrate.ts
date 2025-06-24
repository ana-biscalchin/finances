import fs from 'fs';
import path from 'path';
import pool from '../config/database';

function splitSqlCommands(sql: string): string[] {
  // Remove comments and split by semicolon
  const commands = sql
    .replace(/--.*$/gm, '') // Remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .split(';')
    .map(cmd => cmd.trim())
    .filter(cmd => cmd.length > 0);
  
  return commands;
}

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  const client = await pool.connect();

  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP NOT NULL
      )
    `);

    // Get executed migrations
    const result = await client.query('SELECT name FROM migrations');
    const executedNames = result.rows.map(row => row.name);

    // Run pending migrations
    for (const file of files) {
      if (!executedNames.includes(file)) {
        console.log(`Running migration: ${file}`);
        
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        const commands = splitSqlCommands(sql);
        
        await client.query('BEGIN');

        try {
          // Execute each SQL command separately
          for (const command of commands) {
            if (command.trim()) {
              await client.query(command);
            }
          }
          
          await client.query(
            'INSERT INTO migrations (name, executed_at) VALUES ($1, $2)',
            [file, new Date()]
          );
          await client.query('COMMIT');
          console.log(`Migration ${file} completed successfully`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
    }

    console.log('All migrations completed successfully');
  } finally {
    client.release();
  }
}

runMigrations().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
}); 