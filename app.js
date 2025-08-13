const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (including uploaded images) from app root
app.use(express.static(__dirname));

// MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root', // your MySQL password
    database: 'user_db'
});

// ===== Multer config: save files in application root =====
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, __dirname); // save in root folder
    },
    filename: function (req, file, cb) {
        const uniqueName = 'img-' + Date.now() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({ storage: storage });

/* ================= REGISTER ================= */
app.post('/register', function (req, res) {
    const { first_name, last_name, email, password } = req.body;
    if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    const sql = 'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)';
    connection.query(sql, [first_name, last_name, email, password], function (err) {
        if (err) return res.status(500).send('Error inserting user');
        res.redirect('/login.html');
    });
});

/* ================= LOGIN (User or Admin) ================= */
app.post('/login', function (req, res) {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
        return res.status(400).json({ success: false, message: 'Missing email, password, or role' });
    }

    if (role === 'admin') {
        const sql = 'SELECT id, password_hash FROM admins WHERE email = ?';
        connection.query(sql, [email], function (err, results) {
            if (err) return res.status(500).json({ success: false, message: 'Database error' });
            if (results.length === 0) {
                return res.status(403).json({ success: false, message: 'Log in as user, you are not admin.' });
            }
            const admin = results[0];
            if (admin.password_hash === password) {
                return res.json({ success: true, message: 'Admin login successful!', id: admin.id });
            } else {
                return res.status(401).json({ success: false, message: 'Invalid email or password' });
            }
        });
    } else {
        const sql = 'SELECT id, password_hash FROM users WHERE email = ?';
        connection.query(sql, [email], function (err, results) {
            if (err) return res.status(500).json({ success: false, message: 'Database error' });
            if (results.length === 0) {
                return res.status(401).json({ success: false, message: 'Invalid email or password' });
            }
            const user = results[0];
            if (user.password_hash === password) {
                return res.json({ success: true, message: 'Login successful!', id: user.id });
            } else {
                return res.status(401).json({ success: false, message: 'Invalid email or password' });
            }
        });
    }
});

/* ================= FETCH USER PROFILE ================= */
app.get('/user/:id', function (req, res) {
    const userId = req.params.id;
    const sql = 'SELECT id, first_name, last_name, email FROM users WHERE id = ?';
    connection.query(sql, [userId], function (err, results) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(results[0]);
    });
});

/* ================= UPDATE PROFILE ================= */
app.post('/update-profile', function (req, res) {
    const { id, first_name, last_name, email, password } = req.body;
    if (!id || !first_name || !last_name || !email || !password) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    const sql = 'UPDATE users SET first_name = ?, last_name = ?, email = ?, password_hash = ? WHERE id = ?';
    connection.query(sql, [first_name, last_name, email, password, id], function (err, result) {
        if (err) return res.status(500).json({ message: 'Database error when updating profile' });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
        res.send(`
          <script>
            alert('Profile updated successfully!');
            window.location.href = 'welcome.html';
          </script>
        `);
    });
});

/* ================= DELETE USER ================= */
app.delete('/delete-myself', function (req, res) {
    const id = req.body.id;
    if (!id) return res.status(400).json({ success: false, message: 'Missing user id' });
    const sql = 'DELETE FROM users WHERE id = ?';
    connection.query(sql, [id], function (err, result) {
        if (err) return res.status(500).json({ success: false, message: 'Database error when deleting user.' });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'User not found.' });
        res.json({ success: true });
    });
});

/* ================= GET SINGLE PRODUCT ================= */
app.get('/product/:id', function (req, res) {
    const productId = req.params.id;
    const sql = 'SELECT id, name, price, description, image_url, category FROM products WHERE id = ?';
    connection.query(sql, [productId], function (err, results) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length === 0) return res.status(404).json({ error: 'Product not found' });
        res.json(results[0]);
    });
});

/* ================= GET ALL PRODUCTS ================= */
app.get('/api/products', (req, res) => {
    connection.query('SELECT * FROM products', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json(results);
    });
});

/* ================= GET DISTINCT CATEGORIES  ================= */
app.get('/api/categories', (req, res) => {
    connection.query('SELECT DISTINCT category FROM products', (err, results) => {
        if (err) return res.status(500).json({ success: false });
        const categories = results.map(r => r.category);
        res.json(categories);
    });
});

/* ================= GET PRODUCTS BY CATEGORY  ================= */
app.get('/api/products-by-category', (req, res) => {
    const category = req.query.category;
    let sql, params;
    if (!category || category.toLowerCase() === 'all') {
        sql = 'SELECT * FROM products';
        params = [];
    } else {
        sql = 'SELECT * FROM products WHERE category = ?';
        params = [category];
    }
    connection.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json(results);
    });
});

/* ================= CART ================= */
app.post('/add-to-cart', function (req, res) {
    const { userId, productId } = req.body;
    let quantity = Number(req.body.quantity);
    if (!userId || !productId) return res.status(400).json({ error: 'Missing userId or productId' });
    if (isNaN(quantity) || quantity < 0) quantity = 1;

    const findSql = 'SELECT id FROM cart_items WHERE user_id = ? AND product_id = ?';
    connection.query(findSql, [userId, productId], function (err, results) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length > 0) {
            if (quantity === 0) {
                connection.query('DELETE FROM cart_items WHERE id = ?', [results[0].id], () => res.json({ message: 'Removed from cart!' }));
            } else {
                connection.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, results[0].id], () => res.json({ message: 'Cart updated!' }));
            }
        } else {
            if (quantity > 0) {
                connection.query('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)', [userId, productId, quantity], () => res.json({ message: 'Added to cart!' }));
            } else {
                res.json({ message: 'Nothing to remove.' });
            }
        }
    });
});

