import * as grpc from '@grpc/grpc-js';
import { CatalogServiceHandlers } from '../../protos/cropfresh/catalog/CatalogService';
import { Logger } from 'pino';

export const catalogServiceHandlers = (logger: Logger): CatalogServiceHandlers => ({
  GetProduct: (call, callback) => {
    logger.info('GetProduct called');
    callback(null, { id: call.request.id, name: 'Stub Product', price: 100, quantity: 10 });
  },
  CheckAvailability: (call, callback) => {
    logger.info('CheckAvailability called');
    callback(null, { available: true, quantity: 10 });
  },
  CreateProduct: (call, callback) => {
    logger.info('CreateProduct called');
    callback(null, { id: 'new-id', ...call.request });
  },
  UpdateProduct: (call, callback) => {
    logger.info('UpdateProduct called');
    callback(null, { ...call.request });
  },
  DeleteProduct: (call, callback) => {
    logger.info('DeleteProduct called');
    callback(null, { success: true });
  },
  ListProducts: (call, callback) => {
    logger.info('ListProducts called');
    callback(null, { products: [], total: 0 });
  }
});
