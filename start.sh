#!/bin/bash
# Start Next.js dev server with warmup
# This script starts the server and pre-compiles all routes

cd /home/z/my-project

# Kill any existing server
pkill -f "next dev" 2>/dev/null
sleep 1

# Clean cache
rm -rf .next

# Start server in background
npx next dev -p 3000 > dev.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to be ready
for i in $(seq 1 30); do
  if ss -tlnp 2>/dev/null | grep -q ":3000"; then
    echo "Server ready on port 3000"
    break
  fi
  sleep 1
done

# Warmup - pre-compile all routes
echo "Warming up routes..."
curl -s http://127.0.0.1:3000/ > /dev/null 2>&1
curl -s http://127.0.0.1:3000/api/projects > /dev/null 2>&1
curl -s http://127.0.0.1:3000/api/themes > /dev/null 2>&1
curl -s -X POST http://127.0.0.1:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"warmup","code":"A-->B","direction":"rtl","fontFamily":"Vazirmatn","fontSize":16,"textDirection":"rtl","stylePresets":"{}"}' > /dev/null 2>&1

echo "Warmup complete. Server is ready for use."
echo "Memory usage:"
ps aux | grep "next-server" | grep -v grep | awk '{print "  RSS: " $6/1024 " MB"}'
