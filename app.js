"use strict";

/* =====================================================================
   App meteo
   Flusso: nome città -> coordinate (geocoding) -> meteo -> pagina.
   Le API sono di Open-Meteo (gratuite, senza chiave, uso non commerciale).
   ===================================================================== */

// ---------- Costanti ----------
const URL_GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";
const URL_METEO = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 10000;          // dopo 10 secondi smettiamo di aspettare
const MAX_RECENTI = 5;             // quante ultime ricerche ricordare
const CHIAVE_RECENTI = "meteo-recenti";

// Codici meteo WMO usati da Open-Meteo: codice -> [descrizione, icona]
const CODICI_METEO = {
  0: ["Sereno", "☀️"],
  1: ["Prevalentemente sereno", "🌤️"],
  2: ["Parzialmente nuvoloso", "⛅"],
  3: ["Nuvoloso", "☁️"],
  45: ["Nebbia", "🌫️"],
  48: ["Nebbia con brina", "🌫️"],
  51: ["Pioviggine leggera", "🌦️"],
  53: ["Pioviggine", "🌦️"],
  55: ["Pioviggine intensa", "🌦️"],
  56: ["Pioviggine gelata", "🌧️"],
  57: ["Pioviggine gelata intensa", "🌧️"],
  61: ["Pioggia debole", "🌧️"],
  63: ["Pioggia", "🌧️"],
  65: ["Pioggia forte", "🌧️"],
  66: ["Pioggia gelata", "🌧️"],
  67: ["Pioggia gelata forte", "🌧️"],
  71: ["Neve debole", "🌨️"],
  73: ["Neve", "🌨️"],
  75: ["Neve forte", "❄️"],
  77: ["Granelli di neve", "❄️"],
  80: ["Rovesci deboli", "🌦️"],
  81: ["Rovesci", "🌧️"],
  82: ["Rovesci violenti", "⛈️"],
  85: ["Rovesci di neve", "🌨️"],
  86: ["Rovesci di neve forti", "❄️"],
  95: ["Temporale", "⛈️"],
  96: ["Temporale con grandine", "⛈️"],
  99: ["Temporale con forte grandine", "⛈️"],
};

function descriviCodice(codice) {
  return CODICI_METEO[codice] ?? ["Condizioni non disponibili", "❔"];
}

// ---------- Elementi della pagina ----------
const form = document.getElementById("form-ricerca");
const inputCitta = document.getElementById("citta");
const pulsante = document.getElementById("pulsante-cerca");
const contenitoreRecenti = document.getElementById("recenti");
const messaggio = document.getElementById("messaggio");
const risultato = document.getElementById("risultato");

// ---------- Errori ----------
// Gli errori "previsti" (città non trovata, rete assente...) hanno un messaggio
// scritto per l'utente. Tutti gli altri sono bug nostri: li mostriamo in console
// e all'utente diciamo solo che è successo qualcosa di imprevisto.
class ErroreApp extends Error {}

// ---------- Rete ----------
async function scaricaJson(url) {
  let risposta;
  try {
    const signal = typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(TIMEOUT_MS)
      : undefined;
    risposta = await fetch(url, { signal });
  } catch (errore) {
    if (errore.name === "TimeoutError") {
      throw new ErroreApp("Il servizio non risponde. Riprova tra poco.");
    }
    throw new ErroreApp("Impossibile contattare il servizio. Controlla la connessione.");
  }

  if (!risposta.ok) {
    throw new ErroreApp("Il servizio non è disponibile al momento. Riprova più tardi.");
  }
  return risposta.json();
}

// Dal nome della città alle coordinate
async function cercaLuogo(citta) {
  const parametri = new URLSearchParams({
    name: citta,
    count: "1",
    language: "it",
    format: "json",
  });
  const dati = await scaricaJson(`${URL_GEOCODING}?${parametri}`);

  // Se la città non esiste la risposta non contiene "results"
  if (!dati.results || dati.results.length === 0) {
    throw new ErroreApp(`Nessuna città trovata per “${citta}”.`);
  }

  const { name, admin1, country, latitude, longitude } = dati.results[0];
  return { nome: name, regione: admin1, paese: country, latitude, longitude };
}

// Dalle coordinate al meteo (attuale + prossimi giorni)
async function scaricaMeteo({ latitude, longitude }) {
  const parametri = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
  });
  const dati = await scaricaJson(`${URL_METEO}?${parametri}`);

  if (!dati.current || !dati.daily) {
    throw new ErroreApp("Dati meteo non disponibili per questa località.");
  }
  return dati;
}

// ---------- Visualizzazione ----------
// Creiamo gli elementi con createElement e textContent, MAI con innerHTML:
// i nomi delle città arrivano da un servizio esterno e, inseriti come HTML,
// potrebbero eseguire codice (attacco XSS). Con textContent restano solo testo.
function crea(tag, classe, testo) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (testo !== undefined) elemento.textContent = testo;
  return elemento;
}

const gradi = (valore) => `${Math.round(valore)}°`;

