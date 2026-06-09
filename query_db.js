import Database from 'better-sqlite3';
const db = new Database('data/financas.sqlite');

console.log('--- ACCOUNTS ---');
const accounts = db.prepare('SELECT id, name, type, initial_balance_cents, is_active FROM accounts').all();
console.log(accounts);

console.log('\n--- CREDIT CARDS ---');
const creditCards = db.prepare('SELECT id, name, payment_account_id, closing_day, due_day FROM credit_cards').all();
console.log(creditCards);

console.log('\n--- TRANSACTIONS (first 20) ---');
const txs = db.prepare('SELECT id, type, description, amount_cents, event_date, budget_month, account_id, credit_card_id, credit_card_bill_id, status FROM transactions ORDER BY event_date DESC LIMIT 20').all();
console.log(txs);
