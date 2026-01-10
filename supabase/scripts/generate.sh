#!/bin/bash
set -e

# Get project name from config (first uncommented line)
PROJECT_NAME=$(grep "^project_id" supabase/config.toml | head -1 | cut -d'"' -f2)

echo "Generating migration from schema.sql..."
echo "Project: $PROJECT_NAME"

# 1. Reset local DB to current migration state
supabase db reset

# 2. Create shadow schema and apply desired state (using Docker)
docker exec -i "supabase_db_${PROJECT_NAME}" psql -U postgres -c "CREATE SCHEMA IF NOT EXISTS desired;"

# Replace public. with desired. and apply schema
sed 's/public\./desired./g' supabase/schemas/schema.sql | docker exec -i "supabase_db_${PROJECT_NAME}" psql -U postgres

# 3. Generate migration (auto-named with timestamp)
supabase db diff --schema public --use-migra -f schema_update

# 4. Cleanup
docker exec -i "supabase_db_${PROJECT_NAME}" psql -U postgres -c "DROP SCHEMA IF EXISTS desired CASCADE;"

echo "Done! Check supabase/migrations/ for the new migration."
