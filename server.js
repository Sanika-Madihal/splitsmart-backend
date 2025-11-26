require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serves your index.html, style.css, script.js

// --- 1. CONNECT TO MONGODB ---
// This connects to the Atlas cluster using the password you saved in Render
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB:', err));

// --- 2. DATABASE SCHEMAS ---

// User Schema: Stores names so you can see "Users" in MongoDB
const userSchema = new mongoose.Schema({
    name: String,
    lastActive: { type: Date, default: Date.now }
});

// Expense Schema: Embedded inside Trips
const expenseSchema = new mongoose.Schema({
    payer: String,
    amount: Number,
    description: String,
    participants: [String], // Stores names like ["Sanika", "Rohan"]
    date: { type: Date, default: Date.now }
});

// Trip Schema: The main container
const tripSchema = new mongoose.Schema({
    // Custom ID field to match Frontend (101, 102...) instead of MongoDB's _id
    id: { type: Number, unique: true }, 
    name: String,
    currency: String,
    expenses: [expenseSchema],
    createdAt: { type: Date, default: Date.now }
});

// Create Models
const Trip = mongoose.model('Trip', tripSchema);
const User = mongoose.model('User', userSchema);

// --- 3. API ROUTES ---

// POST /api/trips 
// Creates a new group and assigns it the next ID (101, 102...)
app.post('/api/trips', async (req, res) => {
    try {
        const { name, currency } = req.body;
        
        // Logic to emulate Frontend ID generation:
        // Find the trip with the highest ID and add +1. 
        // If no trips exist, start at 101.
        const lastTrip = await Trip.findOne().sort({ id: -1 });
        const nextId = lastTrip && lastTrip.id ? lastTrip.id + 1 : 101;

        const newTrip = new Trip({ 
            id: nextId, 
            name, 
            currency, 
            expenses: [] 
        });
        
        const savedTrip = await newTrip.save();
        console.log(`Trip created: ${name} (ID: ${nextId})`);
        res.status(201).json(savedTrip);
    } catch (error) {
        console.error("Error creating trip:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/trips/:id/expenses
// Adds an expense to the specific trip ID (e.g., 101)
app.post('/api/trips/:id/expenses', async (req, res) => {
    try {
        const tripId = parseInt(req.params.id); // Parse "101" to Number
        const { payer, amount, description, participants } = req.body;

        // 1. Find the trip using our custom 'id' field
        const trip = await Trip.findOne({ id: tripId });

        if (!trip) {
            console.log(`Trip ${tripId} not found in DB!`);
            return res.status(404).json({ error: "Trip not found" });
        }

        // 2. Add the expense to the trip
        trip.expenses.push({ payer, amount, description, participants });
        await trip.save();

        // 3. "Shadow Save" the User
        // If 'Sanika' pays, ensure 'Sanika' exists in the Users collection
        if (payer) {
            await User.findOneAndUpdate(
                { name: payer }, 
                { name: payer, lastActive: new Date() }, 
                { upsert: true } // Create if it doesn't exist
            );
        }

        console.log(`Expense added to Trip ${tripId}: ${description} by ${payer}`);
        res.status(201).json({ message: "Expense saved", data: req.body });
    } catch (error) {
        console.error("Error saving expense:", error);
        res.status(500).json({ error: "Could not save expense" });
    }
});

// POST /api/calculate 
// Dummy endpoint to satisfy the frontend fetch call.
// (Actual settlement calculation happens in your script.js locally)
app.post('/api/calculate', (req, res) => {
    res.json({ transactions: [] });
});

// --- 4. SERVE FRONTEND ---
// Catch-all route to serve the HTML file for any other path
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});