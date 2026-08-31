import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'child_process';

async function start() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log(`Started in-memory MongoDB at ${uri}`);
  
  process.env.MONGO_URI = uri;
  
  const child = spawn('npm.cmd', ['run', 'dev'], {
    stdio: 'inherit',
    env: { ...process.env },
    shell: true
  });
  
  child.on('exit', () => {
    mongod.stop();
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
  });
}

start().catch(console.error);
