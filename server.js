require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const ejs = require('ejs');
const port = process.env.PORT || 3000;

var mysql = require('mysql2/promise');

var pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DBHOST,
  user: process.env.DBUSER,
  password: process.env.DBPASS,
  database: process.env.DBNAME
});

app.use(cors());
app.use(express.json());
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.render('index');
});

//GET ALL ACCOUNTS

app.get('/accounts', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM accounts');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/accounts/:id', async (req, res) => {
  const accountId = req.params.id;
  try {
    const [rows] = await pool.query('SELECT * FROM accounts WHERE id = ?', [accountId]);
    if (rows.length === 0) {
      return res.status(404).send('Account not found');
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/accounts', async (req, res) => {
  const { owner, balance } = req.body;
  try {
    if (!owner || balance === undefined) {
      return res.status(400).send('Owner and balance are required');
    }
    const [result] = await pool.query('INSERT INTO accounts (owner, balance) VALUES (?, ?)', [owner, balance]);
    res.status(201).json({ id: result.insertId, owner, balance });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).send('Internal Server Error');
  }
})

app.patch('/accounts/:id', async (req, res) => {
  const accountId = req.params.id;
  const values = []
  const fields = []
  const { owner, balance } = req.body;

  if (owner !== undefined) {
    fields.push('owner = ?');
    values.push(owner);
  }
  if (balance !== undefined) {
    fields.push('balance = ?');
    values.push(balance);
  }
  values.push(accountId);

  if (fields.length === 0) {
    return res.status(400).send('At least one of owner or balance must be provided');
  }

  try {
    const [result] = await pool.query(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`, values);
    if (result.affectedRows === 0) {
      return res.status(404).send('Account not found');
    }
    res.status(200).json({ id: accountId, owner, balance });
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.delete('/accounts/:id', async (req, res) => {
  const accountId = req.params.id;
  try {
    const [result] = await pool.query('DELETE FROM accounts WHERE id = ?', [accountId]);
    if (result.affectedRows === 0) {
      return res.status(404).send('Account not found');
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).send('Internal Server Error');
  }
});



app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});