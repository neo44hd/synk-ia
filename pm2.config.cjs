module.exports = {
  apps: [
    {
      name: 'sinkia-api',
      script: '/Users/davidnows/synkia-app/server/index.js',
      cwd: '/Users/davidnows/synkia-app',
      interpreter: '/opt/homebrew/bin/node',
      interpreter_args: '--experimental-vm-modules --require /Users/davidnows/synkia-app/node-startup.cjs',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      log_file: '/Users/davidnows/.pm2/logs/sinkia-api.log',
      out_file: '/Users/davidnows/.pm2/logs/sinkia-api-out.log',
      error_file: '/Users/davidnows/.pm2/logs/sinkia-api-error.log',
      time: true,
    },
    {
      name: 'sinkia-ollama-proxy',
      script: '/Users/davidnows/synkia-app/server/ollama-proxy.mjs',
      cwd: '/Users/davidnows/synkia-app',
      interpreter: '/opt/homebrew/bin/node',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        OLLAMA_HOST: 'http://localhost:11434',
        OLLAMA_PROXY_PORT: '11435',
      },
      log_file: '/Users/davidnows/.pm2/logs/ollama-proxy.log',
      out_file: '/Users/davidnows/.pm2/logs/ollama-proxy-out.log',
      error_file: '/Users/davidnows/.pm2/logs/ollama-proxy-error.log',
      time: true,
    },
  ],
};