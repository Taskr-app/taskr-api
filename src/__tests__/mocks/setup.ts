import 'dotenv/config';
import util from 'util';
import { redis } from '../../services/redis';
const exec = util.promisify(require('child_process').exec);

const globalSetup = async () => {
  console.log('\x1b[2m%s\x1b[0m', 'Applying global test setup...');
  try {
    const { stdout, stderr } = await exec('yarn db:seed');
    if (stdout) console.log('Running seed script: ', stdout);
    if (stderr) console.log('Seed error: ', stderr);
    console.log('\x1b[32m%s\x1b[0m', 'Successfully seeded test database');
    await redis.flushall();
    console.log('\x1b[2m%s\x1b[0m', 'Redis storage reset')
    return true;
  } catch (err) {
    console.log(err);
    return err;
  }
};

export default globalSetup;
