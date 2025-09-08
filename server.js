const { exit } = require('node:process');
const mongoose = require('mongoose');
require('dotenv').config();

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

const app = require('./app');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD,
);

mongoose.connect(DB).then(() => console.log('DB connected successfully'));

const port = process.env.PORT || 8000;
// Start Server
const server = app.listen(port, () =>
  console.log(`server running on port ${port}`),
console.log('http://localhost:8000')
);

process.on('unhandledRejection', (err) => {
  console.log(err)
  console.log('Unhandled Rejection! 💥 Shutting down...');
  server.close(() => {
    process.exitCode = 1;
  });
});
