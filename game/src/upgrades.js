// The level-up boons: what each one does, how far it stacks, and how it is described on
// its card. A boon at its cap never appears in the offered three again.

export const UPGRADES = [
  {
    id: 'focus',
    name: 'Ember Focus',
    desc: '+25% bolt damage',
    max: 5,
    apply(player) {
      player.damage *= 1.25;
    },
  },
  {
    id: 'rapid',
    name: 'Rapid Wick',
    desc: '+20% fire rate',
    max: 5,
    apply(player) {
      player.fireInterval *= 0.83;
    },
  },
  {
    id: 'swift',
    name: 'Swift Boots',
    desc: '+12% move speed',
    max: 4,
    apply(player) {
      player.speed *= 1.12;
    },
  },
  {
    id: 'twin',
    name: 'Twin Flame',
    desc: '+1 bolt per volley',
    max: 3,
    apply(player) {
      player.projectiles += 1;
    },
  },
  {
    id: 'pierce',
    name: 'Piercing Light',
    desc: 'Bolts pierce +1 gloom',
    max: 3,
    apply(player) {
      player.pierce += 1;
    },
  },
  {
    id: 'magnet',
    name: 'Shard Magnet',
    desc: '+60% shard pickup radius',
    max: 4,
    apply(player) {
      player.magnet *= 1.6;
    },
  },
  {
    id: 'wax',
    name: 'Thick Wax',
    desc: '+25 max health, heal 25',
    max: 5,
    apply(player) {
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
    },
  },
  {
    id: 'aura',
    name: 'Ember Aura',
    desc: 'A burning ring sears nearby glooms',
    max: 3,
    apply(player) {
      player.auraLevel += 1;
      player.auraRadius = 80 + 30 * player.auraLevel;
      player.auraDps = 8 + 7 * player.auraLevel;
    },
  },
];

/** Roll three distinct boons the player has not maxed, in random order. */
export function rollUpgrades(random, levels) {
  const available = UPGRADES.filter((upgrade) => (levels[upgrade.id] ?? 0) < upgrade.max);
  for (let i = available.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, 3);
}
