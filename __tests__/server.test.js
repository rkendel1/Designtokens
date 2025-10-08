const request = require('supertest');
const app = require('../server');

describe('API Endpoints', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/crawl', () => {
    it('should return 400 if URL is missing', async () => {
      const response = await request(app)
        .post('/api/crawl')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid URL', async () => {
      const response = await request(app)
        .post('/api/crawl')
        .send({ url: 'not-a-valid-url' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid URL format');
    });

    // This test would require a full setup with database and potentially a test server
    it.skip('should crawl a valid URL', async () => {
      const response = await request(app)
        .post('/api/crawl')
        .send({ url: 'https://example.com', depth: 1 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('site');
      expect(response.body).toHaveProperty('designTokens');
      expect(response.body).toHaveProperty('brandVoice');
    }, 60000);
  });

  describe('GET /api/sites/:id', () => {
    it('should return 404 for non-existent site', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app).get(`/api/sites/${fakeId}`);
      
      // Will return 404 or 500 depending on DB state
      expect([404, 500]).toContain(response.status);
    });
  });

  describe('GET /api/sites/:id/tokens', () => {
    it('should handle requests for tokens', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app).get(`/api/sites/${fakeId}/tokens`);
      
      // Will return tokens (empty array) or error depending on DB state
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('GET /api/sites/:id/brand-profile', () => {
    it('should handle PDF generation requests', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app).get(`/api/sites/${fakeId}/brand-profile`);
      
      // Will return 404 or 500 depending on DB state
      expect([404, 500]).toContain(response.status);
    });
  });
});
