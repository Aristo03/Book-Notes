import express from "express";
import expressLayouts from 'express-ejs-layouts';
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import methodOverride from "method-override";

const { Pool } = pg;
const app = express();

// Set EJS and middlewares
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(expressLayouts);
app.set('layout', 'layouts/layout');
app.use(methodOverride('_method'));

// PostgreSQL connection (Render-friendly)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// 🏠 Home: list books with sorting
app.get('/', async (req, res, next) => {
  try {
    const sort = req.query.sort;
    let orderBy = 'read_date DESC';
    if (sort === 'rating') orderBy = 'rating DESC';
    else if (sort === 'title') orderBy = 'title ASC';

    const { rows: books } = await pool.query(`SELECT * FROM books ORDER BY ${orderBy}`);
    res.render('index', { books, sort });
  } catch (err) {
    next(err);
  }
});

// 📖 New book form
app.get('/books/new', (req, res) => res.render('form', { book: {} }));

// ➕ Create book
app.post('/books', async (req, res, next) => {
  try {
    const { title, author, notes, rating, read_date } = req.body;
    let cover_url = '';
    try {
      const olKey = await axios.get(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1`);
      const coverId = olKey.data.docs[0]?.cover_i;
      if (coverId) cover_url = `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
    } catch (apiErr) {
      console.error('OpenLibrary API error:', apiErr.message);
    }

    await pool.query(
      `INSERT INTO books (title, author, cover_url, notes, rating, read_date)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [title, author, cover_url, notes, rating, read_date]
    );
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

// ✏️ Edit form
app.get('/books/:id/edit', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM books WHERE id=$1', [req.params.id]);
    res.render('edit', { book: rows[0] });
  } catch (err) {
    next(err);
  }
});

// 📝 Update book
app.put('/books/:id', async (req, res, next) => {
  try {
    const { title, author, notes, rating, read_date } = req.body;
    await pool.query(
      `UPDATE books SET title=$1, author=$2, notes=$3, rating=$4, read_date=$5, updated_at=now()
       WHERE id=$6`,
      [title, author, notes, rating, read_date, req.params.id]
    );
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

// ❌ Delete book
app.delete('/books/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM books WHERE id=$1', [req.params.id]);
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

// 🛑 Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).send('Something went wrong. Please check logs.');
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
