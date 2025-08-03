import express from 'express';
import { Actuator } from '../src/core/Actuator';

const app = express();
const port = 3000;

// Create actuator instance
const actuator = new Actuator({
  port: 8080, // Use fixed port for easier testing
  basePath: '/actuator',
  enableMappings: true,
  enableHealth: true,
  enableMetrics: true,
  enablePrometheus: true,
  enableInfo: true,
  enableEnv: true
});

// Register custom routes BEFORE starting the actuator
actuator.registerCustomRoutes([
  { method: 'GET', path: '/api/users', handler: 'Get all users' },
  { method: 'POST', path: '/api/users', handler: 'Create new user' },
  { method: 'GET', path: '/api/users/:id', handler: 'Get user by ID' },
  { method: 'PUT', path: '/api/users/:id', handler: 'Update user' },
  { method: 'DELETE', path: '/api/users/:id', handler: 'Delete user' },
  { method: 'GET', path: '/api/products', handler: 'Get all products' },
  { method: 'POST', path: '/api/products', handler: 'Create new product' },
  { method: 'GET', path: '/api/orders', handler: 'Get all orders' },
  { method: 'POST', path: '/api/orders', handler: 'Create new order' },
  { method: 'GET', path: '/health', handler: 'Simple health check' },
  { method: 'GET', path: '/status', handler: 'Application status' }
]);

// Start the actuator
actuator.start().then(() => {
  console.log(`🚀 Actuator started on port ${actuator.getPort()}`);
  console.log(`📊 Mappings available at: http://localhost:${actuator.getPort()}/actuator/mappings`);
  
  // Start the main application
  app.listen(port, () => {
    console.log(`🌐 Main app running on port ${port}`);
    console.log(`📋 Check mappings at: http://localhost:${actuator.getPort()}/actuator/mappings`);
  });
}).catch(error => {
  console.error('Failed to start actuator:', error);
});

// Example API routes (these will be tracked by the middleware)
app.get('/api/users', (_req, res) => {
  res.json({ users: [] });
});

app.post('/api/users', (_req, res) => {
  res.status(201).json({ message: 'User created' });
});

app.get('/api/users/:id', (req, res) => {
  res.json({ user: { id: req.params.id } });
});

app.put('/api/users/:id', (_req, res) => {
  res.json({ message: 'User updated' });
});

app.delete('/api/users/:id', (_req, res) => {
  res.json({ message: 'User deleted' });
});

app.get('/api/products', (_req, res) => {
  res.json({ products: [] });
});

app.post('/api/products', (_req, res) => {
  res.status(201).json({ message: 'Product created' });
});

app.get('/api/orders', (_req, res) => {
  res.json({ orders: [] });
});

app.post('/api/orders', (_req, res) => {
  res.status(201).json({ message: 'Order created' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'OK' });
});

app.get('/status', (_req, res) => {
  res.json({ status: 'running', timestamp: new Date().toISOString() });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await actuator.shutdown();
  process.exit(0);
}); 