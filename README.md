# Rytm

Wyszukiwarka potencjału koncertowego dla pary artysta + miasto.

## Produkcja

https://rytm-booking.vercel.app

## Źródła danych

- MusicBrainz: identyfikacja artysty, metadane gatunkowe i udokumentowana historia wydarzeń.
- Open-Meteo Geocoding: miasto, region, kraj i populacja.
- Ticketmaster Discovery: wydarzenia muzyczne, gdy ustawiono `TICKETMASTER_API_KEY`.

Frekwencja pozostaje estymacją kierunkową do czasu podłączenia historycznej
sprzedaży i kosztów promotera.

## Uruchomienie lokalne

Otwórz `index.html` albo uruchom prosty serwer:

```powershell
python -m http.server 4173
```

## Backend

Endpoint `api/analyze.js` jest zgodny z funkcjami Vercel. Lokalnie i na GitHub
Pages frontend korzysta bezpośrednio z otwartych API i pokazuje częściowe
pokrycie danych.
