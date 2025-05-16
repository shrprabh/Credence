import express from 'express';
import mintRoutes from './routes/mintroutes';

const app = express();
const PORT = 3000;
const IP = 'localhost';

app.use('/api', mintRoutes)

app.get('/', (req, res) => {
  res.send('Credence backend is running!');
});

app.listen(PORT, IP, () => {
  console.log(`Server is running on http://${IP}:${PORT}`);
});