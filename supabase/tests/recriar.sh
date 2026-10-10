#!/bin/sh
# Recria o banco local de testes com o stub do Supabase e todas as migrations
set -e
cd "$(dirname "$0")/../.."
P="psql -h /tmp -p 5499 -U pgtest -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists pps" -c "create database pps" >/dev/null
$P -d pps -f supabase/tests/stub_supabase.sql >/dev/null
for f in supabase/migrations/*.sql; do $P -d pps -f "$f" >/dev/null 2>&1 || { echo "falhou: $f"; $P -d pps -f "$f" 2>&1 | grep -i error | head -3; exit 1; }; done
echo "banco pps pronto"
