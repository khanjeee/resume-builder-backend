const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);
    console.log('Users table created or already exists.');

    const res = await pool.query('SELECT COUNT(*) AS count FROM users');
    if (parseInt(res.rows[0].count) === 0) {
      const adminUsername = 'admin';
      const adminPassword = 'password'; // You should change this in production!
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [adminUsername, hashedPassword]);
      console.log('Default admin user created: admin/password');
    }
  } catch (err) {
    console.error('Error initializing database:', err.message);
  }
};

initializeDatabase();

module.exports = { pool, initializeDatabase };
