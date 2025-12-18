import { Router } from 'express';
import { mediaController } from '../controllers/media.controller';

const router = Router();

router.get('/cameras', mediaController.getCameras);
router.get('/cameras/:cameraId/dates', mediaController.getDates);
router.get('/cameras/:cameraId/dates/:date/videos', mediaController.getVideos);
router.get('/videos/stream', mediaController.streamVideo);
router.get('/videos/thumbnail', mediaController.getThumbnail);
router.get('/videos/labels', mediaController.getVideoLabel);
router.post('/videos/labels', mediaController.triggerVideoLabel);

export default router;
