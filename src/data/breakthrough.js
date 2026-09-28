// Leek Duck's Twilight Trails Research Breakthrough pool, Sep 8–Dec 1, 2026.
// Kept separate from ScrapedDuck's task-by-task field research feed.
// The page does not expose a machine-readable shiny flag for these encounters.
const POOL = `Venusaur:3 Charizard:6 Blastoise:9 Venomoth:49 Persian:53 Golduck:55 Arcanine:59 Dewgong:87 Hypno:97 Electrode:101 Marowak:105 Weezing:110 Seaking:119 Starmie:121 Omastar:139 Kabutops:141 Dratini:147 Dragonite:149 Meganium:154 Typhlosion:157 Feraligatr:160 Xatu:178 Azumarill:184 Ursaring:217 Donphan:232 Blissey:242 Larvitar:246 Sceptile:254 Blaziken:257 Swampert:260 Medicham:308 Whiscash:340 Crawdaunt:342 Claydol:344 Bagon:371 Beldum:374 Torterra:389 Infernape:392 Empoleon:395 Toxicroak:454 Serperior:497 Emboar:500 Samurott:503 Excadrill:530 Leavanny:542 Axew:610 Beartic:614 Deino:633 Chesnaught:652 Delphox:655 Greninja:658 Honedge:679 Goomy:704 Decidueye:724 Incineroar:727 Primarina:730 Jangmo-o:782 Rillaboom:812 Cinderace:815 Inteleon:818 Blipbug:824 Dreepy:885 Meowscarada:908 Skeledirge:911 Quaquaval:914 Klawf:950 Frigibax:996`;

export const BREAKTHROUGH_SOURCE = 'https://leekduck.com/research/#research-breakthrough';
export const BREAKTHROUGH_END = new Date('2026-12-01T10:00:00');
export const breakthroughPool = POOL.split(' ').map((entry) => {
  const [name, id] = entry.split(':');
  return { name, image: `https://cdn.leekduck.com/assets/img/pokemon_icons_crop/pm${id}.icon.png` };
});
