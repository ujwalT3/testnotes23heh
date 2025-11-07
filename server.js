require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

/// Load config from .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/notioniq';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET || 'notioniq-secret-key-change-in-production';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Session Configuration
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        touchAfter: 24 * 3600
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// AI Analysis Endpoint
app.post('/api/analyze', async (req, res) => {
    try {
        const { notes } = req.body;

        if (!notes || notes.length < 50) {
            return res.status(400).json({
                success: false,
                message: 'Please provide at least 50 characters of notes'
            });
        }

        // Call Gemini API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Analyze these study notes and extract exactly 7 important key points. Format as a JSON array of strings. Notes: ${notes}`
                    }]
                }]
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'AI API error');
        }

        const aiResponse = data.candidates[0].content.parts[0].text;
        
        // Parse the AI response to extract points
        let points;
        try {
            // Try to parse as JSON first
            points = JSON.parse(aiResponse);
        } catch (e) {
            // If not JSON, split by newlines and clean up
            points = aiResponse
                .split('\n')
                .filter(line => line.trim().length > 10)
                .map(line => line.replace(/^[-•*\d.]+\s*/, '').trim())
                .slice(0, 7);
        }

        res.json({
            success: true,
            points: points.slice(0, 7)
        });

    } catch (error) {
        console.error('AI Analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to analyze notes. Please try again.'
        });
    }
});

// Generate Quiz Endpoint
app.post('/api/generate-quiz', async (req, res) => {
    try {
        const { notes } = req.body;

        if (!notes || notes.length < 50) {
            return res.status(400).json({
                success: false,
                message: 'Please provide at least 50 characters of notes'
            });
        }

        const prompt = `Based on these study notes, generate exactly 5 multiple choice questions. 
        Format as JSON array with this structure:
        [{"question": "question text", "options": ["A", "B", "C", "D"], "answer": "correct answer", "explanation": "why this is correct"}]
        
        Notes: ${notes}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'AI API error');
        }

        const aiResponse = data.candidates[0].content.parts[0].text;
        
        // Extract JSON from response
        let questions;
        try {
            const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
            questions = JSON.parse(jsonMatch[0]);
        } catch (e) {
            throw new Error('Failed to parse quiz questions');
        }

        res.json({
            success: true,
            questions: questions.slice(0, 5)
        });

    } catch (error) {
        console.error('Quiz generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate quiz. Please try again.'
        });
    }
});

// Sign Up Route
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }

        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });

        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username or email already exists' 
            });
        }

        const user = new User({ username, email, password });
        await user.save();

        req.session.userId = user._id;
        req.session.username = user.username;

        res.status(201).json({ 
            success: true, 
            message: 'Account created successfully',
            user: { username: user.username, email: user.email }
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error. Please try again.' 
        });
    }
});

// Sign In Route
app.post('/api/signin', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email and password are required' 
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        req.session.userId = user._id;
        req.session.username = user.username;

        res.json({ 
            success: true, 
            message: 'Signed in successfully',
            user: { username: user.username, email: user.email }
        });

    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error. Please try again.' 
        });
    }
});

// Logout Route
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: 'Could not log out' 
            });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Check Auth Status
app.get('/api/auth/check', (req, res) => {
    if (req.session.userId) {
        res.json({ 
            authenticated: true, 
            username: req.session.username 
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'Server is working!' });
});
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 MongoDB connected to: ${MONGODB_URI}`);
    console.log(`🤖 AI Analysis enabled with Gemini API`);
});