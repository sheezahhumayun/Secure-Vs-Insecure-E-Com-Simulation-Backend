const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();
const CryptoJS = require("crypto-js");
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'sheezah', // Your MySQL username
    password: 'sheezah12345', // Your MySQL password
    database: 'secure_ecom'
});
let isSecureMode = false;
// VULNERABLE LOGIN: SQL Injection Point 
// Toggle Endpoint
app.post('/api/toggle-security', (req, res) => {
    // Add a console log here to see if the button is actually reaching the server
    console.log("Toggle request received:", req.body); 
    isSecureMode = req.body.isSecure;
    res.json({ isSecure: isSecureMode }); // Use .json() to be safe
});

// 1. LOGIN (SQL Injection Protection)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    if (isSecureMode) {
        // SECURE: Hash the password before checking the database
        const hashedPassword = CryptoJS.SHA512(password).toString();
        console.log("Login Attempt Hash:", hashedPassword);
        // Use Parameterized Query with the HASHED password
        const query = "SELECT * FROM users WHERE email = ? AND password = ?";
        db.query(query, [email, hashedPassword], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.length > 0) {
                res.send({ message: "Secure Login (Hashed) Success!", user: result[0] });
            } else {
                res.status(401).send({ message: "Invalid Credentials (Hash Mismatch)" });
            }
        });
    } else {
        // INSECURE: Plain-text comparison (Your existing code)
        const query = "SELECT * FROM users WHERE email = '" + email + "' AND password = '" + password + "'";
        db.query(query, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.length > 0) res.send({ message: "Insecure Login Success!", user: result[0] });
            else res.status(401).send({ message: "Invalid Credentials" });
        });
    }
});

// 2. REVIEWS (XSS Protection)
// MAKE SURE THIS IS OUTSIDE OF ANY OTHER ROUTE HANDLER
app.post('/api/reviews', (req, res) => {
    const { content } = req.body;
    
    // Safety check: if content is missing, don't even try the DB
    if (!content) {
        return res.status(400).send({ message: "Review content is required" });
    }

    if (isSecureMode) {
        // SECURE PATH
        db.query("INSERT INTO reviews (content) VALUES (?)", [content], (err, result) => {
            if (err) {
                console.error("SECURE INSERT ERROR:", err);
                return res.status(500).send(err);
            }
            res.send({ message: "Review posted securely!" });
        });
    } else {
        // INSECURE PATH
        const query = `INSERT INTO reviews (content) VALUES ('${content}')`;
        db.query(query, (err, result) => {
            if (err) {
                console.error("INSECURE INSERT ERROR:", err);
                return res.status(500).send(err);
            }
            res.send({ message: "Review posted (Insecure)!" });
        });
    }
});
app.get('/api/reviews', (req, res) => {
    db.query("SELECT * FROM reviews", (err, result) => {
        if (err) {
            console.error("GET REVIEWS ERROR:", err);
            return res.status(500).send(err);
        }
        res.send(result);
    });
});

// 3. PROFILE (IDOR & Authentication Protection)
app.get('/api/profile/:id', (req, res) => {
    const userId = req.params.id;
    
    if (isSecureMode) {
        // SECURE: In a real app, we'd check JWT here. 
        // For this lab, let's simulate a check: only allow ID 2 to see ID 2.
        return res.status(403).send({ message: "Access Denied: You are not authorized to view this profile." });
    } else {
        // INSECURE: Direct Access
        db.query(`SELECT id, email, role FROM users WHERE id = ${userId}`, (err, result) => {
            if (err) return res.status(500).send(err);
            res.send(result[0]);
        });
    }
});

// 4. ORDER (CSRF Protection)
app.post('/api/place-order', (req, res) => {
    if (isSecureMode) {
        // SECURE: Simulate checking for a CSRF Token header
        const csrfToken = req.headers['x-csrf-token'];
        if (!csrfToken) return res.status(403).send({ message: "CSRF Token Missing! Order Blocked." });
        res.send({ message: "Secure Order Placed!" });
    } else {
        // INSECURE: No token check
        res.send({ message: "Insecure Order Placed (Vulnerable to CSRF)!" });
    }
});
app.listen(5000, () => console.log("Server is LIVE on port 5000"));