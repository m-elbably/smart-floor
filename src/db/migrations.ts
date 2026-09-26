// Ordered schema migrations. Index i upgrades PRAGMA user_version i -> i+1. Never edit a shipped entry; append.
// Column names are camelCase so rows map 1:1 onto the types in src/types.ts.
export const migrations: string[] = [
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    thumbnail BLOB,
    site TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE floors (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level INTEGER NOT NULL,
    elevation REAL NOT NULL,
    height REAL NOT NULL DEFAULT 2.8,
    slab REAL NOT NULL DEFAULT 0.2
  );

  CREATE TABLE rooms (
    id TEXT PRIMARY KEY,
    floorId TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'generic',
    polygon TEXT NOT NULL,
    floorMaterial TEXT NOT NULL DEFAULT 'wood',
    wallColor TEXT NOT NULL DEFAULT '#f2efe9',
    ceiling INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE walls (
    id TEXT PRIMARY KEY,
    floorId TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    a TEXT NOT NULL,
    b TEXT NOT NULL,
    thickness REAL NOT NULL,
    height REAL NOT NULL,
    kind TEXT NOT NULL DEFAULT 'wall'
  );

  CREATE TABLE openings (
    id TEXT PRIMARY KEY,
    floorId TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    host TEXT NOT NULL,
    along REAL NOT NULL,
    kind TEXT NOT NULL,
    preset TEXT NOT NULL DEFAULT '',
    width REAL NOT NULL,
    height REAL NOT NULL,
    sill REAL NOT NULL DEFAULT 0,
    props TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE stairs (
    id TEXT PRIMARY KEY,
    floorId TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    rotation REAL NOT NULL DEFAULT 0,
    params TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE zones (
    id TEXT PRIMARY KEY,
    floorId TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    polygon TEXT NOT NULL,
    props TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE items (
    id TEXT PRIMARY KEY,
    floorId TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    catalogId TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    z REAL NOT NULL DEFAULT 0,
    rotation REAL NOT NULL DEFAULT 0,
    scale TEXT NOT NULL DEFAULT '[1,1,1]',
    variant TEXT,
    name TEXT
  );

  CREATE TABLE catalogUser (id TEXT PRIMARY KEY, manifest TEXT NOT NULL, glb BLOB);

  CREATE INDEX idxFloorsProject ON floors(projectId);
  CREATE INDEX idxRoomsFloor ON rooms(floorId);
  CREATE INDEX idxWallsFloor ON walls(floorId);
  CREATE INDEX idxOpeningsFloor ON openings(floorId);
  CREATE INDEX idxStairsFloor ON stairs(floorId);
  CREATE INDEX idxZonesFloor ON zones(floorId);
  CREATE INDEX idxItemsFloor ON items(floorId);
  `
]
