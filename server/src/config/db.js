const mongoose = require('mongoose');

async function connectDB(uri) {
  if (!uri) throw new Error('MONGODB_URI is not set');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log('✓ MongoDB connected:', mongoose.connection.name);

  mongoose.connection.on('error', (e) => console.error('MongoDB error:', e.message));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  return mongoose.connection;
}

module.exports = { connectDB };
