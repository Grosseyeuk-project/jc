// Extrait le texte Louis Segond 1910 des citations choisies dans textes.json.
// Source : dépôt BibleCorps/FRA-B-LSG1910-PD-UBS (domaine public), figé sur un commit
// pour que le texte ne change pas sous nos pieds.
// Usage : npm run citations            → écrit src/data/citations-lsg.json
//         npm run citations -- --tout  → écrit aussi tous les versets dans lsg-evangiles.json (aide au choix)
import { readFile, writeFile } from 'node:fs/promises';

const COMMIT = '0a17bedd1c7ce26745bd6ca99c56224b5f9d647b';
const BASE = `https://raw.githubusercontent.com/BibleCorps/FRA-B-LSG1910-PD-UBS/${COMMIT}/p.sfm/`;
const LIVRES = { Mt: '41-MAT', Mc: '42-MRK', Lc: '43-LUK', Jn: '44-JHN', Ac: '45-ACT' };

/** Analyse un livre USFM : { "chapitre:verset": texte }. */
export function analyserUsfm(usfm) {
  const versets = {};
  let chapitre = 0;
  let verset = 0;
  const nettoyer = (t) =>
    t
      .replace(/\\x .*?\\x\*/g, '') // renvois
      .replace(/\\f .*?\\f\*/g, '') // notes
      .replace(/\\\+?[a-z]+[0-9]*\*?/g, '') // balises de style (\wj, \it, \ord…)
      .replace(/\s+/g, ' ');
  for (const ligne of usfm.split(/\r?\n/)) {
    const m = ligne.match(/^\\([a-z]+[0-9]*)\s?(.*)$/);
    if (!m) continue;
    const [, balise, reste] = m;
    if (balise === 'c') {
      chapitre = Number(reste);
      verset = 0;
    } else if (balise === 'v') {
      const v = reste.match(/^(\d+)\s*(.*)$/);
      verset = Number(v[1]);
      versets[`${chapitre}:${verset}`] = nettoyer(v[2]);
    } else if (['p', 'q', 'q1', 'q2', 'm', 'pi', 'b'].includes(balise) && verset && reste.trim()) {
      // Suite d'un verset sur une nouvelle ligne (poésie, nouveau paragraphe).
      const cle = `${chapitre}:${verset}`;
      versets[cle] = `${versets[cle]} ${nettoyer(reste)}`;
    }
  }
  for (const k in versets) versets[k] = versets[k].replace(/\s+/g, ' ').replace(/\s+([,.;:!?»])/g, '$1').trim();
  return versets;
}

/** « Lc 1:30-31 » → { livre: 'Lc', chapitre: 1, de: 30, a: 31 } */
export function analyserReference(ref) {
  const m = ref.match(/^(Mt|Mc|Lc|Jn|Ac) (\d+):(\d+)(?:-(\d+))?$/);
  if (!m) throw new Error(`Référence de citation invalide : ${ref}`);
  return { livre: m[1], chapitre: Number(m[2]), de: Number(m[3]), a: Number(m[4] ?? m[3]) };
}

async function principal() {
  const bible = {};
  for (const [abr, fichier] of Object.entries(LIVRES)) {
    const url = BASE + encodeURIComponent(`FRA[B]LSG1910[PD]UBS-${fichier}.p.sfm`);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${abr} : HTTP ${r.status}`);
    bible[abr] = analyserUsfm(await r.text());
  }
  if (process.argv.includes('--tout')) await writeFile('lsg-evangiles.json', JSON.stringify(bible, null, 1));

  const textes = JSON.parse(await readFile('src/data/textes.json', 'utf8'));
  const sortie = {};
  for (const t of Object.values(textes)) {
    for (const ref of t.citations) {
      const { livre, chapitre, de, a } = analyserReference(ref);
      const morceaux = [];
      for (let v = de; v <= a; v++) {
        const texte = bible[livre][`${chapitre}:${v}`];
        if (!texte) throw new Error(`Verset introuvable : ${livre} ${chapitre}:${v}`);
        morceaux.push(texte);
      }
      sortie[ref] = morceaux.join(' ');
    }
  }
  const trie = Object.fromEntries(Object.entries(sortie).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile('src/data/citations-lsg.json', JSON.stringify(trie, null, 1) + '\n');
  console.log(`${Object.keys(trie).length} citations extraites.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await principal();
