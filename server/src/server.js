require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { connectDB } = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const voterRoutes = require('./routes/voters.routes');
const editRoutes = require('./routes/edits.routes');
const subscribeRoutes = require('./routes/subscribe.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '4mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Public app config for the login / subscribe screens.
app.get('/api/config', (_req, res) => {
  res.json({
    owner: process.env.OWNER_NAME || 'Shahrukh',
    title: process.env.APP_TITLE || 'जालिया द्वितीय ग्राम पंचायत',
    contactMobile: process.env.CONTACT_MOBILE || '6378375233',
    plan: '₹5,000 / माह',
  });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/auth', authRoutes);
app.use('/api/voters', voterRoutes);
app.use('/api/edits', editRoutes);
app.use('/api/subscribe', subscribeRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => res.status(404).json({ error: 'not_found', path: req.path }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'server_error' });
});

(async () => {
  try {
    await connectDB(process.env.MONGODB_URI);
    app.listen(PORT, () => console.log(`✓ API listening on http://localhost:${PORT}`));
  } catch (e) {
    console.error('✗ Failed to start server:', e.message);
    process.exit(1);
  }
})();
