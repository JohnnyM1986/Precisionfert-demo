/* PrecisionFERT DEMO – interfaccia. Dati di ESEMPIO, non reali. */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const FILES = ['catalogo/datasets.json', 'territorio/areali_pedoclimatici.geojson', 'clima/stazioni.csv',
    'clima/curve_biomassa_tipo.csv', 'modelli/metamodello_N_demo.json', 'regole/regole_pk.json',
    'regole/asportazioni_unitarie.csv', 'regole/conversioni_metodi_analisi.json', 'economia/prezzi.csv',
    'parametri/valori_tipici.csv', 'schemi/fascicolo.schema.json'];

  // ---------- 1. caricamento del repository ----------
  const raw = {};
  if (window.REPO_INLINE) Object.assign(raw, window.REPO_INLINE);
  else for (const f of FILES) raw[f] = await (await fetch('../repository/' + f)).text();
  const J = f => JSON.parse(raw[f]), C = f => PF.parseCSV(raw[f]);
  const D = {
    catalogo: J('catalogo/datasets.json'), areali: J('territorio/areali_pedoclimatici.geojson'),
    stazioni: C('clima/stazioni.csv'), curve: C('clima/curve_biomassa_tipo.csv'),
    meta: J('modelli/metamodello_N_demo.json'), regole: J('regole/regole_pk.json'),
    asp: C('regole/asportazioni_unitarie.csv'), conv: J('regole/conversioni_metodi_analisi.json'),
    prezzi: C('economia/prezzi.csv'), tipici: C('parametri/valori_tipici.csv')
  };

  const S = { poligono: null, areale: null, coltura: 'mais', annata: 'medio', celle: [] };

  // ---------- navigazione ----------
  const passi = [...document.querySelectorAll('section.passo')];
  const nav = $('#nav');
  passi.forEach((p, i) => {
    const b = document.createElement('button'); b.textContent = p.dataset.titolo; b.dataset.i = i;
    b.onclick = () => vai(i); nav.appendChild(b);
  });
  function vai(i) {
    passi.forEach((p, j) => p.hidden = j !== i);
    [...nav.children].forEach((b, j) => b.classList.toggle('on', j === i));
    if (passi[i].id === 'p-mappa' || passi[i].id === 'p-var') setTimeout(() => { mappa.invalidateSize(); mappaVar.invalidateSize(); }, 50);
    if (passi[i].id === 'p-clima') disegnaClima();
    if (passi[i].id === 'p-var') disegnaVariabilita();
    if (passi[i].id === 'p-ris') calcola();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-vai]').forEach(b => b.onclick = () => vai(+b.dataset.vai));

  // ---------- mappa ----------
  function nuovaMappa(id) {
    const m = L.map(id, { zoomControl: true }).setView([45.5, 11.9], 8);
    // Nella pagina Claude le tile esterne sono bloccate; su GitHub Pages si caricano.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    L.geoJSON(D.areali, {
      style: f => ({ color: '#555', weight: 1, fillColor: f.properties.colore, fillOpacity: 0.35 }),
      onEachFeature: (f, l) => l.bindTooltip(f.properties.id + ' – ' + f.properties.nome)
    }).addTo(m);
    return m;
  }
  const mappa = nuovaMappa('mappa'), mappaVar = nuovaMappa('mappaVar');
  let vertici = [], segno = null, livelloPol = null, livelloPolVar = null;

  mappa.on('click', e => {
    if (S.poligono) return;
    vertici.push([e.latlng.lat, e.latlng.lng]);
    if (segno) mappa.removeLayer(segno);
    segno = L.polyline(vertici, { color: '#2E6B3A', dashArray: '4' }).addTo(mappa);
    $('#statoDisegno').textContent = vertici.length + ' vertici – tocca "Chiudi" quando hai finito';
  });
  $('#btnChiudi').onclick = () => { if (vertici.length >= 3) impostaPoligono(vertici.map(v => [v[1], v[0]])); };
  $('#btnCancella').onclick = () => { vertici = []; S.poligono = null; S.celle = [];
    [segno, livelloPol].forEach(l => l && mappa.removeLayer(l)); $('#contesto').innerHTML = ''; $('#statoDisegno').textContent = 'Tocca la mappa per disegnare i vertici'; };
  $('#btnEsempio').onclick = () => impostaPoligono([[11.9150, 45.6760], [11.9188, 45.6763], [11.9192, 45.6744], [11.9153, 45.6741]]);
  $('#fileGeo').onchange = async e => {
    try { const g = JSON.parse(await e.target.files[0].text());
      const f = g.type === 'FeatureCollection' ? g.features[0] : g.type === 'Feature' ? g : { geometry: g };
      impostaPoligono(f.geometry.coordinates[0].slice(0, -1)); } catch (err) { avviso('File non valido: serve un GeoJSON con un poligono'); }
  };

  function impostaPoligono(coord) {
    const anello = [...coord, coord[0]];
    S.poligono = turf.polygon([anello]);
    [segno, livelloPol].forEach(l => l && mappa.removeLayer(l)); vertici = [];
    livelloPol = L.geoJSON(S.poligono, { style: { color: '#1b4d26', weight: 3, fillOpacity: 0.15 } }).addTo(mappa);
    setTimeout(() => { mappa.invalidateSize(); mappa.fitBounds(livelloPol.getBounds(), { maxZoom: 16 }); }, 60);
    const c = turf.centroid(S.poligono);
    S.areale = D.areali.features.find(f => turf.booleanPointInPolygon(c, f)) || null;
    S.ha = turf.area(S.poligono) / 10000;
    S.celle = [];
    const p = S.areale && S.areale.properties;
    $('#contesto').innerHTML = p
      ? `<div class="ok">Superficie <b>${S.ha.toFixed(2)} ha</b> · Areale <b>${p.id} ${p.nome}</b> · Area climatica <b>${p.area_climatica}</b> · Stazione ${p.stazione}</div>`
      : `<div class="warn">Superficie ${S.ha.toFixed(2)} ha – l'appezzamento è fuori dagli areali di esempio (pianura veneta)</div>`;
    $('#statoDisegno').textContent = 'Appezzamento impostato';
    precompila();
  }

  // ---------- coltura, suolo, prezzi: precompilazione ----------
  const prezzo = v => D.prezzi.find(r => r.voce === v).prezzo_eur;
  function precompila() {
    const a = S.areale ? S.areale.properties.id : 'A2';
    const t = D.tipici.find(r => r.coltura === S.coltura && r.areale === a);
    $('#semina').value = t.semina; $('#densita').value = t.densita_piante_m2; $('#resa').value = t.resa_attesa_t_ha;
    $('#irriguo').checked = !!t.irriguo_tipico;
    $('#unitaDens').textContent = S.coltura === 'frumento' ? 'semi/m²' : 'piante/m²';
    const s = (S.areale || D.areali.features[1]).properties.suolo;
    $('#tessitura').value = s.tessitura; $('#so').value = s.so_pct; $('#pPpm').value = s.p_olsen_ppm; $('#kPpm').value = s.k_scamb_ppm;
    $('#metodoP').value = 'Olsen'; $('#metodoK').value = 'ammonio acetato';
    $('#fonteSuolo').textContent = 'Valori precompilati dalla zona ' + a + ' (dati DEMO al posto di ARPAV). Correggi con le tue analisi.';
    $('#prezzoProd').value = prezzo(S.coltura); $('#prezzoN').value = prezzo('N'); $('#prezzoP').value = prezzo('P2O5'); $('#prezzoK').value = prezzo('K2O');
    $('#etProd').textContent = S.coltura + (S.coltura === 'silomais' ? ' (€/t s.s.)' : ' (€/t)');
    document.querySelectorAll('.precomp').forEach(el => el.classList.add('flash'));
    setTimeout(() => document.querySelectorAll('.precomp').forEach(el => el.classList.remove('flash')), 900);
  }
  $('#coltura').onchange = e => { S.coltura = e.target.value; precompila(); };
  $('#annata').onchange = e => { S.annata = e.target.value; disegnaClima(); };

  // ---------- clima ----------
  let grafico = null;
  function disegnaClima() {
    const st = S.areale ? S.areale.properties.stazione : 'ST08';
    const serie = ['medio', 'secco', 'umido'].map(an => D.curve.filter(r => r.stazione === st && r.coltura === S.coltura && r.annata === an));
    const colori = { medio: '#2E6B3A', secco: '#c0392b', umido: '#2471a3' };
    const ds = ['medio', 'secco', 'umido'].map((an, i) => ({ label: 'annata ' + an, data: serie[i].map(r => r.biomassa_t_ss_ha),
      borderColor: colori[an], borderWidth: an === S.annata ? 4 : 1.5, pointRadius: 0, tension: .3 }));
    const stz = D.stazioni.find(s => s.id === st);
    $('#infoClima').innerHTML = `Stazione <b>${stz.nome}</b> · pioggia media ${stz.pioggia_media_mm} mm · GDD medi apr–set ${stz.gdd_medi_apr_set}`;
    if (grafico) grafico.destroy();
    grafico = new Chart($('#grafClima'), { type: 'line', data: { labels: serie[0].map(r => r.giorni_da_semina), datasets: ds },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom' } },
        scales: { x: { title: { display: true, text: 'giorni dalla semina' } }, y: { title: { display: true, text: 't s.s./ha' } } } } });
  }

  // ---------- variabilità (simulata) ----------
  let livelloCelle = null;
  function calcolaCelle() {
    if (!S.poligono || S.celle.length) return;
    const bb = turf.bbox(S.poligono);
    const lato = Math.max(15, Math.sqrt(S.ha * 10000 / 1500)); // max ~1500 celle
    const griglia = turf.squareGrid(bb, lato / 1000, { units: 'kilometers', mask: S.poligono });
    const seme = (bb[0] * 1000) % 7;
    griglia.features.forEach(f => { const c = turf.centroid(f).geometry.coordinates; f.properties.v = PF.vigoreSimulato(c[0], c[1], seme); });
    const z = PF.zonazione(griglia.features.map(f => f.properties.v));
    griglia.features.forEach(f => f.properties.zona = z.zona(f.properties.v));
    S.celle = griglia.features; S.lato = lato;
  }
  const COL_ZONA = ['#d9a441', '#8fbf5a', '#2e7d32'];
  function disegnaVariabilita() {
    if (!S.poligono) { $('#infoVar').innerHTML = '<div class="warn">Prima imposta un appezzamento (passo 1)</div>'; return; }
    calcolaCelle();
    [livelloCelle, livelloPolVar].forEach(l => l && mappaVar.removeLayer(l));
    livelloCelle = L.geoJSON({ type: 'FeatureCollection', features: S.celle },
      { style: f => ({ stroke: false, fillColor: COL_ZONA[f.properties.zona], fillOpacity: 0.85 }) }).addTo(mappaVar);
    livelloPolVar = L.geoJSON(S.poligono, { style: { color: '#111', weight: 2, fill: false } }).addTo(mappaVar);
    setTimeout(() => { mappaVar.invalidateSize(); mappaVar.fitBounds(livelloPolVar.getBounds()); }, 120);
    const n = [0, 0, 0]; S.celle.forEach(c => n[c.properties.zona]++);
    $('#infoVar').innerHTML = `${S.celle.length} celle da ${S.lato.toFixed(0)} m · vigore basso ${pc(n[0])} · medio ${pc(n[1])} · alto ${pc(n[2])}
      <br><small>Indice SIMULATO nel browser. In reale: indice da Sentinel-2 via Google Earth Engine, metodo scelto da DAFNAE (scheda D1–D7).</small>`;
    function pc(x) { return Math.round(100 * x / S.celle.length) + '%'; }
  }

  // ---------- risultati ----------
  let grafRisp = null;
  function input() {
    return { resa: +$('#resa').value, so: +$('#so').value, irriguo: $('#irriguo').checked, gddNorm: 1,
      annata: S.annata, nGia: +$('#nGia').value || 0, pPpm: +$('#pPpm').value, kPpm: +$('#kPpm').value,
      metodoP: $('#metodoP').value, metodoK: $('#metodoK').value };
  }
  function calcola() {
    if (!S.poligono) { $('#risultati').innerHTML = '<div class="warn">Prima imposta un appezzamento (passo 1)</div>'; return; }
    const t0 = performance.now();
    const inp = input();
    const maxN = S.coltura === 'frumento' ? 220 : 300;
    const n = PF.doseN(D.meta, inp, +$('#prezzoProd').value, +$('#prezzoN').value, maxN);
    const pk = PF.doseP_K(D.regole, D.conv, D.asp.find(r => r.coltura === S.coltura), inp);
    calcolaCelle();
    const zone = [0, 1, 2].map(z => {
      const celle = S.celle.filter(c => c.properties.zona === z);
      const ha = S.ha * celle.length / S.celle.length; // superficie reale ripartita per zona
      return { z, ha, dose: n.daDistribuire * PF.FATTORI_ZONA[z] };
    });
    const totN = zone.reduce((s, z) => s + z.ha * z.dose, 0);
    const costo = n.daDistribuire * +$('#prezzoN').value + pk.P2O5 * +$('#prezzoP').value + pk.K2O * +$('#prezzoK').value;
    const ms = (performance.now() - t0).toFixed(1);
    S.risultati = { N_tot_kg_ha: +n.Ntot.toFixed(0), N_da_distribuire_kg_ha: +n.daDistribuire.toFixed(0), P2O5_kg_ha: +pk.P2O5.toFixed(0),
      K2O_kg_ha: +pk.K2O.toFixed(0), resa_stimata: +n.resa.toFixed(1), classeP: pk.classeP, classeK: pk.classeK,
      zone: zone.map(z => ({ zona: ['vigore basso', 'vigore medio', 'vigore alto'][z.z], ha: +z.ha.toFixed(2), N_kg_ha: +z.dose.toFixed(0) })) };
    $('#risultati').innerHTML = `
      <div class="cards">
        <div class="card"><div class="k">Azoto (N)</div><div class="v">${S.risultati.N_da_distribuire_kg_ha}</div><div class="u">kg/ha da distribuire</div><small>fabbisogno economico ${S.risultati.N_tot_kg_ha} − già dato ${inp.nGia}</small></div>
        <div class="card"><div class="k">Fosforo (P₂O₅)</div><div class="v">${S.risultati.P2O5_kg_ha}</div><div class="u">kg/ha</div><small>dotazione ${pk.classeP} (${pk.pOlsen.toFixed(0)} ppm Olsen)</small></div>
        <div class="card"><div class="k">Potassio (K₂O)</div><div class="v">${S.risultati.K2O_kg_ha}</div><div class="u">kg/ha</div><small>dotazione ${pk.classeK} (${pk.kRif.toFixed(0)} ppm)</small></div>
        <div class="card"><div class="k">Resa stimata</div><div class="v">${S.risultati.resa_stimata}</div><div class="u">t/ha</div><small>costo concimi ≈ ${costo.toFixed(0)} €/ha</small></div>
      </div>
      <h3>Dose variabile di azoto per zona</h3>
      <table><tr><th>Zona</th><th>ha</th><th>N kg/ha</th></tr>${S.risultati.zone.map((z, i) => `<tr><td><span class="sw" style="background:${COL_ZONA[i]}"></span>${z.zona}</td><td>${z.ha}</td><td>${z.N_kg_ha}</td></tr>`).join('')}
      <tr><td><b>Totale appezzamento</b></td><td>${S.ha.toFixed(2)}</td><td><b>${(totN).toFixed(0)} kg N</b></td></tr></table>
      <small>Regola di modulazione DEMO (+10% / 0 / −10%): da definire con DAFNAE. Calcolo eseguito nel browser in ${ms} ms, senza server.</small>`;
    // curva di risposta
    const xs = Array.from({ length: 31 }, (_, i) => i * maxN / 30);
    if (grafRisp) grafRisp.destroy();
    grafRisp = new Chart($('#grafRisp'), { type: 'line', data: { labels: xs.map(x => x.toFixed(0)), datasets: [
      { label: 'resa (t/ha)', data: xs.map(x => n.curva.Y(x)), borderColor: '#2E6B3A', pointRadius: 0, yAxisID: 'y' },
      { label: 'margine (€/ha) = ricavo − costo N', data: xs.map(x => n.curva.Y(x) * $('#prezzoProd').value - x * $('#prezzoN').value), borderColor: '#b26a00', pointRadius: 0, yAxisID: 'y2' }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom' } },
        scales: { x: { title: { display: true, text: 'N totale kg/ha' } }, y: { position: 'left' }, y2: { position: 'right', grid: { drawOnChartArea: false } } } } });
  }

  // ---------- export e fascicolo ----------
  function scarica(nome, testo, tipo) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([testo], { type: tipo })); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    $('#esito').innerHTML = `Se il download non parte (nella pagina Claude è bloccato), usa <b>Copia</b>. Su GitHub Pages funziona.`;
  }
  async function copia(testo) {
    try { await navigator.clipboard.writeText(testo); $('#esito').textContent = 'Copiato negli appunti ✔'; }
    catch (e) { $('#area').value = testo; $('#area').hidden = false; $('#esito').textContent = 'Copia non permessa: testo mostrato qui sotto.'; }
  }
  function prescrizione() {
    calcola();
    return JSON.stringify({ type: 'FeatureCollection', name: 'prescrizione_N_DEMO', crs_nota: 'WGS84 (EPSG:4326)',
      features: S.celle.map(c => ({ type: 'Feature', geometry: c.geometry, properties: { zona: c.properties.zona, N_kg_ha: S.risultati.zone[c.properties.zona].N_kg_ha } })) });
  }
  function fascicolo() {
    calcola();
    return JSON.stringify({ versione_schema: '0.1-demo', salvato_il: new Date().toISOString(), appezzamento: S.poligono,
      coltura: { coltura: S.coltura, semina: $('#semina').value, densita: +$('#densita').value, resa_attesa: +$('#resa').value, irriguo: $('#irriguo').checked, n_gia: +$('#nGia').value || 0, annata: S.annata },
      suolo: { tessitura: $('#tessitura').value, so_pct: +$('#so').value, p_ppm: +$('#pPpm').value, metodo_p: $('#metodoP').value, k_ppm: +$('#kPpm').value, metodo_k: $('#metodoK').value },
      prezzi: { prodotto: +$('#prezzoProd').value, N: +$('#prezzoN').value, P2O5: +$('#prezzoP').value, K2O: +$('#prezzoK').value },
      risultati: S.risultati }, null, 2);
  }
  $('#btnPresScarica').onclick = () => S.poligono ? scarica('prescrizione_N_demo.geojson', prescrizione(), 'application/geo+json') : avviso('Prima imposta un appezzamento');
  $('#btnPresCopia').onclick = () => S.poligono ? copia(prescrizione()) : avviso('Prima imposta un appezzamento');
  $('#btnFasScarica').onclick = () => S.poligono ? scarica('il_mio_appezzamento.json', fascicolo(), 'application/json') : avviso('Prima imposta un appezzamento');
  $('#btnFasCopia').onclick = () => S.poligono ? copia(fascicolo()) : avviso('Prima imposta un appezzamento');
  $('#fileFas').onchange = async e => {
    try {
      const f = JSON.parse(await e.target.files[0].text());
      S.coltura = f.coltura.coltura; $('#coltura').value = S.coltura;
      impostaPoligono(f.appezzamento.geometry.coordinates[0].slice(0, -1));
      $('#semina').value = f.coltura.semina; $('#densita').value = f.coltura.densita; $('#resa').value = f.coltura.resa_attesa;
      $('#irriguo').checked = f.coltura.irriguo; $('#nGia').value = f.coltura.n_gia; S.annata = f.coltura.annata; $('#annata').value = S.annata;
      Object.entries({ tessitura: 'tessitura', so: 'so_pct', pPpm: 'p_ppm', metodoP: 'metodo_p', kPpm: 'k_ppm', metodoK: 'metodo_k' }).forEach(([id, k]) => $('#' + id).value = f.suolo[k]);
      $('#prezzoProd').value = f.prezzi.prodotto; $('#prezzoN').value = f.prezzi.N; $('#prezzoP').value = f.prezzi.P2O5; $('#prezzoK').value = f.prezzi.K2O;
      $('#esito').textContent = 'Fascicolo ricaricato ✔ (salvato il ' + f.salvato_il.slice(0, 10) + ')';
    } catch (err) { avviso('Fascicolo non valido'); }
  };

  // ---------- esploratore del repository ----------
  $('#repoLista').innerHTML = D.catalogo.datasets.map(d => `<tr><td><code>${d.file}</code></td><td>${d.fonte}</td><td><span class="st">${d.stato}</span></td></tr>`).join('');
  $('#repoFile').innerHTML = FILES.map(f => `<option>${f}</option>`).join('');
  const mostraFile = () => { const t = raw[$('#repoFile').value]; $('#repoTesto').textContent = t.length > 4000 ? t.slice(0, 4000) + '\n… (troncato)' : t; };
  $('#repoFile').onchange = mostraFile; mostraFile();

  function avviso(t) { $('#esito').textContent = t; $('#toast').textContent = t; $('#toast').hidden = false; setTimeout(() => $('#toast').hidden = true, 2500); }

  vai(0);
  $('#caricamento').hidden = true;
})();
