// Test automatici del motore di calcolo: node tests/test_motore.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const PF = require('../app/motore.js');
const R = p => fs.readFileSync(path.join(__dirname, '..', 'repository', p), 'utf8');

const m = JSON.parse(R('modelli/metamodello_N_demo.json'));
const regole = JSON.parse(R('regole/regole_pk.json'));
const conv = JSON.parse(R('regole/conversioni_metodi_analisi.json'));
const asp = PF.parseCSV(R('regole/asportazioni_unitarie.csv'));
const prezzi = PF.parseCSV(R('economia/prezzi.csv'));
const p = v => prezzi.find(r => r.voce === v).prezzo_eur;

let ok = 0;
function prova(nome, f) { f(); ok++; console.log('OK  ' + nome); }

prova('dose N mais in un intervallo plausibile (100-300 kg/ha)', () => {
  const d = PF.doseN(m, { resa: 13, so: 1.6, irriguo: true, gddNorm: 1, annata: 'medio' }, p('mais'), p('N'), 300);
  assert(d.Ntot > 100 && d.Ntot < 300, d.Ntot);
});
prova('se il concime costa di più la dose scende', () => {
  const inp = { resa: 13, so: 1.6, irriguo: true, gddNorm: 1, annata: 'medio' };
  assert(PF.doseN(m, inp, 215, 2.5, 300).Ntot < PF.doseN(m, inp, 215, 1.25, 300).Ntot);
});
prova('N già distribuito si sottrae', () => {
  const inp = { resa: 13, so: 1.6, irriguo: true, gddNorm: 1, annata: 'medio', nGia: 50 };
  const d = PF.doseN(m, inp, 215, 1.25, 300);
  assert(Math.abs(d.Ntot - d.daDistribuire - 50) < 1e-9);
});
prova('P in classe alta -> dose ridotta', () => {
  const a = asp.find(r => r.coltura === 'mais');
  const bassa = PF.doseP_K(regole, conv, a, { resa: 12, pPpm: 8, kPpm: 150, metodoP: 'Olsen', metodoK: 'ammonio acetato' });
  const alta = PF.doseP_K(regole, conv, a, { resa: 12, pPpm: 40, kPpm: 150, metodoP: 'Olsen', metodoK: 'ammonio acetato' });
  assert(alta.P2O5 < bassa.P2O5 && bassa.classeP === 'bassa' && alta.classeP === 'alta');
});
prova('conversione Bray -> Olsen applicata', () => {
  const a = asp.find(r => r.coltura === 'mais');
  const r = PF.doseP_K(regole, conv, a, { resa: 12, pPpm: 40, kPpm: 150, metodoP: 'Bray', metodoK: 'ammonio acetato' });
  assert(Math.abs(r.pOlsen - 22) < 1e-9);
});
prova('zonazione in 3 classi', () => {
  const v = Array.from({ length: 99 }, (_, i) => i / 98);
  const z = PF.zonazione(v);
  const conta = [0, 0, 0]; v.forEach(x => conta[z.zona(x)]++);
  assert(conta.every(c => c >= 30));
});
console.log(`\n${ok} test superati`);