function formattaGiorno(dataIso) {
  // Le 12:00 evitano problemi di fuso orario e ora legale
  return new Date(`${dataIso}T12:00:00`).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function creaIcona(classe, icona, descrizione) {
  const elemento = crea("span", classe, icona);
  elemento.setAttribute("role", "img");
  elemento.setAttribute("aria-label", descrizione);
  return elemento;
}

function creaDettaglio(etichetta, valore) {
  const blocco = crea("div");
  blocco.append(crea("dt", "", etichetta), crea("dd", "", valore));
  return blocco;
}

function mostraMeteo(luogo, dati) {
  const { current, daily } = dati;
  const [descrizione, icona] = descriviCodice(current.weather_code);
  const titolo = [luogo.nome, luogo.regione, luogo.paese].filter(Boolean).join(", ");

  // Meteo attuale
  const attuale = crea("article", "attuale");
  const riga = crea("p", "temperatura");
  riga.append(
    creaIcona("icona", icona, descrizione),
    crea("span", "gradi", `${gradi(current.temperature_2m)}C`)
  );
  const dettagli = crea("dl", "dettagli");
  dettagli.append(
    creaDettaglio("Percepita", `${gradi(current.apparent_temperature)}C`),
    creaDettaglio("Vento", `${Math.round(current.wind_speed_10m)} km/h`)
  );
  attuale.append(
    crea("h2", "luogo", titolo),
    riga,
    crea("p", "descrizione", descrizione),
    dettagli
  );

  // Previsioni
  const previsioni = crea("section", "previsioni");
  const lista = crea("ul", "giorni");
  daily.time.forEach((giorno, i) => {
    const [descGiorno, iconaGiorno] = descriviCodice(daily.weather_code[i]);
    const voce = crea("li", "giorno");
    const minmax = crea("span", "minmax");
    minmax.append(
      crea("span", "massimo", gradi(daily.temperature_2m_max[i])),
      document.createTextNode(" "),
      crea("span", "minimo", gradi(daily.temperature_2m_min[i]))
    );
    voce.append(
      crea("span", "nome-giorno", i === 0 ? "Oggi" : formattaGiorno(giorno)),
      creaIcona("icona-piccola", iconaGiorno, descGiorno),
      minmax
    );
    lista.append(voce);
  });
  previsioni.append(crea("h2", "", "Prossimi giorni"), lista);

  risultato.replaceChildren(attuale, previsioni);
}

// ---------- Ultime ricerche (salvate nel browser) ----------
// localStorage può non essere disponibile (navigazione privata, blocchi):
// in quel caso l'app funziona lo stesso, semplicemente non ricorda nulla.
function leggiRecenti() {
  try {
    const grezzo = localStorage.getItem(CHIAVE_RECENTI);
    const lista = grezzo ? JSON.parse(grezzo) : [];
    if (!Array.isArray(lista)) return [];
    return lista.filter((voce) => typeof voce === "string").slice(0, MAX_RECENTI);
  } catch {
    return [];
  }
}

function salvaRecente(nome) {
  const altri = leggiRecenti().filter((voce) => voce.toLowerCase() !== nome.toLowerCase());
  const nuova = [nome, ...altri].slice(0, MAX_RECENTI);
  try {
    localStorage.setItem(CHIAVE_RECENTI, JSON.stringify(nuova));
  } catch {
    // Non si può salvare: pazienza, l'app continua a funzionare
  }
}

function mostraRecenti() {
  const recenti = leggiRecenti();
  contenitoreRecenti.replaceChildren();
  contenitoreRecenti.hidden = recenti.length === 0;
  if (recenti.length === 0) return;

  contenitoreRecenti.append(crea("span", "recenti-titolo", "Ultime ricerche:"));
  for (const nome of recenti) {
    const bottone = crea("button", "recente", nome);
    bottone.type = "button";
    bottone.addEventListener("click", () => {
      inputCitta.value = nome;
      cerca(nome);
    });
    contenitoreRecenti.append(bottone);
  }
}

// ---------- Ricerca ----------
function mostraErrore(testo) {
  risultato.replaceChildren();
  messaggio.classList.add("errore");
  messaggio.textContent = testo;
}

let numeroRichiesta = 0; // serve a ignorare le risposte "vecchie"

async function cerca(citta) {
  // Se l'utente lancia una seconda ricerca mentre la prima è in corso,
  // la risposta della prima non deve sovrascrivere la seconda.
  const idRichiesta = ++numeroRichiesta;

  messaggio.classList.remove("errore");
  messaggio.textContent = "Caricamento…";
  pulsante.disabled = true;

  try {
    const luogo = await cercaLuogo(citta);
    const dati = await scaricaMeteo(luogo);
    if (idRichiesta !== numeroRichiesta) return;

    mostraMeteo(luogo, dati);
    messaggio.textContent = "";
    salvaRecente(luogo.nome);
    mostraRecenti();
  } catch (errore) {
    if (idRichiesta !== numeroRichiesta) return;

    if (errore instanceof ErroreApp) {
      mostraErrore(errore.message);
    } else {
      console.error(errore);
      mostraErrore("Si è verificato un errore imprevisto. Riprova.");
    }
  } finally {
    if (idRichiesta === numeroRichiesta) pulsante.disabled = false;
  }
}

form.addEventListener("submit", (evento) => {
  evento.preventDefault(); // evita che la pagina si ricarichi
  const citta = inputCitta.value.trim();

  // "required" accetta anche solo spazi: dopo trim() il testo può essere vuoto
  if (!citta) {
    mostraErrore("Scrivi il nome di una città.");
    inputCitta.focus();
    return;
  }
  cerca(citta);
});

// All'avvio mostriamo le ultime ricerche, se ci sono
mostraRecenti();