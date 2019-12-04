import 'dotenv/config';
import util from 'util';
import { redis } from "../../services/redis";
const exec = util.promisify(require('child_process').exec)

const globalSetup = async () => {
  console.log("Applying global test setup...")
  try {
    const { stdout, stderr } = await exec('yarn db:seed');
    await redis.flushall();
    if (stdout) console.log('Seed script: ', stdout)
    if (stderr) console.log('Seed error: ', stderr)
    console.log('Successfully seeded test database')
    return true
  } catch (err) {
    console.log(err)
    return err;
  }
}

export default globalSetup