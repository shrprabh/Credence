import express from 'express';
import { mintToken } from '../services/metaplexService';

const router = express.Router();

router.post('/mint', async (req, res) => {
  try {
    const {
      skillName,
      skillDescription,
      skillLevel,
      userPublicKey,
      mintAddress
    } = req.body;

    if (!skillName || !skillDescription || !skillLevel || !userPublicKey) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await mintToken(
      skillName,
      skillDescription,
      skillLevel,
      userPublicKey,
      mintAddress
    );

    res.status(200).json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;