app.post('/remove-from-cart', function (req, res) {
    const { userId, productId } = req.body;
    if (!userId || !productId) return res.status(400).json({ error: 'Missing userId or productId' });
    connection.query('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, productId], () => res.json({ message: 'Removed from cart!' }));
});

/* ================= SEARCH ================= */
app.get('/search', function (req, res) {
    const searchTerm = req.query.query;
    if (!searchTerm) return res.status(400).json({ error: 'Missing search query' });
    const sql = "SELECT id FROM products WHERE name LIKE ? LIMIT 1";
    connection.query(sql, [`%${searchTerm}%`], function (err, results) {
        if (err) return res.status(500).json({ error: 'Database error during search' });
        if (results.length === 0) return res.status(404).json({ message: 'No matching product found' });
        res.json({ productId: results[0].id });
    });
});

/* ================= PAYMENT ================= */
app.post('/api/pay', function (req, res) {
    const { payment_mode, amount, userId } = req.body;
    if (!payment_mode || !amount || !userId) {
        return res.status(400).json({ success: false, message: 'Missing payment details or userId' });
    }
    function generateGatewayTransactionId() {
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `GTID_${Date.now()}_${randomPart}`;
    }
    const gatewayTransactionId = generateGatewayTransactionId();

    const cartSql = 'SELECT product_id, quantity FROM cart_items WHERE user_id = ?';
    connection.query(cartSql, [userId], function (err, cartItems) {
        if (err) return res.status(500).json({ success: false, message: 'Database error fetching cart' });
        if (cartItems.length === 0) return res.status(400).json({ success: false, message: 'Cart is empty' });

        const products = cartItems.map(i => i.product_id).join(',');
        const quantities = cartItems.map(i => i.quantity).join(',');

        connection.query(
            'INSERT INTO transactions (user_id, products, quantities, payment_mode, gateway_transaction_id) VALUES (?, ?, ?, ?, ?)',
            [userId, products, quantities, payment_mode, gatewayTransactionId],
            function (err2) {
                if (err2) return res.status(500).json({ success: false, message: 'Error saving transaction' });
                connection.query('DELETE FROM cart_items WHERE user_id = ?', [userId], function (err3) {
                    if (err3) return res.status(500).json({ success: false, message: 'Error clearing cart' });
                    res.json({ success: true, gateway_transaction_id: gatewayTransactionId });
                });
            }
        );
    });
});

/* ================= IMAGE UPLOAD ================= */
app.post('/api/upload-image', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const imageUrl = `/${req.file.filename}`; // URL for static serving
    res.json({ success: true, imageUrl: imageUrl });
});

/* ================= ADD PRODUCT ================= */
app.post('/api/request', (req, res) => {
    const { name, price, description, image_url, category } = req.body;
    if (!name || !price || !image_url || !category) {
        return res.status(400).json({ success: false, message: 'Name, price, image URL, and category are required' });
    }
    connection.query(
        `INSERT INTO products (name, price, description, image_url, category) VALUES (?, ?, ?, ?, ?)`,
        [name, price, description || '', image_url, category],
        (err, result) => {
            if (err) {
                console.error('Error inserting product:', err);
                return res.status(500).json({ success: false, message: 'Database error while adding product' });
            }
            res.json({ success: true, message: 'Product added successfully', productId: result.insertId });
        }
    );
});

/* ================= UPDATE PRODUCT ================= */
app.post('/api/update-product', (req, res) => {
    const { id, name, price, description, category } = req.body;
    if (!id || !name || !price) {
        return res.status(400).json({ success: false, message: 'Missing id, name or price' });
    }
    // If description or category is undefined, keep the old value
    let sql, params;
    if (typeof description !== "undefined" && typeof category !== "undefined") {
        sql = 'UPDATE products SET name = ?, price = ?, description = ?, category = ? WHERE id = ?';
        params = [name, price, description, category, id];
    } else if (typeof description !== "undefined") {
        sql = 'UPDATE products SET name = ?, price = ?, description = ? WHERE id = ?';
        params = [name, price, description, id];
    } else if (typeof category !== "undefined") {
        sql = 'UPDATE products SET name = ?, price = ?, category = ? WHERE id = ?';
        params = [name, price, category, id];
    } else {
        sql = 'UPDATE products SET name = ?, price = ? WHERE id = ?';
        params = [name, price, id];
    }
    connection.query(sql, params, (err, result) => {
        if (err) {
            console.error('Error updating product:', err);
            return res.status(500).json({ success: false, message: 'Database error while updating product' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.json({ success: true, message: 'Product updated successfully' });
    });
});

/* ================= DELETE PRODUCT ================= */
app.post('/api/delete-product', (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ success: false, message: 'Missing product id' });
    }
    const sql = 'DELETE FROM products WHERE id = ?';
    connection.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error deleting product:', err);
            return res.status(500).json({ success: false, message: 'Database error while deleting product' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.json({ success: true, message: 'Product deleted successfully' });
    });
});

app.listen(3000, function () {
    console.log('Server running at http://localhost:3000');
});
