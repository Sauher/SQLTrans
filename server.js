require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const ejs = require('ejs');
const port = process.env.PORT || 3000;
const axios = require('axios');

const serverURL = "http://localhost:3000"

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
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.redirect('/results');
});

//GET ALL ACCOUNTS

app.get('/api/accounts', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM accounts');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/accounts/:id', async (req, res) => {
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

app.post('/api/accounts', async (req, res) => {
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

app.patch('/api/accounts/:id', async (req, res) => {
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

app.delete('/api/accounts/:id', async (req, res) => {
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

//Transaction endpoints

app.post('/api/transactions', async (req, res) => {
  const { from_account_id, to_account_id, amount } = req.body;
    if (from_account_id == to_account_id) {
      return res.status(400).send('From account ID and to account ID must be different');
    }
    if (!from_account_id || !to_account_id || !amount) {
      return res.status(400).send('From account ID, to account ID, and amount are required');
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
     
      const [fromAccountRows] = await connection.query('SELECT * FROM accounts WHERE id = ? FOR UPDATE', [from_account_id]);
      if (fromAccountRows.length === 0) {
        throw new Error('From account not found');
      }
      if (fromAccountRows[0].balance < amount) {
        throw new Error('Insufficient funds in from account');
      }
      const [toAccountRows] = await connection.query('SELECT * FROM accounts WHERE id = ? FOR UPDATE', [to_account_id]);
      if (toAccountRows.length === 0) {
        throw new Error('To account not found');
      }
      const newFromBalance = fromAccountRows[0].balance - amount;
      const newToBalance = toAccountRows[0].balance + amount;
      await connection.query('UPDATE accounts SET balance = ? WHERE id = ?', [newFromBalance, from_account_id]);
      await connection.query('UPDATE accounts SET balance = ? WHERE id = ?', [newToBalance, to_account_id]);

      const [result] = await connection.query('INSERT INTO transactions (from_acc, to_acc, amount) VALUES (?, ?, ?)', [from_account_id, to_account_id, amount]);
      await connection.commit();
      res.status(201).json({ id: result.insertId, from_account_id, to_account_id, amount });
    } catch (error) {
      await connection.rollback();
      console.error('Error creating transaction:', error);
      res.status(500).send('Internal Server Error');
    } finally {
      connection.release();
    }
});

//get transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM transactions INNER JOIN accounts ON transactions.from_acc= accounts.id INNER JOIN accounts AS to_accounts ON transactions.to_acc = to_accounts.id');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/transactions/:id', async (req, res) => {
  const transactionId = req.params.id;
  try {
    const [rows] = await pool.query('SELECT * FROM transactions INNER JOIN accounts ON transactions.from_acc = accounts.id INNER JOIN accounts AS to_acc ON transactions.to_acc = to_accounts.id WHERE transactions.id = ?', [transactionId]);
    if (rows.length === 0) {
      return res.status(404).send('Transaction not found');
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/results', async (req, res) => {
  try{
    const { data: accounts } = await axios.get(`${serverURL}/api/accounts`);
    const { data: transactions } = await axios.get(`${serverURL}/api/transactions`);
    res.render("index", { accounts, transactions });

  }
  catch(err){
    console.log(err)
    res.status(500).send('Internal Server Error');
  }
})

app.get('/accounts', (req, res) => {
  res.render('accounts');
})
app.post('/accounts', (req, res) => {
  const {owner,balance} = req.body;
  try{
    axios.post(`${serverURL}/api/accounts`, {owner, balance})
      res.redirect('/accounts');
  }
  catch(err){
    console.error('Error creating account:', err);
    res.status(500).send('Internal Server Error');
  }
})
app.get('/transactions', async (req, res) => {
  const { data: accounts } = await axios.get(`${serverURL}/api/accounts`);
  res.render('transactions', { accounts});
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});