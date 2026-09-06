/* global moment, chrono */
(function () {
    'use strict';
    const $ = (selector) => document.querySelector(selector);
    const unixInput = $('#unix_time');
    const humanInput = $('#human_time');
    const humanFormat = 'dddd, MMMM D YYYY h:mm:ss A';
    const humanMillisecondFormat = 'dddd, MMMM D YYYY h:mm:ss.SSS A';
    const cityInput = $('#time_location');
    const details = $('.time_location_details');
    const results = $('#city_results');
    const status = $('#conversion_status');
    let direction = 'unix';
    let selectedCity = null;
    let searchTimer;
    let controller;
    let requestId = 0;
    let referenceTime = Date.now();
    let detectedUnits = 'seconds';
    const cache = new Map();
    const zoneMode = () => $('input[name=time_zone]:checked').value;
    const units = () => {
        const selected = $('input[name=unix_format]:checked').value;
        return selected === 'auto' ? detectedUnits : selected;
    };
    const cityLabel = (city) => [...new Set([city.name, city.admin1, city.country].filter(Boolean))].join(', ');

    const dateFormats = [
        'YYYY-M-D', 'YYYY/M/D', 'M/D/YYYY', 'M-D-YYYY',
        'MMM D YYYY', 'MMMM D YYYY', 'D MMM YYYY', 'D MMMM YYYY'
    ];
    const timeFormats = ['H:mm', 'HH:mm', 'H:mm:ss', 'HH:mm:ss', 'H:mm:ss.SSS', 'HH:mm:ss.SSS'];
    for (const hour of ['h', 'hh']) {
        for (const minutes of ['', ':mm', ':mm:ss', ':mm:ss.SSS']) timeFormats.push(hour + minutes + ' A');
    }
    const forgivingFormats = dateFormats.flatMap(date => [date, ...timeFormats.map(time => date + ' ' + time)]);

    function parseInZone(value, formats) {
        if (zoneMode() === 'city') return moment.tz(value, formats, true, selectedCity.timezone);
        if (zoneMode() === 'utc') return moment.utc(value, formats, true);
        return moment(value, formats, true);
    }

    function parseHuman() {
        const value = humanInput.value.trim();
        // Accept our displayed dates as well as ISO input.
        const displayed = parseInZone(value, [humanFormat, humanMillisecondFormat, moment.ISO_8601]);
        if (displayed.isValid()) return displayed;
        const normalized = value
            .replace(/(\d)(st|nd|rd|th)\b/gi, '$1')
            .replace(/,/g, ' ')
            .replace(/\bat\b/gi, ' ')
            .replace(/([ap])\.?m\.?$/i, (_, period) => ' ' + period.toUpperCase() + 'M')
            .replace(/\s+/g, ' ')
            .trim()
            // Normalize date padding only; preserve minutes, seconds and years.
            .replace(/^\d{4}([-\/])\d{1,2}\1\d{1,2}\b|^\d{1,2}([-\/])\d{1,2}\2\d{4}\b/, date =>
                date.replace(/\b0(\d)\b/g, '$1'))
            .replace(/\b0(\d)(?= [A-Za-z]| \d{4}\b)/g, '$1');
        const common = parseInZone(normalized, forgivingFormats);
        return common.isValid() ? common : parseNatural(value);
    }

    function parseNatural(value) {
        const reference = moment(referenceTime);
        if (zoneMode() === 'utc') reference.utc();
        else if (zoneMode() === 'city') reference.tz(selectedCity.timezone);
        const matches = chrono.casual.parse(value, {
            instant: reference.toDate(), timezone: reference.utcOffset()
        }, { forwardDate: true });
        // A converter needs one complete date, not a date extracted from prose or a range.
        if (matches.length !== 1 || matches[0].index !== 0 || matches[0].text.length !== value.length || matches[0].end) return moment.invalid();
        const start = matches[0].start;
        if (start.isCertain('timezoneOffset')) return moment(start.date());
        const hasTime = start.isCertain('hour') || start.tags().has('result/relativeDate');
        const parts = {
            year: start.get('year'), month: start.get('month') - 1, day: start.get('day'),
            hour: hasTime ? start.get('hour') : 0,
            minute: hasTime ? start.get('minute') : 0,
            second: hasTime ? start.get('second') : 0,
            millisecond: hasTime ? start.get('millisecond') : 0
        };
        // Reconstruct wall time in the destination zone so future dates use their own DST offset.
        if (zoneMode() === 'city') return moment.tz(parts, selectedCity.timezone);
        if (zoneMode() === 'utc') return moment.utc(parts);
        return moment(parts);
    }

    function render() {
        $('label[for=auto_units]').textContent = 'auto (' + detectedUnits + ')';
        $('.unix_time .input').hidden = direction !== 'unix';
        $('.unix_time .output').hidden = direction === 'unix';
        $('.human_time .input').hidden = direction !== 'human';
        $('.human_time .output').hidden = direction === 'human';
        $('#swap').textContent = direction === 'unix' ? '→' : '←';
        $('#swap').setAttribute('aria-label', direction === 'unix' ? 'Convert human time to Unix time' : 'Convert Unix time to human time');
        const output = $(direction === 'unix' ? '.human_time .output' : '.unix_time .output');
        output.textContent = '';
        status.textContent = '';
        $('#unix_status').textContent = '';
        status.classList.remove('error');
        [unixInput, humanInput].forEach((input) => {
            input.classList.remove('error');
            input.removeAttribute('aria-invalid');
        });
        if (zoneMode() === 'city' && !selectedCity) return;
        let time;
        if (direction === 'unix') {
            const value = unixInput.value.trim();
            const timestamp = Number(value) * (units() === 'seconds' ? 1000 : 1);
            time = /^[-+]?\d+(\.\d+)?$/.test(value) && Number.isFinite(timestamp) ? moment(timestamp) : moment.invalid();
            if (zoneMode() === 'utc') time.utc();
            else if (zoneMode() === 'city') time.tz(selectedCity.timezone);
        } else {
            time = parseHuman();
        }
        if (!time.isValid()) {
            const input = direction === 'unix' ? unixInput : humanInput;
            input.classList.add('error');
            status.classList.add('error');
            input.setAttribute('aria-invalid', 'true');
            const feedback = direction === 'unix' ? $('#unix_status') : status;
            feedback.textContent = direction === 'unix' ? 'Enter a valid Unix timestamp.' : 'Try tomorrow at 3pm, next Friday, 2 hours ago, or September 6 at noon.';
            return;
        }
        output.textContent = direction === 'unix' ? time.format(units() === 'milliseconds' ? humanMillisecondFormat : humanFormat) : String(units() === 'seconds' ? Math.floor(time.valueOf() / 1000) : time.valueOf());
        if (direction === 'human') {
            const interpreted = time.clone();
            if (zoneMode() === 'utc') interpreted.utc();
            else if (zoneMode() === 'city') interpreted.tz(selectedCity.timezone);
            else interpreted.local();
            status.textContent = 'Interpreted as ' + interpreted.format('dddd, MMMM D YYYY h:mm:ss A [UTC]Z');
        }
        if (zoneMode() === 'city') {
            const zoned = time.clone().tz(selectedCity.timezone);
            details.textContent = cityLabel(selectedCity) + ' · ' + selectedCity.timezone + ' (UTC' + zoned.format('Z') + ')';
        }
    }

    function cancelSearch() {
        clearTimeout(searchTimer);
        if (controller) controller.abort();
        requestId += 1;
        cityInput.classList.remove('pending');
        cityInput.setAttribute('aria-busy', 'false');
    }

    function selectCity(city) {
        selectedCity = city;
        cityInput.classList.remove('pending', 'error');
        cityInput.classList.add('success');
        cityInput.removeAttribute('aria-invalid');
        render();
    }

    function showCities(cities) {
        results.replaceChildren();
        cities.forEach((city) => {
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = cityLabel(city);
            button.addEventListener('click', () => {
                selectCity(city);
                results.replaceChildren();
            });
            item.append(button);
            results.append(item);
        });
        if (cities.length) selectCity(cities[0]);
        else {
            cityInput.classList.add('error');
            cityInput.setAttribute('aria-invalid', 'true');
            details.textContent = 'No matching cities found. Try another city name.';
        }
    }

    function searchCities() {
        cancelSearch();
        selectedCity = null;
        results.replaceChildren();
        cityInput.classList.remove('error', 'success');
        cityInput.removeAttribute('aria-invalid');
        render();
        const query = cityInput.value.trim();
        if (query.length < 2) {
            details.textContent = 'Enter at least two letters to search for a city.';
            return;
        }
        details.textContent = 'Searching cities…';
        cityInput.classList.add('pending');
        cityInput.setAttribute('aria-busy', 'true');
        const id = requestId;
        searchTimer = setTimeout(async () => {
            const key = query.toLocaleLowerCase();
            const activeController = new AbortController();
            controller = activeController;
            const timeout = setTimeout(() => activeController.abort(), 10000);
            try {
                let cities = cache.get(key);
                if (!cities) {
                    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
                    url.search = new URLSearchParams({ name: query, count: '8', language: 'en', format: 'json' });
                    const response = await fetch(url, { signal: activeController.signal });
                    if (!response.ok) throw new Error('City lookup failed');
                    const data = await response.json();
                    if (data.error) throw new Error('City lookup failed');
                    cities = (data.results || []).filter((city) => city.timezone && moment.tz.zone(city.timezone));
                    cache.set(key, cities);
                }
                if (id === requestId && zoneMode() === 'city') showCities(cities);
            } catch (error) {
                if (id !== requestId) return;
                cityInput.classList.add('error');
                details.textContent = 'City search is unavailable. Press Enter to retry.';
            } finally {
                clearTimeout(timeout);
                if (id === requestId) {
                    cityInput.classList.remove('pending');
                    cityInput.setAttribute('aria-busy', 'false');
                }
            }
        }, 350);
    }

    function swap() {
        const output = $(direction === 'unix' ? '.human_time .output' : '.unix_time .output').textContent;
        if (direction === 'unix') humanInput.value = output || humanInput.value;
        else unixInput.value = output || unixInput.value;
        direction = direction === 'unix' ? 'human' : 'unix';
        render();
        const input = direction === 'unix' ? unixInput : humanInput;
        input.focus();
        input.select();
    }

    unixInput.value = Math.floor(Date.now() / 1000);
    $('#auto_units').checked = true;
    $('#local').checked = true;
    [unixInput, humanInput].forEach((input) => input.addEventListener('input', () => {
        if (input === humanInput) referenceTime = Date.now();
        if (input === unixInput) {
            // Magnitude is a heuristic; manual units handle dates near the epoch or far in the future.
            const value = Number(unixInput.value.trim());
            if (Number.isFinite(value)) detectedUnits = Math.abs(value) >= 1e11 ? 'milliseconds' : 'seconds';
        }
        render();
    }));
    document.querySelectorAll('input[name=unix_format]').forEach((input) => input.addEventListener('change', render));
    document.querySelectorAll('input[name=time_zone]').forEach((input) => input.addEventListener('change', () => {
        if (zoneMode() === 'city') searchCities();
        else {
            cancelSearch();
            results.replaceChildren();
            details.textContent = '';
            cityInput.classList.remove('error', 'success');
            render();
        }
    }));
    cityInput.addEventListener('focus', () => {
        if (zoneMode() !== 'city') {
            $('#city').checked = true;
            searchCities();
        }
    });
    cityInput.addEventListener('input', searchCities);
    cityInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); searchCities(); }
        if (event.key === 'Escape') results.replaceChildren();
        if (event.key === 'ArrowDown' && results.firstElementChild) {
            event.preventDefault();
            results.querySelector('button').focus();
        }
    });
    $('#swap').addEventListener('click', swap);
    document.querySelectorAll('.output').forEach((output) => {
        output.addEventListener('click', swap);
        output.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); swap(); }
        });
    });
    render();
}());
