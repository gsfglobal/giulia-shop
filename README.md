# Giulia Shop

Pannello e demo di Giulia, l'assistente virtuale per i negozi online.

- `/` – pannello del negozio (richieste, conversazioni, clienti, impostazioni). Si entra con un link d'invito.
- `/demo/` – negozio di prova StridePulse con Giulia installata.
- `/widget/giulia.js` – chat e voce da installare sul sito del negozio:

```html
<script src="https://gsfglobal.github.io/giulia-shop/widget/giulia.js"
  data-agente="agent_…" data-negozio="Nome del negozio" defer></script>
```

I dati restano sul server: la pagina parla solo con la funzione `giulia-shop`.
