# Giulia Shop

Pannello e demo di Giulia, l'assistente virtuale per i negozi online.

- `/` – pannello del negozio (richieste, conversazioni, clienti, impostazioni). Si entra con un link d'invito.
- `/demo/` – negozio di prova StridePulse con Giulia installata.
- `/prova/?a=<agente>&n=<negozio>&g=<assistente>` – pagina per provare l'assistente di un negozio (il link è nella scheda del negozio).
- `/widget/giulia.js` – chat e voce da installare sul sito del negozio:

```html
<script src="https://gsfglobal.github.io/giulia-shop/widget/giulia.js"
  data-agente="agent_…" data-negozio="Nome del negozio" defer></script>
```

Opzioni: `data-nome` (nome dell'assistente), `data-colore`, `data-idee` (domande di esempio separate da `|`), `data-voce="no"`, `data-posizione="sinistra"`, `data-aperto="si"`.

Nuovi negozi: dal pannello (pulsante +) si inserisce nome, sito e piattaforma; l'assistente del negozio viene creato in automatico.
Piattaforme collegabili: Shopify, WooCommerce (chiavi REST in lettura), PrestaShop (chiave Webservice in lettura).

I dati restano sul server: la pagina parla solo con la funzione `giulia-shop`.
