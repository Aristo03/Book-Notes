import express from "express";
import expressLayouts from 'express-ejs-layouts';
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import methodOverride from "method-override";

const { Pool } = pg;
const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(expressLayouts);
app.set('layout', 'layouts/layout');
app.use(methodOverride('_method'));

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "books",
  password: "#Postgres#",
  port: 5432,
});

// Home: list books with sorting
app.get('/', async (req, res) => {
  const sort = req.query.sort;
  let orderBy = 'read_date DESC';
  if (sort === 'rating') orderBy = 'rating DESC';
  else if (sort === 'title') orderBy = 'title ASC';
  const { rows: books } = await pool.query(`SELECT * FROM books ORDER BY ${orderBy}`);
  res.render('index', { books, sort });
});

// New book form (with cover fetch)
app.get('/books/new', (req, res) => res.render('form', { book: {} }));

app.post('/books', async (req, res) => {
  const { title, author, notes, rating, read_date } = req.body;
  let cover_url = '';
  try {
    const olKey = await axios.get(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1`);
    const coverId = olKey.data.docs[0]?.cover_i;
    if (coverId) cover_url = `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
  } catch (err) { console.error('Cover API error', err); }

  await pool.query(
    `INSERT INTO books (title, author, cover_url, notes, rating, read_date)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [title,author,cover_url,notes,rating,read_date]
  );
  res.redirect('/');
});

// Edit book
app.get('/books/:id/edit', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM books WHERE id=$1', [req.params.id]);
  res.render('edit', { book: rows[0] });
});

app.put('/books/:id', async (req, res) => {
  const { title, author, notes, rating, read_date } = req.body;
  await pool.query(
    `UPDATE books SET title=$1, author=$2, notes=$3, rating=$4, read_date=$5, updated_at=now()
     WHERE id=$6`,
    [title,author,notes,rating,read_date,req.params.id]
  );
  res.redirect('/');
});

// Delete
app.delete('/books/:id', async (req, res) => {
  await pool.query('DELETE FROM books WHERE id=$1', [req.params.id]);
  res.redirect('/');
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('An error occurred – check the console.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
