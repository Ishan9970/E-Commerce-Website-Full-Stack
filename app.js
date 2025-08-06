const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));

// MySQL connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'user_db'
});

// CREATE: Register a new user
app.post('/register', (req, res) => {
  const { first_name, last_name, email, password } = req.body; 
  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const sql = 'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)';
  const values = [first_name, last_name, email, password]; 
  connection.query(sql, values, (err, results) => {
    if (err) return res.status(500).send('Error inserting user');
    // Option 1: Redirect to welcome page for form
    res.redirect('/welcome.html');
    
  });
});

// LOGIN: User authentication
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
      res.json({ success: true, message: 'Login successful!', id: user.id });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  });
});

// READ/SEARCH: Search for users 
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

// Search the user for updating profile
app.get('/searchEmployeeByName', (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: 'Missing name query parameter' });

  const sql = `
    SELECT id, first_name, last_name, email
    FROM users
    WHERE first_name LIKE ? OR last_name LIKE ?
  `;
  const likeTerm = `%${name}%`;
  connection.query(sql, [likeTerm, likeTerm], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    // Return results using the expected property names
    res.json(results); // results will have id, first_name, last_name, email
  });
});


// UPDATE: Update user profile
app.post('/update-profile', (req, res) => {
  const { id, first_name, last_name, email, password } = req.body;
  if (!id || !first_name || !last_name || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const sql = 'UPDATE users SET first_name = ?, last_name = ?, email = ?, password_hash = ? WHERE id = ?';
  const values = [first_name, last_name, email, password, id];
  connection.query(sql, values, (err, result) => {
    if (err) return res.status(500).json({ message: 'Database error when updating profile' });
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'Profile updated!' });
  });
});

// DELETE by name (either first_name or last_name, partial match allowed)
app.delete('/delete-employee', (req, res) => {
  const name = req.body.name;
  if (!name) return res.status(400).json({ success: false, message: 'Missing name' });

  // Find matching users first (optional: to give better feedback on what you're deleting)
  const sql = 'DELETE FROM users WHERE first_name = ? OR last_name = ?';
  connection.query(sql, [name, name], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error when deleting user.' });
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }
    res.json({ success: true });
  });
});



app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
