import mockPool from './__mocks__/database';

jest.mock('../config/database', () => ({
  __esModule: true,
  default: mockPool,
})); 