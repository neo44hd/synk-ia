# Deploy a producción

Ejecuta el pipeline de deploy completo:

1. `cd ~/sinkia && npm run build`
2. Verifica que no hay errores de build
3. `git add -A && git commit -m "deploy: $ARGUMENTS" && git push origin main`
4. `pm2 restart sinkia-api --update-env`
5. Espera 5 segundos y verifica: `curl -s http://localhost:3001/api/health`
6. Muestra el resultado
