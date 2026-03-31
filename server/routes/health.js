import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      email: !!process.env.EMAIL_APP_PASSWORD,
      biloop: !!process.env.ASSEMPSA_BILOOP_API_KEY,
      revo: !!process.env.REVO_TOKEN_LARGO,
      eseecloud: !!process.env.ESEECLOUD_USERNAME
    }
  });
});

healthRouter.get('/config', (req, res) => {
  res.json({
    EMAIL_USER: process.env.EMAIL_USER || 'info@chickenpalace.es',
    EMAIL_APP_PASSWORD: process.env.EMAIL_APP_PASSWORD ? '***configured***' : 'NOT SET',
    ASSEMPSA_BILOOP_API_KEY: process.env.ASSEMPSA_BILOOP_API_KEY ? '***configured***' : 'NOT SET',
    REVO_TOKEN_CORTO: process.env.REVO_TOKEN_CORTO ? '***configured***' : 'NOT SET',
    REVO_TOKEN_LARGO: process.env.REVO_TOKEN_LARGO ? '***configured***' : 'NOT SET',
    ESEECLOUD_USERNAME: process.env.ESEECLOUD_USERNAME ? '***configured***' : 'NOT SET'
  });
});
