# PrecisionFERT – demo del tool di concimazione e del repository dati

> ⚠️ **DEMO** – dati, regole e modello sono **di esempio, verosimili ma non reali**. Servono a mostrare funzioni e architettura (WP5 Att. 11), non a dare consigli di concimazione.

## 👉 Apri la demo: https://johnnym1986.github.io/Precisionfert-demo/app/

Prototipo funzionante preparato per la riunione del 19/11/2026 (ATEA Group S.r.l. SB), a partire dalla bozza v0.2 del 05/11/2026 *“Passaggi operativi e struttura”*.

## Cosa contiene

| Cartella | Contenuto |
|---|---|
| `repository/` | Il **repository dei dati di progetto**, con la stessa struttura proposta nella bozza v0.2: `catalogo/`, `schemi/`, `territorio/`, `clima/`, `modelli/`, `regole/`, `economia/`, `parametri/`. File aperti (CSV, JSON, GeoJSON). **Nessun dato degli agricoltori.** |
| `app/` | La **web-app statica** (HTML + JavaScript): tutti i calcoli girano nel browser, nessun server. |
| `app/motore.js` | Il motore di calcolo: metamodello N (rete neurale demo), dose economica, P e K per classi, conversione metodi di analisi, zonazione. |
| `tests/` | Test automatici del motore (`node tests/test_motore.js`). |
| `tools/build_artifact.py` | Crea una pagina unica con dati e librerie incorporati (`dist/`), apribile anche offline. |
| `LIMITI.md` | Potenzialità e limiti emersi, punti da decidere. |

## Flusso dell'utente (versione gratuita)

1. Disegna o carica l'appezzamento → il tool ricava areale, area climatica e stazione
2. Coltura e gestione → valori tipici precompilati, modificabili
3. Suolo → valori di zona precompilati o analisi propria (con conversione del metodo)
4. Clima → curve tipo di biomassa per annata media/secca/umida
5. Variabilità → indice di vigore (qui **simulato**) e zonazione in 3 classi
6. Prezzi → per la dose economicamente conveniente
7. Risultati → N, P₂O₅, K₂O, dose variabile di N, export GeoJSON, fascicolo “il mio appezzamento” da salvare e ricaricare

## Come provarla

- Pagina unica: aprire `dist/precisionfert-demo.html` nel browser.
- Da sorgenti: servire la cartella con un server statico (es. `python3 -m http.server`) e aprire `app/index.html`.
- Pubblicazione: GitHub Pages (gratuito con repository pubblico).

## Ruoli proposti

Impostazione concettuale e revisione architettura: Fabrizio · Sviluppo: Johnny Moretto con Claude · Dati e modelli: DAFNAE / UniPD (da sostituire ai file demo).
