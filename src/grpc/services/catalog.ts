import * as grpc from '@grpc/grpc-js';
import { CatalogServiceHandlers } from '../../protos/cropfresh/catalog/CatalogService';
import { Logger } from 'pino';

export const catalogServiceHandlers = (logger: Logger): CatalogServiceHandlers => ({
  ListProduce: (call, callback) => {
    logger.info('ListProduce called');
    callback(null, { items: [], total: 0, page: 1 });
  },
  GetProduceDetails: (call, callback) => {
    logger.info('GetProduceDetails called');
    callback(null, { item: { id: '1', name: 'Test Produce' } as any, digitalTwinId: 'dt-1' });
  },
  UpdateInventory: (call, callback) => {
    logger.info('UpdateInventory called');
    callback(null, { success: true, newQuantity: 100 });
  }
});
