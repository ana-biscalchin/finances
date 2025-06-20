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

  const connection = await pool.getConnection();

  try {
    // Create migrations table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at DATETIME NOT NULL
      )
    `);

    // Get executed migrations
    const [executedMigrations] = await connection.execute(
      'SELECT name FROM migrations'
    );
    const executedNames = (executedMigrations as any[]).map(m => m.name);

    // Run pending migrations
    for (const file of files) {
      if (!executedNames.includes(file)) {
        console.log(`Running migration: ${file}`);
        
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        const commands = splitSqlCommands(sql);
        
        await connection.beginTransaction();

        try {
          // Execute each SQL command separately
          for (const command of commands) {
            if (command.trim()) {
              await connection.query(command);
            }
          }
          
          await connection.execute(
            'INSERT INTO migrations (name, executed_at) VALUES (?, ?)',
            [file, new Date()]
          );
          await connection.commit();
          console.log(`Migration ${file} completed successfully`);
        } catch (error) {
          await connection.rollback();
          throw error;
        }
      }
    }

    console.log('All migrations completed successfully');
  } finally {
    connection.release();
  }
}

runMigrations().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
}); 