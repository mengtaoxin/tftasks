export type Migration = {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
};

const createTaskTables = `CREATE TABLE repeat_task_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  period TEXT NOT NULL CHECK (period IN ('day', 'week', 'month', 'year')),
  interval INTEGER NOT NULL CHECK (interval >= 1),
  times_per_period INTEGER NOT NULL CHECK (times_per_period >= 1),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('incomplete', 'complete')),
  parent_id TEXT REFERENCES tasks (id),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  repeat_task_config_id TEXT REFERENCES repeat_task_configs (id) ON DELETE SET NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX tasks_parent_id_idx ON tasks (parent_id);
CREATE INDEX tasks_status_idx ON tasks (status);
CREATE INDEX tasks_repeat_task_config_id_idx ON tasks (repeat_task_config_id);
`;

const addTaskDates = `ALTER TABLE tasks ADD COLUMN starts_at TEXT;
ALTER TABLE tasks ADD COLUMN ends_at TEXT;
`;

export const migrations = [
  {
    version: 1,
    name: 'create-task-tables',
    sql: createTaskTables,
  },
  {
    version: 2,
    name: 'add-task-dates',
    sql: addTaskDates,
  },
] as const satisfies readonly Migration[];
