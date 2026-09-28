// Species forms stay in the family comparison even after a raid or Max Battle rotates out.
// This is a form reference, not a list of encounters presently available to catch.
const MEGA = `Venusaur Charizard:X,Y Blastoise Beedrill Pidgeot Alakazam Slowbro Gengar Kangaskhan Pinsir Gyarados Aerodactyl Mewtwo:X,Y Ampharos Steelix Scizor Heracross Houndoom Tyranitar Sceptile Blaziken Swampert Gardevoir Sableye Mawile Aggron Medicham Manectric Sharpedo Camerupt Altaria Banette Absol Glalie Salamence Metagross Latias Latios Rayquaza Lopunny Garchomp Lucario Abomasnow Gallade Audino Diancie`.split(' ');
const GIGANTAMAX = `Venusaur Charizard Blastoise Butterfree Pikachu Meowth Machamp Gengar Kingler Lapras Eevee Snorlax Garbodor Melmetal Rillaboom Cinderace Inteleon Corviknight Orbeetle Drednaw Coalossal Flapple Appletun Sandaconda Toxtricity Centiskorch Hatterene Grimmsnarl Alcremie Copperajah Duraludon Urshifu`.split(' ');
// Confirmed Max species and evolution families can also be extended by live Max events.
const DYNAMAX = `Bulbasaur Ivysaur Venusaur Charmander Charmeleon Charizard Squirtle Wartortle Blastoise Gastly Haunter Gengar Grookey Thwackey Rillaboom Scorbunny Raboot Cinderace Sobble Drizzile Inteleon Wooloo Dubwool Skwovet Greedent Beldum Metang Metagross Toxtricity`.split(' ');

export function permanentFamilyForms(family) {
  const members = new Set(family.map((member) => member.name.toLowerCase()));
  const forms = [];
  for (const entry of MEGA) {
    const [species, variants] = entry.split(':');
    if (!members.has(species.toLowerCase())) continue;
    for (const variant of variants?.split(',') || ['']) forms.push({ name: `Mega ${species}${variant ? ` ${variant}` : ''}`, species, label: 'Mega form · availability varies' });
  }
  for (const species of GIGANTAMAX) if (members.has(species.toLowerCase())) forms.push({ name: `Gigantamax ${species}`, species, label: 'Gigantamax form · availability varies' });
  for (const species of DYNAMAX) if (members.has(species.toLowerCase())) forms.push({ name: `Dynamax ${species}`, species, label: 'Dynamax form · availability varies' });
  return forms;
}
