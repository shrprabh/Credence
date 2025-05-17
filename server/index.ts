import express from 'express';

const app = express();
const PORT = 3000;
const IP = '172.29.213.171';

app.get('/', (req, res) => {
  res.send('Credence backend is running!');
});

app.listen(PORT, IP, () => {
  console.log(`Server is running on http://${IP}:${PORT}`);
});