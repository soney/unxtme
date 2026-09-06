const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { JSDOM } = require('jsdom');
const root = resolve(__dirname, '..');
const detroit = { name: 'Detroit', admin1: 'Michigan', country: 'United States', timezone: 'America/Detroit' };
const kathmandu = { name: 'Kathmandu', country: 'Nepal', timezone: 'Asia/Kathmandu' };
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function setup(t, fetch = async () => ({ ok: true, json: async () => ({ results: [detroit] }) })) {
    const dom = new JSDOM(readFileSync(resolve(root, 'index.html'), 'utf8'), { runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const w = dom.window;
    w.fetch = fetch;
    for (const file of ['vendor/moment.min.js', 'vendor/moment-timezone-with-data.min.js', 'vendor/chrono.min.js', 'unxtme.js']) w.eval(readFileSync(resolve(root, file), 'utf8'));
    const $ = s => w.document.querySelector(s);
    const input = (s, value) => { $(s).value = value; $(s).dispatchEvent(new w.Event('input')); };
    const radio = s => { $(s).checked = true; $(s).dispatchEvent(new w.Event('change')); };
    const search = async value => { radio('#city'); input('#time_location', value); await pause(400); };
    return { w, $, input, radio, search };
}
test('UTC, negative timestamps, milliseconds and invalid input', t => {
    const { $, input, radio } = setup(t);
    radio('#utc'); input('#human_format', 'YYYY-MM-DD HH:mm:ss.SSS');
    input('#unix_time', '0'); assert.equal($('.human_time .output').textContent, '1970-01-01 00:00:00.000');
    input('#unix_time', '-1'); assert.equal($('.human_time .output').textContent, '1969-12-31 23:59:59.000');
    radio('#milliseconds'); input('#unix_time', '1234'); assert.equal($('.human_time .output').textContent, '1970-01-01 00:00:01.234');
    $('#swap').click(); assert.equal($('.unix_time .output').textContent, '1234');
    input('#human_time', '2024-02-30'); assert.equal($('#human_time').getAttribute('aria-invalid'), 'true');
    $('#swap').click();
    for (const value of ['123abc', '', 'Infinity', '99999999999999999999']) {
        input('#unix_time', value); assert.equal($('.human_time .output').textContent, ''); assert.equal($('#unix_time').getAttribute('aria-invalid'), 'true');
    }
});
test('city DST offsets and reverse conversion are independent of host zone', async t => {
    const { $, input, search } = setup(t);
    input('#human_format', 'YYYY-MM-DD HH:mm:ss');
    await search('Detroit');
    input('#unix_time', String(Date.UTC(2024, 0, 15, 12) / 1000));
    assert.equal($('.human_time .output').textContent, '2024-01-15 07:00:00');
    assert.match($('.time_location_details').textContent, /UTC-05:00/);
    input('#unix_time', String(Date.UTC(2024, 6, 15, 12) / 1000));
    assert.equal($('.human_time .output').textContent, '2024-07-15 08:00:00');
    $('#swap').click(); assert.equal($('.unix_time .output').textContent, String(Date.UTC(2024, 6, 15, 12) / 1000));
    input('#human_time', '2024-01-15 07:00:00'); assert.equal($('.unix_time .output').textContent, String(Date.UTC(2024, 0, 15, 12) / 1000));
});
test('select alternate city and preserve quarter-hour offset', async t => {
    const { $, input, search } = setup(t, async () => ({ ok: true, json: async () => ({ results: [detroit, kathmandu] }) }));
    input('#human_format', 'YYYY-MM-DD HH:mm:ss'); input('#unix_time', '1705320000');
    await search('city'); $('#city_results li:nth-child(2) button').click();
    assert.match($('.time_location_details').textContent, /UTC\+05:45/);
    assert.equal($('.human_time .output').textContent, '2024-01-15 17:45:00');
});
test('empty results and failed requests stop pending state, Enter retries', async t => {
    let mode = 'empty';
    const { w, $, search } = setup(t, async () => {
        if (mode === 'error') throw new Error('offline');
        return { ok: true, json: async () => ({ results: mode === 'empty' ? [] : [detroit] }) };
    });
    await search('nonesuch'); assert.match($('.time_location_details').textContent, /No matching/);
    mode = 'error'; await search('Detroit'); assert.match($('.time_location_details').textContent, /unavailable/);
    assert.equal($('#time_location').getAttribute('aria-busy'), 'false');
    mode = 'ok'; $('#time_location').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter' })); await pause(400);
    assert.match($('.time_location_details').textContent, /America\/Detroit/);
});
test('late responses cannot overwrite a newer search or local mode', async t => {
    const requests = [];
    const { $, input, radio } = setup(t, () => new Promise(resolve => requests.push(resolve)));
    radio('#city'); input('#time_location', 'Detroit'); await pause(400);
    input('#time_location', 'Kathmandu'); await pause(400);
    requests[1]({ ok: true, json: async () => ({ results: [kathmandu] }) }); await pause(0);
    requests[0]({ ok: true, json: async () => ({ results: [detroit] }) }); await pause(0);
    assert.match($('.time_location_details').textContent, /Kathmandu/);
    input('#time_location', 'Paris'); await pause(400); radio('#local');
    requests[2]({ ok: true, json: async () => ({ results: [detroit] }) }); await pause(0);
    assert.equal($('.time_location_details').textContent, '');
    assert.equal($('#city_results').children.length, 0);
});
test('common human dates accept punctuation, padding and 12/24-hour times', t => {
    const { $, input, radio } = setup(t);
    radio('#utc'); $('#swap').click();
    for (const value of [
        'September 6, 2026 at 3:30 pm', 'Sep 6th, 2026 3:30PM',
        '6 September 2026 15:30', '06 Sep 2026 15:30:00',
        '9/6/2026 3:30 p.m.', '09/06/2026 03:30pm',
        '2026/09/06 15:30', '09-06-2026 15:30',
        '  September   6, 2026   at  3:30pm  '
    ]) {
        input('#human_time', value);
        assert.equal($('.unix_time .output').textContent, String(Date.UTC(2026, 8, 6, 15, 30) / 1000), value);
    }
    input('#human_time', 'September 6, 2026');
    assert.equal($('.unix_time .output').textContent, String(Date.UTC(2026, 8, 6) / 1000));
    input('#human_time', 'September 6, 2026 at 3pm');
    assert.equal($('.unix_time .output').textContent, String(Date.UTC(2026, 8, 6, 15) / 1000));
    input('#human_format', 'DD/MM/YYYY'); input('#human_time', '06/09/2026');
    assert.equal($('.unix_time .output').textContent, String(Date.UTC(2026, 8, 6) / 1000));
});
test('forgiving parsing retains local/city zones and explicit ISO offsets', async t => {
    const { $, input, radio, search } = setup(t);
    $('#swap').click(); input('#human_time', 'January 15, 2024 at 7am');
    assert.equal($('.unix_time .output').textContent, String(new Date(2024, 0, 15, 7).getTime() / 1000));
    await search('Detroit');
    assert.equal($('.unix_time .output').textContent, String(Date.UTC(2024, 0, 15, 12) / 1000));
    input('#human_time', 'July 15, 2024 at 7am');
    assert.equal($('.unix_time .output').textContent, String(Date.UTC(2024, 6, 15, 11) / 1000));
    radio('#utc'); input('#human_time', '2024-01-15T07:00:00-05:00');
    assert.equal($('.unix_time .output').textContent, String(Date.UTC(2024, 0, 15, 12) / 1000));
});
test('forgiving parsing still rejects impossible dates and partial matches', t => {
    const { $, input } = setup(t); $('#swap').click();
    for (const value of ['February 30, 2026', '2/29/2025', 'September 6, 2026 25:30', 'September 6, 2026 13pm', 'September 6, 2026 garbage', '', 'hello']) {
        input('#human_time', value);
        assert.equal($('.unix_time .output').textContent, '', value);
        assert.equal($('#human_time').getAttribute('aria-invalid'), 'true', value);
    }
});
test('natural language supports relative dates, missing years, clock times and explicit offsets', t => {
    const { w, $, input, radio } = setup(t);
    const now = Date.UTC(2026, 2, 7, 17);
    w.Date.now = () => now;
    radio('#utc'); $('#swap').click();
    for (const [value, expected] of [
        ['now', now], ['2 hours ago', now - 7200000], ['in 30 minutes', now + 1800000],
        ['tomorrow at 3pm', Date.UTC(2026, 2, 8, 15)],
        ['yesterday at midnight', Date.UTC(2026, 2, 6)],
        ['next Friday', Date.UTC(2026, 2, 13)],
        ['September 6 at noon', Date.UTC(2026, 8, 6, 12)],
        ['8pm', Date.UTC(2026, 2, 7, 20)],
        ['13/6/2026', Date.UTC(2026, 5, 13)],
        ['March 7, 2026 at 3pm EST', Date.UTC(2026, 2, 7, 20)]
    ]) {
        input('#human_time', value);
        assert.equal($('.unix_time .output').textContent, String(expected / 1000), value);
        assert.match($('#conversion_status').textContent, /^Interpreted as/);
    }
    input('#human_time', '2 hours ago'); w.Date.now = () => now + 60000;
    radio('#milliseconds'); assert.equal($('.unix_time .output').textContent, String(now - 7200000));
});
test('relative city times use the city calendar and handle DST transitions', async t => {
    const { w, $, input, search } = setup(t);
    w.Date.now = () => Date.UTC(2026, 2, 7, 17);
    await search('Detroit'); $('#swap').click();
    input('#human_time', 'tomorrow at 3pm');
    assert.equal($('.unix_time .output').textContent, String(Date.UTC(2026, 2, 8, 19) / 1000));
    input('#human_time', 'in 2 days');
    assert.equal($('.unix_time .output').textContent, String(Date.UTC(2026, 2, 9, 16) / 1000));
    w.Date.now = () => Date.UTC(2026, 2, 8, 6, 30);
    input('#human_time', 'in 2 hours');
    assert.equal($('.unix_time .output').textContent, String(Date.UTC(2026, 2, 8, 8, 30) / 1000));
    w.Date.now = () => Date.UTC(2026, 2, 8, 2);
    input('#human_time', 'tomorrow at noon');
    assert.equal($('.unix_time .output').textContent, String(Date.UTC(2026, 2, 8, 16) / 1000));
});
test('natural language rejects ranges, multiple dates and unrelated prose', t => {
    const { $, input } = setup(t); $('#swap').click();
    for (const value of ['tomorrow from 3pm to 5pm', 'Monday and Wednesday', 'meet me tomorrow', 'tomorrow garbage']) {
        input('#human_time', value);
        assert.equal($('.unix_time .output').textContent, '', value);
        assert.equal($('#human_time').getAttribute('aria-invalid'), 'true');
    }
});
