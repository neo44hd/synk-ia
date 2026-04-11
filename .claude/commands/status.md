# Estado del sistema

Muestra el estado completo del entorno:

1. `pm2 list` — procesos activos
2. `curl -s http://localhost:3001/api/health` — health del backend
3. `curl -s http://localhost:11434/api/tags | python3 -c "import sys,json; [print(m['name']) for m in json.load(sys.stdin).get('models',[])]"` — modelos Ollama
4. `df -h ~/` — espacio en disco
5. `git -C ~/sinkia log --oneline -5` — últimos commits
6. Resume todo en una tabla clara
