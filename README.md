# UNXT.me

A static Unix timestamp converter. Serve this directory with any static web server
(for example, `python3 -m http.server 8000`) and open `http://localhost:8000`.
No build step or API key is required.

City search uses the Open-Meteo geocoding API and requires an internet connection.
The first result is selected automatically; choose another result to disambiguate
cities with the same name. Search failures can be retried with Enter.

Date input accepts the displayed Moment format, ISO 8601, and common dates such
as `September 6, 2026 at 3:30 pm`, `6 Sep 2026 15:30`, and `9/6/2026`.
Commas, ordinal suffixes, extra spaces, and AM/PM punctuation are accepted.
Dates without a time use midnight. Numeric dates default to month/day/year;
a configured day-first format takes priority. Invalid dates and trailing junk
are rejected. City conversions use the date's time-zone rules, including
seasonal offsets. As with Moment Timezone, nonexistent spring-forward times move
forward by the DST gap, and repeated fall-back times use the earlier occurrence
unless an explicit offset is supplied. Include `SSS` in the date format to retain
milliseconds when converting back from a formatted date.

Natural-language input also accepts `now`, `tomorrow at 3pm`, `next Friday`,
`2 hours ago`, `in 2 days`, `September 6 at noon`, and clock-only input like `8pm`.
Omitted dates or years prefer upcoming occurrences. Dates without a time use
midnight; relative durations retain the reference time. Relative expressions are
anchored when you edit the input, in the selected time zone. The interpreted date
and UTC offset are shown below the converter. Unambiguous day-first numeric dates
(e.g. `13/6/2026`) are also accepted. Ranges and unrelated prose are rejected.

Moment 2.30.1 and Moment Timezone 0.6.0 (full zone data) are bundled in `vendor/`,
with their MIT licenses. Update the bundled timezone data when time-zone rules
change. Chrono 2.10.1 is bundled for English natural-language parsing, with its
MIT license. Regenerate its browser bundle with `npm run build:vendor` after
installing dependencies. Bootstrap styling is loaded from its existing CDN.

## Tests

With Node.js 22.13 or newer:

```sh
npm ci
npm test
```

The tests cover conversion in both directions, UTC, seasonal and fractional city
offsets, invalid inputs, result selection, failed searches, retries, and stale
responses. Network responses are stubbed in the regression tests.
