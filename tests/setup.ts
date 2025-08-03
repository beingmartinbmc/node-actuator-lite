// Test setup file
import { performance } from 'perf_hooks';
import { register } from 'prom-client';
import { ErrorHandler } from '../src/utils/errorHandler';

// Setup global error handlers
ErrorHandler.setupGlobalHandlers();

// Mock performance.now for consistent testing
global.performance = performance;

// Increase timeout for async operations
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Clear Prometheus metrics between tests to prevent registration conflicts
beforeEach(() => {
  register.clear();
  // Reset the Actuator's default metrics initialization flag
  const { Actuator } = require('../src/core/Actuator');
  Actuator.resetDefaultMetricsFlag();
});

afterEach(() => {
  register.clear();
});

// Cleanup after all tests
afterAll(() => {
  // Clear any remaining intervals
  const intervals = (global as any).__JEST_INTERVALS__ || [];
  intervals.forEach((interval: NodeJS.Timeout) => clearInterval(interval));
}); 