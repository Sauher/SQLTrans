require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const ejs = require('ejs');
const port = process.env.PORT || 3000;

var mysql = require('mysql');

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});