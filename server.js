require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static('public')); 

// --- 1. CONNECT TO MONGODB ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB:', err));

// --- 2. DATABASE SCHEMAS ---

const userSchema = new mongoose.Schema({
    name: String,
    lastActive: { type: Date, default: Date.now }
});

const expenseSchema = new mongoose.Schema({
    tripId: Number,
    payer: String,
    amount: Number,
    description: String,
    participants: [String],
    date: { type: Date, default: Date.now }
});

// Settlement Schema (New)
const settlementSchema = new mongoose.Schema({
    payer: String,     
    recipient: String, 
    amount: Number,
    method: String,    
    date: { type: Date, default: Date.now }
});

const tripSchema = new mongoose.Schema({
    id: { type: Number, unique: true }, 
    name: String,
    currency: String,
    expenses: [expenseSchema],
    createdAt: { type: Date, default: Date.now }
});

// --- MODELS ---
const Trip = mongoose.model('Trip', tripSchema);
const User = mongoose.model('User', userSchema);
const Expense = mongoose.model('Expense', expenseSchema);
const Settlement = mongoose.model('Settlement', settlementSchema);

// --- 3. API ROUTES ---

// Create Trip
app.post('/api/trips', async (req, res) => {
    try {
        const { name, currency } = req.body;
        const lastTrip = await Trip.findOne().sort({ id: -1 });
        const nextId = lastTrip && lastTrip.id ? lastTrip.id + 1 : 101;

        const newTrip = new Trip({ id: nextId, name, currency, expenses: [] });
        await newTrip.save();
        res.status(201).json(newTrip);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add Expense
app.post('/api/trips/:id/expenses', async (req, res) => {
    try {
        const tripId = parseInt(req.params.id); 
        const { payer, amount, description, participants } = req.body;

        const trip = await Trip.findOne({ id: tripId });
        if (!trip) return res.status(404).json({ error: "Trip not found" });

        // Save to Expenses Collection
        await new Expense({ tripId, payer, amount, description, participants }).save();

        // Save to Trip (Embedded)
        trip.expenses.push({ tripId, payer, amount, description, participants });
        await trip.save();

        // Shadow Save User
        if (payer) {
            await User.findOneAndUpdate({ name: payer }, { name: payer }, { upsert: true });
        }

        res.status(201).json({ message: "Expense saved" });
    } catch (error) {
        res.status(500).json({ error: "Could not save expense" });
    }
});

// Save Settlement (New)
app.post('/api/settlements', async (req, res) => {
    try {
        const { payer, recipient, amount, method } = req.body;

        const newSettlement = new Settlement({ payer, recipient, amount, method });
        await newSettlement.save();

        console.log(`Settlement logged: ${payer} -> ${recipient} (₹${amount})`);
        res.status(201).json({ message: "Settlement saved" });
    } catch (error) {
        console.error("Settlement Error:", error);
        res.status(500).json({ error: "Could not save settlement" });
    }
});

// Dummy route for frontend calculation check
app.post('/api/calculate', (req, res) => res.json({ transactions: [] }));

// Serve Frontend
app.get(/.*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));