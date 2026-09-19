export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

export type DiceSet = {
  id: string;
  values: DieValue[];
};

export type SumRollRound = {
  id: number;
  target: number;
  sets: DiceSet[];
  correctSetId: string;
};

const DIE_VALUES: DieValue[] = [1, 2, 3, 4, 5, 6];
const SET_COUNT = 4;

function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomDie(random: () => number): DieValue {
  return DIE_VALUES[Math.floor(random() * DIE_VALUES.length)];
}

function createDiceValues(count: number, random: () => number): DieValue[] {
  return Array.from({ length: count }, () => randomDie(random));
}

function diceKey(values: DieValue[]): string {
  return [...values].sort((a, b) => a - b).join("-");
}

export function getDiceSum(values: DieValue[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function generateRound(roundNumber: number, runSeed = 1): SumRollRound {
  const random = createRandom(runSeed * 10_007 + roundNumber * 97);
  const diceCount = roundNumber <= 3 ? 3 : roundNumber <= 6 ? 4 : 5;
  const correctValues = createDiceValues(diceCount, random);
  const target = getDiceSum(correctValues);
  const correctIndex = Math.floor(random() * SET_COUNT);
  const usedSets = new Set([diceKey(correctValues)]);
  const sets: DiceSet[] = [];

  for (let index = 0; index < SET_COUNT; index += 1) {
    if (index === correctIndex) {
      sets.push({ id: `set-${index}`, values: correctValues });
      continue;
    }

    let values = createDiceValues(diceCount, random);
    let attempts = 0;

    while (
      (getDiceSum(values) === target || usedSets.has(diceKey(values))) &&
      attempts < 250
    ) {
      values = createDiceValues(diceCount, random);
      attempts += 1;
    }

    usedSets.add(diceKey(values));
    sets.push({ id: `set-${index}`, values });
  }

  return {
    id: roundNumber,
    target,
    sets,
    correctSetId: `set-${correctIndex}`,
  };
}
