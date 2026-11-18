/* PrecisionFERT DEMO – motore di calcolo (gira nel browser e in Node per i test).
   TUTTE le regole e i coefficienti sono di ESEMPIO: vanno sostituiti con quelli dei partner. */
(function (root) {
  'use strict';

  function parseCSV(txt) {
    const righe = txt.trim().split(/\r?\n/);
    const testa = righe.shift().split(',');
    return righe.map(r => {
      const v = r.split(',');
      const o = {};
      testa.forEach((h, i) => { const x = v[i]; o[h] = (x !== '' && !isNaN(+x)) ? +x : x; });
      return o;
    });
  }

  // Rete neurale minima (1 strato nascosto tanh) – sostituisce il metamodello ONNX DAFNAE
  function metamodello(m, x) {
    const z = x.map((v, i) => (v - m.normalizzazione.media[i]) / m.normalizzazione.dev[i]);
    const h = m.W1.map((riga, j) => Math.tanh(riga.reduce((s, w, i) => s + w * z[i], 0) + m.b1[j]));
    return m.W2[0].reduce((s, w, j) => s + w * h[j], 0) + m.b2[0];
  }

  // Curva di risposta Y(N) = Ymax*(1 - 0.45*exp(-c*N))
  function curvaRisposta(m, inp) {
    const y = metamodello(m, [inp.resa, inp.so, inp.irriguo ? 1 : 0, inp.gddNorm,
      inp.annata === 'secco' ? 1 : 0, inp.annata === 'umido' ? 1 : 0]);
    const Ymax = inp.resa * (1 + 0.08 * y);
    const c = 0.012 * (1 + 0.1 * y);
    return { Ymax, c, Y: N => Ymax * (1 - 0.45 * Math.exp(-c * N)) };
  }

  // Dose economica ottimale: dY/dN * prezzo prodotto = prezzo N
  function doseN(m, inp, prezzoProdotto, prezzoN, maxN) {
    const cr = curvaRisposta(m, inp);
    let Nopt = Math.log(cr.Ymax * 0.45 * cr.c * prezzoProdotto / prezzoN) / cr.c;
    Nopt = Math.max(0, Math.min(maxN, Nopt));
    const daDistribuire = Math.max(0, Nopt - (inp.nGia || 0));
    return { Ntot: Nopt, daDistribuire, resa: cr.Y(Nopt), curva: cr };
  }

  function classe(regola, valore) {
    return regola.classi_ppm.find(c => valore <= c.max);
  }

  function doseP_K(regole, conv, asp, inp) {
    const pOlsen = inp.pPpm * (conv.P[inp.metodoP + '->Olsen'] ?? 1);
    const kRif = inp.kPpm * (conv.K[inp.metodoK + '->ammonio acetato'] ?? 1);
    const cP = classe(regole.P, pOlsen), cK = classe(regole.K, kRif);
    return {
      pOlsen, kRif, classeP: cP.classe, classeK: cK.classe,
      P2O5: asp.p2o5_kg_t * inp.resa * cP.fattore,
      K2O: asp.k2o_kg_t * inp.resa * cK.fattore
    };
  }

  // Campo di vigore SIMULATO (al posto di Sentinel-2 via GEE): valore 0..1 riproducibile
  function vigoreSimulato(lon, lat, seme) {
    const a = Math.sin((lon * 900 + seme) ) * Math.cos(lat * 1100 - seme * 0.7);
    const b = Math.sin(lon * 2300 + lat * 1700 + seme * 1.3) * 0.35;
    const r = Math.sin(lon * 91733 + lat * 47911) * 0.08;
    return Math.max(0, Math.min(1, 0.55 + 0.3 * a + 0.15 * b + r));
  }

  // Zonazione in 3 classi per terzili
  function zonazione(valori) {
    const s = [...valori].sort((x, y) => x - y);
    const t1 = s[Math.floor(s.length / 3)], t2 = s[Math.floor(2 * s.length / 3)];
    return { t1, t2, zona: v => (v < t1 ? 0 : v < t2 ? 1 : 2) };
  }

  const FATTORI_ZONA = [1.10, 1.00, 0.90]; // regola DEMO: vigore basso / medio / alto

  const api = { parseCSV, metamodello, curvaRisposta, doseN, doseP_K, vigoreSimulato, zonazione, FATTORI_ZONA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PF = api;
})(typeof window !== 'undefined' ? window : globalThis);
