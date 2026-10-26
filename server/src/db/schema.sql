-- ============================================================================
-- Grimório 5e — schema do banco de dados
--   * Tabelas de aplicação: usuários, fichas, campanhas, ameaças e rolagens.
--   * Tabelas de catálogo (prefixo catalog_): espelho local dos JSONs do SRD 5e
--     (classes, níveis, magias, equipamentos, monstros...). O seed é modular:
--     basta adicionar/remover uma coleção em db/seed/collections.js.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Usuários
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Personagens (fichas)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS characters (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                TEXT    NOT NULL,
  player_name         TEXT,
  race_index          TEXT,
  subrace_index       TEXT,
  background_index    TEXT,
  alignment_index     TEXT,
  xp                  INTEGER NOT NULL DEFAULT 0,
  -- Bloco de atributos: {"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}
  abilities           TEXT    NOT NULL DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
  save_proficiencies  TEXT    NOT NULL DEFAULT '[]',
  skill_proficiencies TEXT    NOT NULL DEFAULT '[]',
  skill_expertise     TEXT    NOT NULL DEFAULT '[]',
  jack_of_all_trades  INTEGER NOT NULL DEFAULT 0,
  armor_class_bonus   INTEGER NOT NULL DEFAULT 0,
  speed               INTEGER NOT NULL DEFAULT 9,
  hp_current          INTEGER,
  hp_temp             INTEGER NOT NULL DEFAULT 0,
  hp_max_override     INTEGER,
  hp_mode             TEXT    NOT NULL DEFAULT 'average', -- average | rolled
  hp_rolls            TEXT    NOT NULL DEFAULT '{}',
  hp_bonus_per_level  INTEGER NOT NULL DEFAULT 0,
  hit_dice_used       TEXT    NOT NULL DEFAULT '{}',
  spell_slots_used    TEXT    NOT NULL DEFAULT '{}',
  pact_slots_used     INTEGER NOT NULL DEFAULT 0,
  inspiration         INTEGER NOT NULL DEFAULT 0,
  conditions          TEXT    NOT NULL DEFAULT '[]',
  portrait_url        TEXT,
  appearance          TEXT,
  personality         TEXT,
  ideals              TEXT,
  bonds               TEXT,
  flaws               TEXT,
  backstory           TEXT,
  notes               TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);

-- Níveis por classe (multiclasse): Paladino 5 / Bruxo 2 = duas linhas
CREATE TABLE IF NOT EXISTS character_classes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id   INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  class_index    TEXT    NOT NULL,
  subclass_index TEXT,
  level          INTEGER NOT NULL DEFAULT 1,
  hit_die        INTEGER NOT NULL DEFAULT 8,
  UNIQUE (character_id, class_index)
);

-- Inventário (itens do catálogo 5e e itens homebrew)
CREATE TABLE IF NOT EXISTS character_inventory (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_index   TEXT,                       -- referência ao catálogo (equipment/magic-items)
  custom_name  TEXT,                        -- nome quando o item é homebrew
  custom_data  TEXT NOT NULL DEFAULT '{}',  -- statblock do item homebrew
  quantity     INTEGER NOT NULL DEFAULT 1,
  equipped     INTEGER NOT NULL DEFAULT 0,
  attuned      INTEGER NOT NULL DEFAULT 0,
  notes        TEXT
);

CREATE INDEX IF NOT EXISTS idx_inventory_character ON character_inventory(character_id);

-- Magias conhecidas/preparadas + controle de usos diários
CREATE TABLE IF NOT EXISTS character_spells (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id       INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  spell_index        TEXT    NOT NULL,
  source_class_index TEXT,
  prepared           INTEGER NOT NULL DEFAULT 0,
  always_prepared    INTEGER NOT NULL DEFAULT 0,
  uses_max           INTEGER,
  uses_used          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (character_id, spell_index)
);

-- ---------------------------------------------------------------------------
-- Campanhas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  dm_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  description TEXT,
  invite_code TEXT    NOT NULL UNIQUE,
  status      TEXT    NOT NULL DEFAULT 'active',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaign_members (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id  INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
  role         TEXT    NOT NULL DEFAULT 'player', -- dm | player
  joined_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_members_campaign ON campaign_members(campaign_id);

-- ---------------------------------------------------------------------------
-- Ameaças (bestiário homebrew + monstros importados do SRD)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS threats (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  source       TEXT    NOT NULL DEFAULT 'custom', -- srd | custom
  source_index TEXT,
  payload      TEXT    NOT NULL,                  -- statblock completo (formato compatível com o SRD)
  is_homebrew  INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_threats_owner ON threats(owner_id);

-- ---------------------------------------------------------------------------
-- Log de rolagens de dados
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dice_rolls (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id  INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name    TEXT,
  label        TEXT,
  expression   TEXT    NOT NULL,
  result       TEXT    NOT NULL,
  total        INTEGER NOT NULL,
  visibility   TEXT    NOT NULL DEFAULT 'public', -- public | dm | private
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rolls_campaign ON dice_rolls(campaign_id, id);

-- ---------------------------------------------------------------------------
-- Catálogo 5e (espelho dos JSONs do SRD)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalog_classes (
  "index" TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  hit_die INTEGER,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_subclasses (
  "index"     TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  class_index TEXT,
  payload     TEXT NOT NULL
);

-- Tabela de níveis por classe: guarda bônus de proficiência e slots de magia
-- já normalizados para consulta rápida pelo motor de regras.
CREATE TABLE IF NOT EXISTS catalog_levels (
  class_index TEXT    NOT NULL,
  level       INTEGER NOT NULL,
  prof_bonus  INTEGER,
  spell_slots TEXT    NOT NULL DEFAULT '{}',
  payload     TEXT    NOT NULL,
  PRIMARY KEY (class_index, level)
);

CREATE TABLE IF NOT EXISTS catalog_features (
  "index"     TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  class_index TEXT,
  level       INTEGER,
  payload     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_spells (
  "index"       TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  level         INTEGER,
  school        TEXT,
  ritual        INTEGER NOT NULL DEFAULT 0,
  concentration INTEGER NOT NULL DEFAULT 0,
  payload       TEXT NOT NULL
);

-- Relacionamento magia <-> classe (para filtrar a lista de magias por classe)
CREATE TABLE IF NOT EXISTS catalog_spell_classes (
  spell_index TEXT NOT NULL,
  class_index TEXT NOT NULL,
  PRIMARY KEY (spell_index, class_index)
);

CREATE TABLE IF NOT EXISTS catalog_equipment (
  "index"  TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  category TEXT,
  kind     TEXT,
  weight   REAL,
  cost     TEXT,
  payload  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_magic_items (
  "index" TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  rarity  TEXT,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_monsters (
  "index" TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  cr      REAL,
  type    TEXT,
  size    TEXT,
  xp      INTEGER,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_races (
  "index" TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_subraces (
  "index"    TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  race_index TEXT,
  payload    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_backgrounds (
  "index" TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_skills (
  "index" TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  ability TEXT,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_proficiencies (
  "index" TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  type    TEXT,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_reference (
  collection TEXT NOT NULL,   -- ability-scores, damage-types, conditions, ...
  "index"    TEXT NOT NULL,
  name       TEXT NOT NULL,
  payload    TEXT NOT NULL,
  PRIMARY KEY (collection, "index")
);

-- Metadados do seed (versão do pacote 5e-database, data da importação, contagens)
CREATE TABLE IF NOT EXISTS catalog_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
