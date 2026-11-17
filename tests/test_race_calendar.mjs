import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const calendarPath = join(__dirname, '..', 'race-calendars.json');

console.log('Testing race-calendars.json schema and data integrity...');

const raw = readFileSync(calendarPath, 'utf8');
const data = JSON.parse(raw);

assert.ok(data.verifiedAt, 'Missing verifiedAt property');
assert.ok(Array.isArray(data.series), 'series must be an array');
assert.ok(data.series.length > 0, 'series array must not be empty');

for (const series of data.series) {
  assert.ok(series.id, 'Series missing id');
  assert.ok(series.name, `Series ${series.id} missing name`);
  assert.ok(series.season, `Series ${series.id} missing season`);
  assert.ok(Array.isArray(series.events), `Series ${series.id} missing events array`);

  for (const event of series.events) {
    assert.ok(event.name, `Event missing name in series ${series.id}`);
    assert.ok(event.location, `Event ${event.name} missing location`);
    assert.ok(event.start, `Event ${event.name} missing start date`);
    assert.ok(event.end, `Event ${event.name} missing end date`);
  }
}

console.log(`Successfully verified ${data.series.length} series and all calendar events.`);
