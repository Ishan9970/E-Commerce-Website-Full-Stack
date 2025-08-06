const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



app.use(express.static(__dirname));


const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',        
  password: 'root',    
  database: 'user_db'  
});


app.post('/register', (req, res) => {
  const { first_name, last_name, email, password } = req.body; 
  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const sql = 'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)';
  const values = [first_name, last_name, email, password]; 
  connection.query(sql, values, (err, results) => {
    if (err) return res.status(500).send('Error inserting user');
    res.redirect('/welcome.html');
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body; 
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Missing email or password' });
  }
  
  const sql = 'SELECT id, password_hash FROM users WHERE email = ?';
  connection.query(sql, [email], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    if (results.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const user = results[0];
    if (user.password_hash === password) {
      res.json({ success: true, message: 'Login successful!' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  });
});


app.get('/search', (req, res) => {
  const searchTerm = req.query.query;
  if (!searchTerm) return res.status(400).json({ error: 'Missing query parameter' });
  const sql = `
    SELECT id, first_name, last_name FROM users
    WHERE first_name LIKE ? OR last_name LIKE ?
  `;
  const likeTerm = `%${searchTerm}%`;
  connection.query(sql, [likeTerm, likeTerm], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
