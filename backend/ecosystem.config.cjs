module.exports = {
  apps: [
    {
      name: 'car-comfort',
      script: 'src/server.js',
      instances: 'max',   // use all available CPU cores
      exec_mode: 'cluster', // PM2 cluster mode — zero-downtime restarts, multi-core
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: '4001'
      }
    },
    {
      name: 'car-comfort-admin',
      cwd: './admin-panel',
      script: 'node',
      args: 'scripts/run-next.mjs start -p 4002',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'notification-worker',
      script: 'npm',
      args: 'run worker:notifications',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};

