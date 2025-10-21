const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// MongoDB connection
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const client = new MongoClient(uri);
let db, submittedExpensesCollection;

// Connect to MongoDB
async function connectDB() {
  try {
    await client.connect();
    db = client.db('expense-tracker');
    submittedExpensesCollection = db.collection('submitted_expenses');
    console.log('Connected to MongoDB - Accountability System');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

connectDB();

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Accountability System API is running!',
    endpoints: {
      submitExpense: 'POST /expenses/submit',
      getSubmitted: 'GET /expenses/submitted',
      markProcessed: 'POST /expenses/process/:id'
    }
  });
});

// SUBMIT expense with receipt
app.post('/expenses/submit', upload.single('receipt'), async (req, res) => {
  try {
    const { description, amount, category, date, submittedBy, notes, startingBalance } = req.body;
    
    if (!description || !amount) {
      return res.status(400).json({ error: 'Description and amount are required' });
    }

    const submittedExpense = {
      description,
      amount: parseFloat(amount),
      category: category || 'Other',
      date: date || new Date().toISOString().split('T')[0],
      submittedBy: submittedBy || 'Anonymous',
      notes: notes || '',
      fundSource: 'petty-cash',
      startingBalance: startingBalance ? parseFloat(startingBalance) : null,
      status: 'submitted',
      receipt: req.file ? req.file.filename : null,
      submittedAt: new Date(),
      processed: false,
      processedAt: null,
      processedBy: null
    };

    const result = await submittedExpensesCollection.insertOne(submittedExpense);
    res.status(201).json({ 
      message: 'Expense submitted successfully', 
      expense: { ...submittedExpense, _id: result.insertedId } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit expense' });
  }
});

// GET all submitted expenses
app.get('/expenses/submitted', async (req, res) => {
  try {
    const expenses = await submittedExpensesCollection.find({}).sort({ submittedAt: -1 }).toArray();
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch submitted expenses' });
  }
});

// MARK as processed
app.post('/expenses/process/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { processedBy, accountingRef } = req.body;
    
    const result = await submittedExpensesCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          processed: true,
          processedAt: new Date(),
          processedBy: processedBy || 'Admin',
          accountingRef: accountingRef || '',
          status: 'processed'
        } 
      }
    );
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json({ message: 'Expense marked as processed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process expense' });
  }
});

// Serve receipt files
app.use('/uploads', express.static('uploads'));

// Start server
app.listen(PORT, () => {
  console.log(`Accountability System running on port ${PORT}`);
});
