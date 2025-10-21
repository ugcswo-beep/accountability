const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (for testing - will reset on redeploy)
let expenses = [];
let expenseId = 1;

// ========== HEALTH CHECK ENDPOINT ==========
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        database: 'mock (in-memory)',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: PORT
    });
});

// ========== MAIN ENDPOINT ==========
app.get('/', (req, res) => {
    res.json({
        message: "Accountability System API is running!",
        database: "mock (in-memory)",
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
app.post('/expenses/submit', (req, res) => {
    try {
        console.log('📥 Received expense submission:', req.body);
        
        const expense = {
            id: expenseId++,
            ...req.body,
            status: 'submitted',
            submissionDate: new Date().toISOString(),
            _id: `mock-${expenseId}`
        };

        expenses.push(expense);

        console.log('✅ Expense saved with ID:', expense.id);
        
        res.json({
            success: true,
            message: "Expense submitted successfully",
            expenseId: expense.id,
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
app.get('/expenses/submitted', (req, res) => {
    try {
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
app.get('/expenses/:id', (req, res) => {
    try {
        const expense = expenses.find(e => e.id == req.params.id || e._id === req.params.id);
        
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
app.post('/expenses/process/:id', (req, res) => {
    try {
        const expense = expenses.find(e => e.id == req.params.id || e._id === req.params.id);

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        expense.status = 'processed';
        expense.processedDate = new Date().toISOString();

        console.log('✅ Expense marked as processed:', expense.id);
        
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

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log('🚀 Accountability System API Server Started!');
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💾 Storage: In-memory (mock mode)`);
    console.log(`🔍 Health check: https://accountability-backend-wqms.onrender.com/health`);
    console.log('⏰ Server time:', new Date().toISOString());
    console.log('💡 Note: Using mock storage - data will reset on redeploy');
});
