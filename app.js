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

// Registration
app.post('/register', function(req, res) {
  var first_name = req.body.first_name;
  var last_name = req.body.last_name;
  var email = req.body.email;
  var password = req.body.password;
  if (!first_name || !last_name || !email || !password) {
    res.status(400).json({ message: 'Missing required fields' });
    return;
  }
  var sql = 'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)';
  var values = [first_name, last_name, email, password];
  connection.query(sql, values, function(err, results) {
    if (err) {
      res.status(500).send('Error inserting user');
      return;
    }
    res.redirect('/login.html');
  });
});

// Login
app.post('/login', function(req, res) {
  var email = req.body.email;
  var password = req.body.password;
  if (!email || !password) {
    res.status(400).json({ success: false, message: 'Missing email or password' });
    return;
  }
  var sql = 'SELECT id, password_hash FROM users WHERE email = ?';
  connection.query(sql, [email], function(err, results) {
    if (err) {
      res.status(500).json({ success: false, message: 'Database error' });
      return;
    }
    if (results.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }
    var user = results[0];
    if (user.password_hash === password) {
      res.json({ success: true, message: 'Login successful!', id: user.id });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  });
});

// Fetch user profile
app.get('/user/:id', function(req, res) {
  var userId = req.params.id;
  var sql = 'SELECT id, first_name, last_name, email FROM users WHERE id = ?';
  connection.query(sql, [userId], function(err, results) {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    if (results.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(results[0]);
  });
});

// Update profile
app.post('/update-profile', function(req, res) {
  var id = req.body.id;
  var first_name = req.body.first_name;
  var last_name = req.body.last_name;
  var email = req.body.email;
  var password = req.body.password;
  if (!id || !first_name || !last_name || !email || !password) {
    res.status(400).json({ message: 'Missing required fields' });
    return;
  }
  var sql = 'UPDATE users SET first_name = ?, last_name = ?, email = ?, password_hash = ? WHERE id = ?';
  var values = [first_name, last_name, email, password, id];
  connection.query(sql, values, function(err, result) {
    if (err) {
      res.status(500).json({ message: 'Database error when updating profile' });
      return;
    }
    if (result.affectedRows === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.send(`
      <script>
        alert('Profile updated successfully!');
        window.location.href = 'welcome.html';
      </script>
    `);
  });
});

// Delete user
app.delete('/delete-myself', function(req, res) {
  var id = req.body.id;
  if (!id) {
    res.status(400).json({ success: false, message: 'Missing user id' });
    return;
  }
  var sql = 'DELETE FROM users WHERE id = ?';
  connection.query(sql, [id], function(err, result) {
    if (err) {
      res.status(500).json({ success: false, message: 'Database error when deleting user.' });
      return;
    }
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    res.json({ success: true });
  });
});

// Product details
app.get('/product/:id', function(req, res) {
  var productId = req.params.id;
  var sql = 'SELECT id, name, price, description FROM products WHERE id = ?';
  connection.query(sql, [productId], function(err, results) {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    if (results.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json(results[0]);
  });
});


app.post('/add-to-cart', function(req, res) {
  var userId = req.body.userId;
  var productId = req.body.productId;
  var quantity = Number(req.body.quantity);

  if (!userId || !productId) {
    res.status(400).json({ error: 'Missing userId or productId' });
    return;
  }

  
  if (typeof quantity !== 'number' || isNaN(quantity)) {
    quantity = 1;
  }
  if (quantity < 0) quantity = 0;

  
  var findSql = 'SELECT id FROM cart_items WHERE user_id = ? AND product_id = ?';
  connection.query(findSql, [userId, productId], function(err, results) {
    if (err) {
      res.status(500).json({ error: 'Database error (find existing cart)' });
      return;
    }
    if (results.length > 0) {
      
      if (quantity === 0) {
        var deleteSql = 'DELETE FROM cart_items WHERE id = ?';
        connection.query(deleteSql, [results[0].id], function(err2) {
          if (err2) {
            res.status(500).json({ error: 'Database error (delete cart item)' });
            return;
          }
          res.json({ message: 'Removed from cart!' });
        });
      } else {
        
        var updateSql = 'UPDATE cart_items SET quantity = ? WHERE id = ?';
        connection.query(updateSql, [quantity, results[0].id], function(err2) {
          if (err2) {
            res.status(500).json({ error: 'Database error (update cart item)' });
            return;
          }
          res.json({ message: 'Cart updated!' });
        });
      }
    } else {
      
      if (quantity > 0) {
        var insertSql = 'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)';
        connection.query(insertSql, [userId, productId, quantity], function(err3) {
          if (err3) {
            res.status(500).json({ error: 'Database error (insert cart item)' });
            return;
          }
          res.json({ message: 'Added to cart!' });
        });
      } else {
        
        res.json({ message: 'Nothing to remove.' });
      }
    }
  });
});


app.post('/remove-from-cart', function(req, res) {
  var userId = req.body.userId;
  var productId = req.body.productId;
  if (!userId || !productId) {
    res.status(400).json({ error: 'Missing userId or productId' });
    return;
  }
  var deleteSql = 'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?';
  connection.query(deleteSql, [userId, productId], function(err, result) {
    if (err) {
      res.status(500).json({ error: 'Database error (remove from cart)' });
      return;
    }
    res.json({ message: 'Removed from cart!' });
  });
});

//Search products
app.get('/search', function(req, res) {
  const searchTerm = req.query.query;
  if (!searchTerm) {
    res.status(400).json({error: 'Missing search query'});
    return;
  }

  const sql = "SELECT id FROM products WHERE name LIKE ? LIMIT 1";
  const likeTerm = `%${searchTerm}%`;
  connection.query(sql, [likeTerm], function(err, results) {
    if (err) {
      res.status(500).json({error: 'Database error during search'});
      return;
    }
    if (results.length === 0) {
      
      res.status(404).json({message: 'No matching product found'});
      return;
    }
    
    res.json({ productId: results[0].id });
  });
});


app.listen(3000, function() {
  console.log('Server running at http://localhost:3000');
});
