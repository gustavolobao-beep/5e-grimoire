/** Validações (Zod) dos payloads de ficha. */
import { z } from 'zod';

const nullableString = (max = 120) => z.string().trim().max(max).nullable().optional();

export const abilityScoresSchema = z.object({
  str: z.number().int().min(1).max(40),
  dex: z.number().int().min(1).max(40),
  con: z.number().int().min(1).max(40),
  int: z.number().int().min(1).max(40),
  wis: z.number().int().min(1).max(40),
  cha: z.number().int().min(1).max(40),
}).partial();

const classEntrySchema = z.object({
  classIndex: z.string().trim().min(1),
  subclassIndex: z.string().trim().min(1).nullable().optional(),
  level: z.number().int().min(1).max(20),
  hitDie: z.number().int().min(4).max(20).optional(),
});

/** Campos editáveis pela ficha (patch parcial). */
export const updateCharacterSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  playerName: nullableString(80),
  raceIndex: nullableString(),
  subraceIndex: nullableString(),
  backgroundIndex: nullableString(),
  alignmentIndex: nullableString(),
  xp: z.number().int().min(0).max(1000000).optional(),
  abilities: z.object({
    str: z.number().int().min(1).max(40),
    dex: z.number().int().min(1).max(40),
    con: z.number().int().min(1).max(40),
    int: z.number().int().min(1).max(40),
    wis: z.number().int().min(1).max(40),
    cha: z.number().int().min(1).max(40),
  }).partial().optional(),
  saveProficiencies: z.array(z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha'])).optional(),
  skillProficiencies: z.array(z.string()).optional(),
  skillExpertise: z.array(z.string()).optional(),
  jackOfAllTrades: z.boolean().optional(),
  armorClassBonus: z.number().int().min(-10).max(20).optional(),
  speed: z.number().int().min(0).max(60).optional(),
  hpCurrent: z.number().int().nullable().optional(),
  hpTemp: z.number().int().min(0).max(999).optional(),
  hpMaxOverride: z.number().int().min(0).nullable().optional(),
  hpMode: z.enum(['average', 'rolled']).optional(),
  // Um `null` por nível significa "escolhi a média" (nível sem rolagem gravada).
  hpRolls: z.record(z.array(z.number().int().min(1).max(20).nullable())).optional(),
  hpBonusPerLevel: z.number().int().min(-5).max(20).optional(),
  hitDiceUsed: z.record(z.number().int().min(0).max(20)).optional(),
  spellSlotsUsed: z.record(z.number().int().min(0).max(9)).optional(),
  pactSlotsUsed: z.number().int().min(0).max(4).optional(),
  inspiration: z.union([z.boolean(), z.number().int().min(0).max(3)]).optional(),
  conditions: z.array(z.string()).optional(),
  portraitUrl: nullableString(400),
  appearance: nullableString(4000),
  personality: nullableString(4000),
  ideals: nullableString(4000),
  bonds: nullableString(4000),
  flaws: nullableString(4000),
  backstory: nullableString(20000),
  notes: nullableString(20000),
});

/**
 * Criação: mesmos campos da edição (para já criar a ficha completa com
 * proficiências, HP e magias), com nome e classes obrigatórios.
 */
export const createCharacterSchema = updateCharacterSchema.extend({
  name: z.string().trim().min(1, 'Informe o nome do personagem.').max(80),
  classes: z.array(classEntrySchema).min(1, 'Escolha ao menos uma classe.').max(6).optional(),
  abilities: abilityScoresSchema.optional(),
});

export const hpPatchSchema = z.object({
  current: z.number().int().optional(),
  delta: z.number().int().optional(),
  temp: z.number().int().min(0).max(999).optional(),
  maxOverride: z.number().int().min(0).nullable().optional(),
}).refine(
  (value) => value.current !== undefined || value.delta !== undefined || value.temp !== undefined || value.maxOverride !== undefined,
  { message: 'Informe "current", "delta", "temp" ou "maxOverride".' },
);

export const classesPayloadSchema = z.object({
  classes: z.array(classEntrySchema).min(1).max(6),
  hitDiceUsed: z.record(z.number().int().min(0).max(20)).optional(),
  allowPrerequisiteOverride: z.boolean().optional(),
});

export const inventoryItemSchema = z.object({
  itemIndex: z.string().trim().min(1).nullable().optional(),
  customName: nullableString(120),
  customData: z.record(z.any()).optional(),
  kind: z.enum(['weapon', 'armor', 'shield', 'gear', 'magic']).optional(),
  quantity: z.number().int().min(0).max(9999).optional(),
  equipped: z.boolean().optional(),
  attuned: z.boolean().optional(),
  notes: nullableString(2000),
});

export const inventoryPatchSchema = inventoryItemSchema.partial();

export const spellEntrySchema = z.object({
  spellIndex: z.string().trim().min(1),
  sourceClassIndex: z.string().trim().min(1).nullable().optional(),
  prepared: z.boolean().optional(),
  alwaysPrepared: z.boolean().optional(),
  usesMax: z.number().int().min(0).max(99).nullable().optional(),
});

export const spellPatchSchema = z.object({
  prepared: z.boolean().optional(),
  alwaysPrepared: z.boolean().optional(),
  usesMax: z.number().int().min(0).max(99).nullable().optional(),
  usesUsed: z.number().int().min(0).max(99).optional(),
  sourceClassIndex: z.string().trim().min(1).nullable().optional(),
});
