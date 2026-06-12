# Rytm

Wyszukiwarka potencjału koncertowego dla pary artysta + miasto.

## Produkcja

https://rytm-booking.vercel.app

## Źródła danych

- MusicBrainz: identyfikacja artysty, metadane gatunkowe i udokumentowana historia wydarzeń.
- Open-Meteo Geocoding: miasto, region, kraj i populacja.
- Ticketmaster Discovery: wydarzenia muzyczne, gdy ustawiono `TICKETMASTER_API_KEY`.
- Spotify Web API: surowe dane katalogowe artysty po ustawieniu
  `SPOTIFY_CLIENT_ID` i `SPOTIFY_CLIENT_SECRET`.

Frekwencja pozostaje estymacją kierunkową do czasu podłączenia historycznej
sprzedaży i kosztów promotera.

Spotify nie wpływa na scoring ani prognozę. Dane są wyświetlane referencyjnie,
zgodnie z ograniczeniami Spotify Developer Policy. Publiczne API nie udostępnia
miesięcznych słuchaczy Spotify for Artists.

## Kalkulator break-even

Raport zawiera interaktywny kalkulator:

- koszty stałe,
- cena i opłaty biletowe,
- koszt zmienny na uczestnika,
- przychód dodatkowy na uczestnika,
- próg rentowności oraz zysk dla P10/P50/P90 frekwencji.

Parametry kalkulatora są zapisywane w adresie URL. Przycisk `Kopiuj analizę`
tworzy odtwarzalny link zawierający artystę, miasto i założenia finansowe.

## Sekrety

Sekrety należy ustawić wyłącznie po stronie hostingu. Ich nazwy znajdują się
w `.env.example`. Nie należy umieszczać wartości w kodzie ani w GitHubie.

## Uruchomienie lokalne

Otwórz `index.html` albo uruchom prosty serwer:

```powershell
python -m http.server 4173
```

## Backend

Endpoint `api/analyze.js` jest zgodny z funkcjami Vercel. Lokalnie i na GitHub
Pages frontend korzysta bezpośrednio z otwartych API i pokazuje częściowe
pokrycie danych.
