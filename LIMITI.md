# Potenzialità e limiti emersi dalla demo (18/11/2026)

## Funziona già
- Web-app statica da smartphone, calcoli nel browser, nessun costo di server.
- Precompilazione automatica dalle coordinate dell'appezzamento (areale → suolo, clima, valori tipici, prezzi).
- Metamodello N eseguito nel browser (demo: rete con pesi finti; reale: ONNX Runtime Web con il modello DAFNAE).
- Dose economica ottimale (curva di risposta e prezzi), P e K per classi di dotazione, conversione Bray→Olsen.
- Zonazione in 3 classi, dose variabile di N, export GeoJSON (WGS84).
- Fascicolo “il mio appezzamento” salvato e ricaricato dall'agricoltore: i dati restano sul suo dispositivo.
- Repository versionato con catalogo dei dataset, schema del fascicolo e test automatici.

## Limiti / da decidere
1. **Google Earth Engine** non è chiamabile direttamente da una pagina statica: serve autenticazione → piccolo servizio intermedio oppure indici pre-calcolati periodicamente e salvati nel repository. Licenza GEE per uso commerciale (E1/E2).
2. **Hosting**: GitHub Pages gratuito solo con repository pubblico (coerente con i dati aperti PEI-AGRI).
3. **Dimensioni**: file ≤ 100 MB, repository consigliato < 1–5 GB, sito Pages ≤ 1 GB. Tabelle: pochi MB. Matrice DSSAT (C1) da dimensionare → eventualmente Release/Zenodo.
4. **Export per il trattore**: shapefile/ISOBUS richiedono librerie aggiuntive e prove con i monitor reali.
5. **Input geometrie**: SHP/KML e particelle catastali/AVEPA da aggiungere (librerie + accesso ai servizi regionali).
6. **Versione commerciale** (chatbot referti, cartella Drive, account): servizio esterno a consumo; moduli già separati.
7. **Licenze**: proprietà intellettuale del metamodello DAFNAE e licenza dei dati del repository (es. CC-BY 4.0).
8. **Regole agronomiche**: modulazione per zona, soglie P-K, asportazioni → da DAFNAE/UniPD.
