import { TaskExecutionPipeline } from '../../src/core/TaskExecutionPipeline';

describe('TaskExecutionPipeline', () => {
  it('should run middlewares in onion order', async () => {
    const pipeline = new TaskExecutionPipeline();
    const order: number[] = [];

    pipeline.use(async (ctx, next) => {
      order.push(1);
      await next();
      order.push(4);
    });

    pipeline.use(async (ctx, next) => {
      order.push(2);
      await next();
      order.push(3);
    });

    await pipeline.execute({});
    expect(order).toEqual([1, 2, 3, 4]);
  });
});
