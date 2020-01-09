import 'dotenv/config';
import { redis } from '../../services/redis';

const globalTeardown = async () => {
  try {
    await redis.flushall();
    redis.disconnect();
    console.log('Test environment has been shutdown successfully');
    return true;
  } catch (err) {
    console.log(err);
    return err;
  }
};

export default globalTeardown;
