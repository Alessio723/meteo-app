# App meteo

Cerca una città e vedi il meteo attuale e le previsioni dei prossimi giorni.

**Demo:** https://alessio723.github.io/meteo-app/

## Cosa fa

- Cerca una città per nome e mostra temperatura, temperatura percepita, vento e condizioni.
- Mostra le previsioni dei prossimi giorni (minima e massima).
- Ricorda le ultime ricerche nel browser, per ripeterle con un clic.
- Gestisce gli errori con messaggi chiari: città non trovata, servizio non disponibile, connessione assente, risposta troppo lenta.
- Tema chiaro e scuro automatico, in base alle impostazioni del dispositivo.
- Si usa da telefono e da computer, anche con la tastiera.

## Tecnologie

- **HTML, CSS e JavaScript** puri, senza librerie né strumenti di build.
- **API di Open-Meteo** (geocoding e previsioni), senza chiave.

## Come funziona

1. Il nome della città viene convertito in coordinate dall'API di geocoding.
2. Con le coordinate si scaricano meteo attuale e previsioni.
3. I dati vengono mostrati nella pagina.

## Struttura

```
index.html   struttura della pagina
style.css    stile, tema chiaro e scuro
app.js       ricerca, chiamate all'API e visualizzazione
```

## Crediti

Dati meteo di [Open-Meteo.com](https://open-meteo.com/), licenza CC BY 4.0. L'API gratuita è riservata a un uso non commerciale.