import dotenv from 'dotenv';
dotenv.config();
import axios from "axios";


import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import bodyParser from 'body-parser';
import cors from 'cors';

import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({credentials:true, origin:"*"}));
app.use(bodyParser.json());

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware: Auth Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Register
app.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const userExists = await prisma.user.findUnique({ where: { username } });
    if (userExists) return res.status(409).json({ message: 'Username already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email
      }
    });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/ai-morket', async(req, res)=>{
  try {
    if (!Array.isArray(req.body.messages)) {
      return res.status(422).json({
        message: "your messages is not valid",
      });
    }
    // console.log("body ai:", req.body.messages)
    const result = await axios.post(
      `${process.env.AI_BASE_URL}/v1/chat/completions`,
      {
        model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
        messages: req.body.messages,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    // console.log("result:", result)
    if (!result.data) {
      return res.status(401).json({
        message: "your promp is nothing",
      });
    }

    return res.status(200).json(result.data);
  } catch (err) {
    res.status(err.status || 500).json({
      message: err.message || "Something went wrong",
      error: err.error || null
    });
  }
})

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ "token": token, "username": username});
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Protected Profile
app.get('/profile', authenticateToken, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { id: true, username: true, email: true, createdAt: true }
  });

  res.json({ message: 'Protected profile', user });
});

// Logout (client-side)
app.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// ✅ Get all ListItem
app.get('/list-items', async (req, res) => {
  try {
    const items = await prisma.listItem.findMany();
    res.json(items);
  } catch (error) {
    console.error('Get ListItem Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
