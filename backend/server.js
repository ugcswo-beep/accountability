const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// ========== IMPROVED MONGODB CONNECTION ==========
const connectDB = async () => {
    try {
        console.log('🔗 Attempting to connect to MongoDB...');
        
        if (!process.env.MONGODB_URI) {
            throw new Error('❌ MONGODB_URI environment variable is not defined');
        }

        // Log masked connection string (hides password)
        const maskedURI = process.env.MONGODB_URI.replace(/:[^:]*@/, ':****@');
        console.log('📝 MongoDB URI:', maskedURI);

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`✅ Database Name: ${conn.connection.name}`);
        return conn;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.log('🔄 Retrying connection in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
};

// Initialize database connection
connectDB();

// MongoDB connection event listeners
mongoose.connection.on('connected', () => {
    console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ Mongoose disconnected from MongoDB');
});
// ========== END MONGODB CONNECTION ==========

// Expense Schema
const expenseSchema = new mongoose.Schema({
    organization: { type: String, required: true },
    event: { type: String, required: true },
    dateRange: String,
    cashHolder: String,
    totalAdvanced: Number,
    reportDate: String,
    missingReceiptsExplanation: String,
    expenses: [{
        date: String,
        description: String,
        vendor: String,
        category: String,
        amount: Number,
        purchasedBy: String,
        receiptFile: String,
        notes: String
    }],
    totalExpenses: Number,
    cashToReturn: Number,
    submittedBy: String,
    status: { type: String, default: 'submitted' },
    submissionDate: { type: Date, default: Date.now }
});

const Expense = mongoose.model('Expense', expenseSchema);

// ========== HEALTH CHECK ENDPOINT ==========
app.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState;
    let dbStatusText = 'unknown';
    
    switch(dbStatus) {
        case 0: dbStatusText = 'disconnected'; break;
        case 1: dbStatusText = 'connected'; break;
        case 2: dbStatusText = 'connecting'; break;
        case 3: dbStatusText = 'disconnecting'; break;
    }
    
    res.json({
        status: 'OK',
        database: dbStatusText,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: PORT
    });
});

// ========== MAIN ENDPOINT ==========
app.get('/', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({
        message: "Accountability System API is running!",
        database: dbStatus,
        timestamp: new Date().toISOString(),
        endpoints: {
            health: "GET /health",
            submitExpense: "POST /expenses/submit",
            getSubmitted: "GET /expenses/submitted", 
            markProcessed: "POST /expenses/process/:id",
            getExpense: "GET /expenses/:id"
        }
    });
});

// ========== SUBMIT EXPENSE ENDPOINT ==========
app.post('/expenses/submit', async (req, res) => {
    try {
        console.log('📥 Received expense submission:', req.body);
        
        const expenseData = {
            ...req.body,
            submissionDate: new Date()
        };

        const expense = new Expense(expenseData);
        await expense.save();

        console.log('✅ Expense saved to database with ID:', expense._id);
        
        res.json({
            success: true,
            message: "Expense submitted successfully",
            expenseId: expense._id,
            data: expense
        });
    } catch (error) {
        console.error('❌ Error submitting expense:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit expense: ' + error.message
        });
    }
});

// ========== GET SUBMITTED EXPENSES ENDPOINT ==========
app.get('/expenses/submitted', async (req, res) => {
    try {
        const expenses = await Expense.find().sort({ submissionDate: -1 });
        
        res.json({
            success: true,
            count: expenses.length,
            data: expenses
        });
    } catch (error) {
        console.error('❌ Error fetching expenses:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expenses: ' + error.message
        });
    }
});

// ========== GET SPECIFIC EXPENSE ENDPOINT ==========
app.get('/expenses/:id', async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        
        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }
        
        res.json({
            success: true,
            data: expense
        });
    } catch (error) {
        console.error('❌ Error fetching expense:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expense: ' + error.message
        });
    }
});

// ========== MARK EXPENSE PROCESSED ENDPOINT ==========
app.post('/expenses/process/:id', async (req, res) => {
    try {
        const expense = await Expense.findByIdAndUpdate(
            req.params.id,
            { status: 'processed', processedDate: new Date() },
            { new: true }
        );

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        console.log('✅ Expense marked as processed:', expense._id);
        
        res.json({
            success: true,
            message: `Expense ${req.params.id} marked as processed`,
            data: expense
        });
    } catch (error) {
        console.error('❌ Error processing expense:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process expense: ' + error.message
        });
    }
});

// ========== DELETE EXPENSE ENDPOINT ==========
app.delete('/expenses/:id', async (req, res) => {
    try {
        const expense = await Expense.findByIdAndDelete(req.params.id);

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        console.log('🗑️ Expense deleted:', req.params.id);
        
        res.json({
            success: true,
            message: 'Expense deleted successfully'
        });
    } catch (error) {
        console.error('❌ Error deleting expense:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete expense: ' + error.message
        });
    }
});

// ========== ERROR HANDLING MIDDLEWARE ==========
app.use((err, req, res, next) => {
    console.error('🚨 Unhandled error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'production' ? {} : err.message
    });
});

// ========== 404 HANDLER ==========
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        availableEndpoints: {
            health: 'GET /health',
            submitExpense: 'POST /expenses/submit',
            getSubmitted: 'GET /expenses/submitted',
            markProcessed: 'POST /expenses/process/:id',
            getExpense: 'GET /expenses/:id',
            deleteExpense: 'DELETE /expenses/:id'
        }
    });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log('🚀 Accountability System API Server Started!');
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔍 Health check: https://accountability-backend-wqms.onrender.com/health`);
    console.log(`📊 Main endpoint: https://accountability-backend-wqms.onrender.com/`);
    console.log('⏰ Server time:', new Date().toISOString());
});
