const localState = {
  currentSource: null,
  audioContext: null,
  analyser: null,
  sourceNode: null,
  stream: null,
  animationFrame: null,
  timezone: 'Asia/Kolkata',
  frequencyData: null,
  previousLevels: [],
  lowPerformanceMode: false,
  barCount: 42,
  sensitivity: 1.3,
  smoothing: 0.82,
  intensity: 0.8,
  colorPreset: 'nerv',
};

const getElement = (id) => document.getElementById(id);
let visualiserCanvas = null;
let visualiserCtx = null;

const getVisualiserContext = () => {
  if (!visualiserCanvas) {
    visualiserCanvas = getElement('visualiserCanvas');
  }

  if (!visualiserCanvas) return null;
  if (!visualiserCtx) {
    visualiserCtx = visualiserCanvas.getContext('2d');
  }

  return visualiserCtx;
};

const formatTime = (date) => {
  const options = {
    timeZone: localState.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };

  return new Intl.DateTimeFormat('en-IN', options).format(date);
};

const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: localState.timezone,
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const applyClockState = () => {
  const clockDisplay = getElement('clockDisplay');
  const clockDate = getElement('clockDate');
  const timezoneLabel = getElement('timezoneLabel');
  const overlayTime = getElement('overlayTime');
  const overlayDate = getElement('overlayDate');

  if (!clockDisplay && !overlayTime) return;

  const now = new Date();

  if (clockDisplay) clockDisplay.textContent = formatTime(now);
  if (clockDate) clockDate.textContent = formatDate(now);
  if (timezoneLabel) {
    const zoneName = Intl.DateTimeFormat('en-US', {
      timeZone: localState.timezone,
      timeZoneName: 'short',
    }).formatToParts(now).find((part) => part.type === 'timeZoneName')?.value || 'IST';
    timezoneLabel.textContent = `${zoneName} • ${localState.timezone}`;
  }
  if (overlayTime) overlayTime.textContent = formatTime(now);
  if (overlayDate) overlayDate.textContent = formatDate(now);

};

const WEATHER_LOCATION_KEY = 'nerv-weather-location';
const WEATHER_REFRESH_INTERVAL = 15 * 60 * 1000;
let weatherLastAttemptAt = 0;
let weatherRequestInProgress = false;

const getWeatherDetails = (code) => {
  if (code === 0) return { description: 'Clear sky', state: 'clear' };
  if (code === 1) return { description: 'Mostly clear', state: 'clear' };
  if (code === 2) return { description: 'Partly cloudy', state: 'cloudy' };
  if (code === 3) return { description: 'Overcast', state: 'cloudy' };
  if (code === 45 || code === 48) return { description: 'Fog', state: 'fog' };
  if (code >= 51 && code <= 57) return { description: 'Drizzle', state: 'rain' };
  if (code >= 61 && code <= 67) return { description: 'Rain', state: 'rain' };
  if (code >= 71 && code <= 77) return { description: 'Snow', state: 'snow' };
  if (code >= 80 && code <= 82) return { description: 'Rain showers', state: 'rain' };
  if (code === 85 || code === 86) return { description: 'Snow showers', state: 'snow' };
  if (code >= 95 && code <= 99) return { description: 'Thunderstorm', state: 'storm' };
  return { description: 'Current conditions', state: 'cloudy' };
};

const getSavedWeatherLocation = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(WEATHER_LOCATION_KEY) || 'null');
    if (
      Number.isFinite(saved?.latitude)
      && saved.latitude >= -90
      && saved.latitude <= 90
      && Number.isFinite(saved?.longitude)
      && saved.longitude >= -180
      && saved.longitude <= 180
    ) {
      return { latitude: saved.latitude, longitude: saved.longitude };
    }
  } catch (error) {
    console.warn('Unable to read the saved weather location:', error);
  }
  return null;
};

const setWeatherMessage = (message) => {
  const node = getElement('weatherMessage');
  if (node) node.textContent = message;
};

const refreshWeather = async (force = false) => {
  if (!getElement('weatherCondition') || weatherRequestInProgress) return;
  const location = getSavedWeatherLocation();
  const enableButton = getElement('enableWeather');
  const forgetButton = getElement('forgetWeatherLocation');
  if (!location) {
    const condition = getElement('weatherCondition');
    const temperature = getElement('weatherTemperature');
    const locationLabel = getElement('weatherLocation');
    const updated = getElement('weatherUpdated');
    if (condition) condition.textContent = 'Weather off';
    if (temperature) temperature.textContent = '—';
    if (locationLabel) locationLabel.textContent = 'Enable location for current conditions';
    if (updated) updated.textContent = 'No location is saved';
    if (enableButton) {
      enableButton.disabled = false;
      enableButton.textContent = 'Enable local weather';
    }
    if (forgetButton) forgetButton.classList.add('hidden');
    document.body.removeAttribute('data-weather');
    return;
  }

  if (!force && Date.now() - weatherLastAttemptAt < WEATHER_REFRESH_INTERVAL) return;
  weatherLastAttemptAt = Date.now();
  weatherRequestInProgress = true;
  if (enableButton) {
    enableButton.disabled = true;
    enableButton.textContent = 'Updating weather…';
  }
  setWeatherMessage('Loading current conditions from Open-Meteo…');

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: 'temperature_2m,weather_code,is_day',
      timezone: 'auto',
    });
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Weather service returned ${response.status}.`);
    const data = await response.json();
    const current = data.current;
    if (
      !current
      || !Number.isFinite(current.temperature_2m)
      || !Number.isInteger(current.weather_code)
      || typeof current.is_day !== 'number'
      || typeof data.timezone !== 'string'
    ) {
      throw new Error('Weather service returned incomplete current conditions.');
    }

    const details = getWeatherDetails(current.weather_code);
    const daylight = current.is_day === 1 ? 'day' : 'night';
    const condition = getElement('weatherCondition');
    const temperature = getElement('weatherTemperature');
    const locationLabel = getElement('weatherLocation');
    const updated = getElement('weatherUpdated');
    if (condition) condition.textContent = details.description;
    if (temperature) temperature.textContent = `${Math.round(current.temperature_2m)}°C`;
    if (locationLabel) locationLabel.textContent = `Near you · ${data.timezone}`;
    if (updated) {
      updated.textContent = `Updated ${new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: data.timezone,
      }).format(new Date())}`;
    }
    document.body.dataset.weather = `${details.state}-${daylight}`;
    localState.timezone = data.timezone;
    applyClockState();
    persistSettings();
    if (enableButton) {
      enableButton.disabled = false;
      enableButton.textContent = 'Update location';
    }
    if (forgetButton) forgetButton.classList.remove('hidden');
    setWeatherMessage('The background gently reflects current conditions and refreshes every 15 minutes. Location stays on this device.');
  } catch (error) {
    console.warn('Unable to refresh current weather:', error);
    const condition = getElement('weatherCondition');
    const temperature = getElement('weatherTemperature');
    const updated = getElement('weatherUpdated');
    if (condition) condition.textContent = 'Weather unavailable';
    if (temperature) temperature.textContent = '—';
    if (updated) updated.textContent = 'No current report';
    document.body.removeAttribute('data-weather');
    if (enableButton) {
      enableButton.disabled = false;
      enableButton.textContent = 'Retry weather';
    }
    if (forgetButton) forgetButton.classList.remove('hidden');
    setWeatherMessage('The live weather service could not be reached. The clock still works; try again when online.');
  } finally {
    weatherRequestInProgress = false;
  }
};

const requestWeatherLocation = () => {
  if (!navigator.geolocation) {
    setWeatherMessage('This browser does not support location access. The clock remains available without weather.');
    return;
  }
  const button = getElement('enableWeather');
  if (button) {
    button.disabled = true;
    button.textContent = 'Requesting location…';
  }
  setWeatherMessage('Your browser will ask permission to use this device’s location.');
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const location = { latitude: coords.latitude, longitude: coords.longitude };
      try {
        localStorage.setItem(WEATHER_LOCATION_KEY, JSON.stringify(location));
      } catch (error) {
        console.warn('Unable to save weather location on this device:', error);
        setWeatherMessage('Location storage is unavailable. Weather can update for this visit only.');
      }
      weatherLastAttemptAt = 0;
      await refreshWeather(true);
    },
    (error) => {
      console.warn('Device location was not available:', error);
      if (button) {
        button.disabled = false;
        button.textContent = 'Enable local weather';
      }
      const message = error.code === 1
        ? 'Location permission was denied. Allow it in browser settings to enable live weather.'
        : 'Could not read the device location. Check location services and try again.';
      setWeatherMessage(message);
    },
    { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 10_000 },
  );
};

const forgetWeatherLocation = () => {
  try {
    localStorage.removeItem(WEATHER_LOCATION_KEY);
  } catch (error) {
    console.warn('Unable to remove the saved weather location:', error);
  }
  weatherLastAttemptAt = 0;
  localState.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  persistSettings();
  applyClockState();
  setWeatherMessage('Saved location removed. The clock remains available without weather.');
  void refreshWeather(true);
};

const persistSettings = () => {
  try {
    const settings = {
      timezone: localState.timezone,
      compactMode: !!getElement('compactModeToggle')?.checked,
      offlineCache: getElement('offlineCacheToggle')?.checked ?? true,
    };
    localStorage.setItem('nerv-terminal-settings', JSON.stringify(settings));
  } catch (error) {
    console.warn('Unable to save settings:', error);
  }
};

const loadSettings = () => {
  try {
    const raw = localStorage.getItem('nerv-terminal-settings');
    if (!raw) return;

    const settings = JSON.parse(raw);
    if (settings.timezone) localState.timezone = settings.timezone;

    const timezoneSelector = getElement('timezoneSelector');
    const compactModeToggle = getElement('compactModeToggle');
    const offlineCacheToggle = getElement('offlineCacheToggle');

    if (timezoneSelector) timezoneSelector.value = localState.timezone;
    if (compactModeToggle) compactModeToggle.checked = !!settings.compactMode;
    if (offlineCacheToggle) offlineCacheToggle.checked = settings.offlineCache !== false;
  } catch (error) {
    console.warn('Unable to restore settings:', error);
  }
};

const toggleFullscreen = async () => {
  if (!document.fullscreenElement) {
    try {
      await document.documentElement.requestFullscreen();
    } catch (error) {
      console.warn('Fullscreen request failed:', error);
    }
    return;
  }

  try {
    await document.exitFullscreen();
  } catch (error) {
    console.warn('Exit fullscreen failed:', error);
  }
};

const toggleScreensaver = () => {
  const overlay = getElement('clockOverlay');
  if (!overlay) return;
  overlay.classList.toggle('hidden');
};

let raceCalendarData = null;

const formatCalendarDate = (dateValue) => {
  const date = new Date(`${dateValue}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const formatCalendarDateRange = (startValue, endValue) => {
  if (!startValue || !endValue) return 'Date to be confirmed';
  const start = new Date(`${startValue}T12:00:00`);
  const end = new Date(`${endValue}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Date to be confirmed';

  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(start);
    return `${month} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${formatCalendarDate(startValue)} - ${formatCalendarDate(endValue)}`;
};

const createRaceEventRow = (event, series, compact = false) => {
  const row = document.createElement('article');
  row.className = compact ? 'home-race-event' : 'race-event-row';

  const date = document.createElement('time');
  date.className = 'race-event-date';
  date.dateTime = event.start;
  date.textContent = formatCalendarDateRange(event.start, event.end);

  const details = document.createElement('div');
  details.className = 'race-event-details';
  const name = document.createElement('strong');
  name.textContent = event.name;
  const location = document.createElement('small');
  location.textContent = event.location;
  details.append(name, location);

  if (compact) {
    const seriesName = document.createElement('small');
    seriesName.className = 'race-event-series';
    seriesName.textContent = series.shortName;
    row.append(date, details, seriesName);
  } else {
    const eventLink = document.createElement('a');
    eventLink.className = 'race-event-link';
    eventLink.href = event.url;
    eventLink.target = '_blank';
    eventLink.rel = 'noopener noreferrer';
    eventLink.textContent = 'Official details';
    eventLink.setAttribute('aria-label', `Open official event details for ${event.name}`);
    row.append(date, details, eventLink);
  }
  return row;
};

const renderHomeRaceCalendar = (data) => {
  const container = getElement('homeRaceNextEvents');
  const status = getElement('homeRaceCalendarStatus');
  const note = getElement('homeRaceCalendarNote');
  const verifiedAt = getElement('homeRaceVerifiedAt');
  if (!container) return;

  container.replaceChildren();
  const nextEvents = data.series
    .flatMap((series) => series.events.map((event) => ({ series, event })))
    .filter(({ event }) => new Date(`${event.end}T23:59:59`).getTime() >= Date.now())
    .sort((a, b) => a.event.start.localeCompare(b.event.start))
    .slice(0, 4);

  nextEvents.forEach(({ series, event }) => {
    container.append(createRaceEventRow(event, series, true));
  });

  const partialCount = data.series.filter((series) => series.calendarStatus !== 'published').length;
  if (status) {
    status.textContent = `${data.series[0]?.season || ''} SEASON`;
    status.classList.remove('muted');
    status.classList.add(partialCount ? 'amber' : 'green');
  }
  if (note) {
    note.textContent = partialCount
      ? 'Upcoming events from official calendars. Some 2027 season schedules are not fully published.'
      : 'Upcoming events from official series calendars; this is schedule metadata, not live timing.';
  }
  if (verifiedAt) verifiedAt.textContent = `Verified ${formatCalendarDate(data.verifiedAt)}`;
};

const renderRaceCalendars = () => {
  const list = getElement('raceCalendarList');
  const status = getElement('raceCalendarStatus');
  const note = getElement('raceCalendarNote');
  const verifiedAt = getElement('raceCalendarVerifiedAt');
  if (!list || !raceCalendarData) return;

  const filter = getElement('raceSeriesFilter')?.value || 'all';
  const calendars = raceCalendarData.series.filter((series) => filter === 'all' || series.id === filter);
  list.replaceChildren();

  calendars.forEach((series) => {
    const card = document.createElement('article');
    card.className = 'race-calendar-card';

    const header = document.createElement('div');
    header.className = 'race-calendar-card-header';
    const heading = document.createElement('div');
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = `${series.shortName} • ${series.season}`;
    const title = document.createElement('h3');
    title.textContent = series.name;
    heading.append(eyebrow, title);

    const badge = document.createElement('span');
    badge.className = `inline-status ${series.calendarStatus === 'published' ? 'green' : 'amber'}`;
    badge.textContent = series.calendarStatus === 'published'
      ? `${series.roundCount} ROUNDS`
      : 'PARTIAL CALENDAR';
    header.append(heading, badge);
    card.append(header);

    const metadata = document.createElement('p');
    metadata.className = 'race-calendar-meta';
    metadata.textContent = series.discipline;
    card.append(metadata);

    if (series.note) {
      const notice = document.createElement('p');
      notice.className = 'race-calendar-note';
      notice.textContent = series.note;
      card.append(notice);
    }

    const events = document.createElement('div');
    events.className = 'race-calendar-events';
    series.events.forEach((event) => events.append(createRaceEventRow(event, series)));
    if (!series.events.length) {
      const empty = document.createElement('p');
      empty.className = 'source-note';
      empty.textContent = 'No events have been published for this season yet.';
      events.append(empty);
    }
    card.append(events);

    const source = document.createElement('a');
    source.className = 'race-calendar-source';
    source.href = series.sourceUrl;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = `Source: ${series.sourceName}`;
    card.append(source);
    list.append(card);
  });

  const partialCount = raceCalendarData.series.filter((series) => series.calendarStatus !== 'published').length;
  if (status) {
    status.textContent = partialCount ? 'SCHEDULES PARTIAL' : 'SCHEDULES PUBLISHED';
    status.classList.remove('muted');
    status.classList.add(partialCount ? 'amber' : 'green');
  }
  if (note) {
    note.textContent = partialCount
      ? 'Published 2027 calendars are listed here. Some series are still publishing their complete schedules.'
      : 'Published 2027 calendars and event details are available for the selected series.';
  }
  if (verifiedAt) verifiedAt.textContent = `Sources checked ${formatCalendarDate(raceCalendarData.verifiedAt)}`;
};

const loadRaceCalendars = async () => {
  if (!getElement('homeRaceNextEvents') && !getElement('raceCalendarList')) return;

  try {
    const response = await fetchCompanion('race-calendars.json');
    if (!response.ok) throw new Error(`Calendar catalogue returned ${response.status}.`);
    const data = await response.json();
    if (!Array.isArray(data.series) || !data.series.length) {
      throw new Error('Calendar catalogue contains no series metadata.');
    }
    raceCalendarData = data;
    renderHomeRaceCalendar(data);
    renderRaceCalendars();
  } catch (error) {
    console.warn('Unable to load sourced race calendars:', error);
    const note = getElement('raceCalendarNote') || getElement('homeRaceCalendarNote');
    const status = getElement('raceCalendarStatus') || getElement('homeRaceCalendarStatus');
    if (note) note.textContent = 'Race metadata is unavailable offline. Use the official calendar links after reconnecting.';
    if (status) status.textContent = 'UNAVAILABLE';
  }
};

const RACE_FEEDS = Object.freeze({
  wec: {
    publisher: 'Autosport.com',
    url: 'https://www.autosport.com/rss/feed/wec',
    allowedHost: 'autosport.com',
  },
  imsa: {
    publisher: 'Autosport.com',
    url: 'https://www.autosport.com/rss/feed/imsa',
    allowedHost: 'autosport.com',
  },
  wrc: {
    publisher: 'Autosport.com',
    url: 'https://www.autosport.com/rss/feed/wrc',
    allowedHost: 'autosport.com',
  },
  rally: {
    publisher: 'DirtFish',
    url: 'https://dirtfish.com/feed/',
    allowedHost: 'dirtfish.com',
  },
});
let raceFeedLastAttemptAt = 0;
let raceFeedRequestId = 0;

const setRaceFeedStatus = (text, tone = 'muted') => {
  const status = getElement('raceFeedStatus');
  if (!status) return;
  status.textContent = text;
  status.classList.remove('muted', 'green', 'amber');
  status.classList.add(tone);
};

const renderRaceFeed = (xmlText, feed) => {
  const list = getElement('raceFeedList');
  if (!list) return;
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('The racing news feed returned invalid XML.');

  const limit = Math.max(1, Number(list.dataset.limit) || 10);
  const items = Array.from(xml.querySelectorAll('item')).slice(0, limit);
  if (!items.length) throw new Error('The racing news feed did not contain any articles.');
  list.replaceChildren();

  items.forEach((item) => {
    const title = item.querySelector('title')?.textContent?.trim();
    const linkValue = item.querySelector('link')?.textContent?.trim();
    const published = item.querySelector('pubDate')?.textContent?.trim();
    if (!title || !linkValue) return;
    let link;
    try {
      link = new URL(linkValue);
    } catch {
      return;
    }
    if (
      link.protocol !== 'https:'
      || (link.hostname !== feed.allowedHost && !link.hostname.endsWith(`.${feed.allowedHost}`))
    ) return;

    const row = document.createElement('article');
    row.className = 'race-feed-item';
    const anchor = document.createElement('a');
    anchor.href = link.href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = title;
    const date = document.createElement('time');
    date.className = 'race-feed-date';
    if (published) {
      const parsedDate = new Date(published);
      if (!Number.isNaN(parsedDate.getTime())) {
        date.dateTime = parsedDate.toISOString();
        date.textContent = new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(parsedDate);
      } else {
        date.textContent = 'Date unavailable';
      }
    } else {
      date.textContent = 'Date unavailable';
    }
    row.append(anchor, date);
    list.append(row);
  });
  if (!list.childElementCount) throw new Error('The racing news feed contained no safe article links.');
};

const loadRaceFeed = async (force = false) => {
  const list = getElement('raceFeedList');
  if (!list) return;
  if (!force && Date.now() - raceFeedLastAttemptAt < WEATHER_REFRESH_INTERVAL) return;

  const key = getElement('raceFeedFilter')?.value || 'wec';
  const feed = RACE_FEEDS[key];
  if (!feed) return;
  const requestId = ++raceFeedRequestId;
  raceFeedLastAttemptAt = Date.now();
  setRaceFeedStatus('UPDATING');
  const note = getElement('raceFeedNote');
  if (note) note.textContent = 'Fetching recent headlines from the selected RSS publisher…';

  try {
    const response = await fetch(`/.netlify/functions/motorsport-feed?series=${encodeURIComponent(key)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const xmlText = await response.text();
    if (!response.ok) {
      let detail = `RSS service returned ${response.status}.`;
      try {
        detail = JSON.parse(xmlText).detail || detail;
      } catch {
        // Keep the generic status when the server does not return JSON.
      }
      throw new Error(detail);
    }
    if (requestId !== raceFeedRequestId) return;
    renderRaceFeed(xmlText, feed);
    const refreshedAt = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
    if (note) note.textContent = `Updated ${refreshedAt}. Headlines refresh every 15 minutes while this page is open; full stories remain with the publisher.`;
    const attribution = getElement('raceFeedAttribution');
    if (attribution) attribution.textContent = `RSS headlines provided by ${feed.publisher}.`;
    setRaceFeedStatus('LIVE', 'green');
  } catch (error) {
    if (requestId !== raceFeedRequestId) return;
    console.warn('Unable to load motorsport RSS headlines:', error);
    if (note) note.textContent = `${error.message} The sourced calendar remains available above.`;
    setRaceFeedStatus('OFFLINE', 'amber');
  }
};

const initialiseRaceFeed = () => {
  if (!getElement('raceFeedList')) return;
  getElement('raceFeedFilter')?.addEventListener('change', () => void loadRaceFeed(true));
  getElement('refreshRaceFeed')?.addEventListener('click', () => void loadRaceFeed(true));
  void loadRaceFeed(true);
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void loadRaceFeed();
  }, WEATHER_REFRESH_INTERVAL);
};

const initialiseWeather = () => {
  if (!getElement('weatherCondition')) return;
  getElement('enableWeather')?.addEventListener('click', requestWeatherLocation);
  getElement('forgetWeatherLocation')?.addEventListener('click', forgetWeatherLocation);
  void refreshWeather(true);
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void refreshWeather();
  }, WEATHER_REFRESH_INTERVAL);
};

const COMPANION_URL_KEY = 'nerv-loq-companion-url';
const COMPANION_SESSION_KEY = 'nerv-loq-session-token';
const COMPANION_MODE_KEY = 'nerv-loq-connection-mode';
let audioRefreshInProgress = false;
let metricsRefreshInProgress = false;

const getCompanionUrl = () => {
  const savedUrl = localStorage.getItem(COMPANION_URL_KEY);
  return savedUrl ? savedUrl.replace(/\/+$/, '') : '';
};

const getCompanionToken = () => sessionStorage.getItem(COMPANION_SESSION_KEY);
const getCompanionMode = () => sessionStorage.getItem(COMPANION_MODE_KEY)
  || (getCompanionUrl() ? 'local' : 'cloud');

const fetchCompanion = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
};

const companionRequest = async (path, options = {}) => {
  const baseUrl = getCompanionUrl();
  const token = getCompanionToken();
  const mode = getCompanionMode();
  if (!token || (mode === 'local' && !baseUrl)) {
    throw new Error('Connect to LOQ Link from the Connect page first.');
  }

  let response;
  if (mode === 'cloud') {
    let body = {};
    if (options.body) {
      try {
        body = JSON.parse(options.body);
      } catch {
        throw new Error('The requested LOQ command body is invalid.');
      }
    }
    response = await fetchCompanion('/.netlify/functions/loq-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: token, path, body }),
    });
  } else {
    response = await fetchCompanion(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  }
  if (!response.ok) {
    let detail = `LOQ Link returned ${response.status}.`;
    try {
      const body = await response.json();
      if (body.detail) detail = body.detail;
    } catch (error) {
      console.warn('Unable to read companion error response:', error);
    }
    if (response.status === 401) {
      sessionStorage.removeItem(COMPANION_SESSION_KEY);
      sessionStorage.removeItem(COMPANION_MODE_KEY);
      updateCompanionConnectionUi(false, 'Session expired. Pair to LOQ Link again.');
    }
    throw new Error(detail);
  }
  return response.json();
};

const updateCompanionConnectionUi = (connected, message) => {
  const badge = getElement('companionConnectionBadge');
  const messageElement = getElement('companionConnectionMessage');
  if (badge) {
    badge.textContent = connected ? 'CONNECTED' : 'DISCONNECTED';
    badge.classList.toggle('green', connected);
    badge.classList.toggle('muted', !connected);
  }
  if (messageElement) messageElement.textContent = message;
};

const setLoqConnectionState = (connected, message) => {
  const badge = getElement('loqConnectionBadge');
  const connectionMessage = getElement('loqConnectionMessage');
  const audioSource = getElement('loqAudioSource');
  if (badge) {
    badge.textContent = connected ? 'CONNECTED' : 'DISCONNECTED';
    badge.classList.toggle('green', connected);
    badge.classList.toggle('muted', !connected);
  }
  if (connectionMessage) connectionMessage.textContent = message;
  if (audioSource) {
    audioSource.textContent = connected ? 'Windows Core Audio' : 'Not connected';
    audioSource.classList.toggle('online', connected);
    audioSource.classList.toggle('standby', !connected);
  }

  if (!connected) {
    const disconnectedValues = {
      homeCompanionStatus: 'Disconnected',
      homeCompanionDetail: 'Not connected',
      homeTelemetryStatus: 'Unavailable',
      homeAudioEndpointCount: 'Not connected',
      homeActiveAudioEndpoint: 'Not connected',
      homeCpuMetric: '—',
      homeMemoryMetric: '—',
      homeBatteryMetric: '—',
      loqCpuMetric: '—',
      loqMemoryMetric: '—',
      loqBatteryMetric: '—',
      loqUptimeMetric: '—',
    };
    Object.entries(disconnectedValues).forEach(([id, value]) => {
      const element = getElement(id);
      if (element) element.textContent = value;
    });
    const homeBadge = getElement('homeLoqBadge');
    if (homeBadge) {
      homeBadge.textContent = 'DISCONNECTED';
      homeBadge.classList.remove('green');
      homeBadge.classList.add('muted');
    }
  }
}

const updateHomeAudioSummary = (devices) => {
  const count = getElement('homeAudioEndpointCount');
  if (count) count.textContent = `${devices.length} Windows endpoint${devices.length === 1 ? '' : 's'}`;
  const activeOutput = getElement('homeActiveAudioEndpoint');
  if (!activeOutput) return;
  const defaults = [...new Set(devices
    .filter((device) => device.state === 'active' && (device.is_default_multimedia || device.is_default_console))
    .map((device) => device.name))];
  activeOutput.textContent = defaults.length ? defaults.join(' / ') : 'No active default reported';
};

const renderAudioEndpoints = (devices) => {
  updateHomeAudioSummary(devices);
  const list = getElement('windowsAudioDevices');
  const hint = getElement('audioConnectionHint');
  if (!list) return;
  list.replaceChildren();

  if (!devices.length) {
    if (hint) hint.textContent = 'LOQ Link is connected, but Windows reported no playback endpoints.';
    return;
  }

  if (hint) {
    hint.textContent = `${devices.length} playback endpoint${devices.length === 1 ? '' : 's'} reported by Windows Core Audio.`;
  }

  const sortedDevices = [...devices].sort((a, b) => {
    const aDefault = a.is_default_console || a.is_default_multimedia;
    const bDefault = b.is_default_console || b.is_default_multimedia;
    return Number(bDefault) - Number(aDefault) || a.name.localeCompare(b.name);
  });

  sortedDevices.forEach((device) => {
    const card = document.createElement('article');
    card.className = 'audio-endpoint-card';

    const heading = document.createElement('div');
    heading.className = 'audio-endpoint-heading';
    const identity = document.createElement('div');
    const name = document.createElement('strong');
    name.className = 'audio-endpoint-name';
    name.textContent = device.name;
    const details = document.createElement('p');
    details.className = 'audio-endpoint-details';
    const mixFormat = device.current_shared_mix_format;
    const formatText = mixFormat
      ? `Current mix format: ${mixFormat.sample_rate_hz} Hz, ${mixFormat.channels} ch, ${mixFormat.bits_per_sample}-bit`
      : 'Current mix format unavailable';
    details.textContent = `${device.form_factor} • ${formatText}`;
    identity.append(name, details);

    const status = document.createElement('span');
    status.className = `inline-status ${device.state === 'active' ? 'green' : 'muted'}`;
    const isDefault = device.is_default_console || device.is_default_multimedia;
    status.textContent = isDefault ? 'DEFAULT OUTPUT' : device.state.toUpperCase();
    heading.append(identity, status);
    card.append(heading);

    const controls = document.createElement('div');
    controls.className = 'audio-endpoint-controls';
    const active = device.state === 'active';
    if (active && !isDefault) {
      const selectButton = document.createElement('button');
      selectButton.type = 'button';
      selectButton.className = 'control-button';
      selectButton.textContent = 'Set Windows default';
      selectButton.addEventListener('click', () => void setDefaultAudioEndpoint(device.id));
      controls.append(selectButton);
    }

    if (active && device.volume_supported) {
      const volumeLabel = document.createElement('label');
      volumeLabel.className = 'audio-endpoint-volume';
      volumeLabel.append(document.createTextNode('Volume'));
      const volume = document.createElement('input');
      volume.type = 'range';
      volume.min = '0';
      volume.max = '100';
      volume.step = '1';
      volume.value = String(device.volume_percent);
      volume.setAttribute('aria-label', `${device.name} volume`);
      volume.addEventListener('change', () => {
        void setAudioEndpointVolume(device.id, Number(volume.value));
      });
      volumeLabel.append(volume);

      const volumeValue = document.createElement('strong');
      volumeValue.textContent = `${Math.round(device.volume_percent)}%`;
      volume.addEventListener('input', () => {
        volumeValue.textContent = `${Math.round(Number(volume.value))}%`;
      });
      volumeLabel.append(volumeValue);
      controls.append(volumeLabel);

      const muteButton = document.createElement('button');
      muteButton.type = 'button';
      muteButton.className = 'control-button alt';
      muteButton.textContent = device.muted ? 'Unmute' : 'Mute';
      muteButton.addEventListener('click', () => {
        void setAudioEndpointMute(device.id, !device.muted);
      });
      controls.append(muteButton);
    }

    if (!active) {
      const unavailable = document.createElement('span');
      unavailable.className = 'source-note';
      unavailable.textContent = 'Windows reports this endpoint as unavailable; controls are disabled.';
      controls.append(unavailable);
    } else if (!device.volume_supported) {
      const unsupported = document.createElement('span');
      unsupported.className = 'source-note';
      unsupported.textContent = 'Windows does not expose endpoint volume or mute controls for this device.';
      controls.append(unsupported);
    }

    if (controls.childElementCount) card.append(controls);
    list.append(card);
  });
};

const refreshAudioEndpoints = async () => {
  const list = getElement('windowsAudioDevices');
  if (!list) return;
  if (!getCompanionToken()) {
    renderAudioEndpoints([]);
    const hint = getElement('audioConnectionHint');
    if (hint) hint.textContent = 'Connect to LOQ Link from the Connect page to view Windows-detected outputs.';
    return;
  }

  if (audioRefreshInProgress) return;
  audioRefreshInProgress = true;
  try {
    const result = await companionRequest('/audio/devices');
    renderAudioEndpoints(Array.isArray(result.devices) ? result.devices : []);
  } catch (error) {
    console.warn('Unable to load Windows audio endpoints:', error);
    const hint = getElement('audioConnectionHint');
    if (hint) hint.textContent = error.message;
    list.replaceChildren();
  } finally {
    audioRefreshInProgress = false;
  }
};

const setDefaultAudioEndpoint = async (endpointId) => {
  try {
    await companionRequest('/audio/default', {
      method: 'POST',
      body: JSON.stringify({ endpoint_id: endpointId }),
    });
    await refreshAudioEndpoints();
  } catch (error) {
    console.warn('Unable to select Windows audio endpoint:', error);
    await refreshAudioEndpoints();
    const hint = getElement('audioConnectionHint');
    if (hint) hint.textContent = error.message;
  }
};

const setAudioEndpointVolume = async (endpointId, volumePercent) => {
  try {
    await companionRequest('/audio/volume', {
      method: 'POST',
      body: JSON.stringify({ endpoint_id: endpointId, volume_percent: volumePercent }),
    });
    await refreshAudioEndpoints();
  } catch (error) {
    console.warn('Unable to change Windows endpoint volume:', error);
    await refreshAudioEndpoints();
    const hint = getElement('audioConnectionHint');
    if (hint) hint.textContent = error.message;
  }
};

const setAudioEndpointMute = async (endpointId, muted) => {
  try {
    await companionRequest('/audio/mute', {
      method: 'POST',
      body: JSON.stringify({ endpoint_id: endpointId, muted }),
    });
    await refreshAudioEndpoints();
  } catch (error) {
    console.warn('Unable to change Windows endpoint mute state:', error);
    await refreshAudioEndpoints();
    const hint = getElement('audioConnectionHint');
    if (hint) hint.textContent = error.message;
  }
};

const refreshLoqMetrics = async () => {
  if (!getElement('loqConnectionBadge') && !getElement('homeCpuMetric') && !getElement('companionConnectionBadge')) return;
  if (!getCompanionToken()) {
    setLoqConnectionState(false, 'Connect to LOQ Link to load live system and endpoint status.');
    updateCompanionConnectionUi(false, 'Not connected. Start the Windows companion and enter its HTTPS address.');
    return;
  }

  if (metricsRefreshInProgress) return;
  metricsRefreshInProgress = true;
  try {
    const metrics = await companionRequest('/metrics');
    const connectedMessage = `Connected to ${metrics.device_name || 'Windows host'}.`;
    setLoqConnectionState(true, connectedMessage);
    updateCompanionConnectionUi(true, connectedMessage);

    const cpu = metrics.cpu_percent == null ? '—' : `${Math.round(metrics.cpu_percent)}%`;
    const memory = metrics.memory_percent == null ? '—' : `${Math.round(metrics.memory_percent)}%`;
    const battery = metrics.battery_percent == null ? 'Not available' : `${Math.round(metrics.battery_percent)}%`;
    const uptimeSeconds = Number(metrics.uptime_seconds);
    const uptime = Number.isFinite(uptimeSeconds)
      ? `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`
      : '—';

    const values = {
      loqDeviceName: metrics.device_name || 'Windows host',
      loqCpuMetric: cpu,
      loqMemoryMetric: memory,
      loqBatteryMetric: battery,
      loqUptimeMetric: uptime,
      homeCompanionStatus: 'Connected',
      homeCompanionDetail: 'Authenticated session',
      homeTelemetryStatus: 'Available',
      homeCpuMetric: cpu,
      homeMemoryMetric: memory,
      homeBatteryMetric: battery,
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = getElement(id);
      if (element) element.textContent = value;
    });

    const audioCount = getElement('homeAudioEndpointCount');
    if (audioCount || getElement('homeActiveAudioEndpoint')) {
      try {
        const result = await companionRequest('/audio/devices');
        updateHomeAudioSummary(Array.isArray(result.devices) ? result.devices : []);
      } catch (error) {
        console.warn('Unable to refresh Windows audio summary:', error);
        if (audioCount) audioCount.textContent = 'Unavailable';
        const activeOutput = getElement('homeActiveAudioEndpoint');
        if (activeOutput) activeOutput.textContent = 'Unavailable';
      }
    }
    const homeBadge = getElement('homeLoqBadge');
    if (homeBadge) {
      homeBadge.textContent = 'CONNECTED';
      homeBadge.classList.remove('muted');
      homeBadge.classList.add('green');
    }
  } catch (error) {
    console.warn('Unable to refresh LOQ status:', error);
    setLoqConnectionState(false, error.message);
    updateCompanionConnectionUi(false, error.message);
    const homeStatus = getElement('homeCompanionStatus');
    if (homeStatus) homeStatus.textContent = 'Disconnected';
  } finally {
    metricsRefreshInProgress = false;
  }
};

const isAllowedCompanionUrl = (value) => {
  try {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const originOnly = url.pathname === '/' && !url.search && !url.hash;
    return originOnly
      && !url.username
      && !url.password
      && (url.protocol === 'https:' || (loopback && url.protocol === 'http:'));
  } catch (error) {
    return false;
  }
};

const attachCompanionControls = () => {
  const form = getElement('companionConnectForm');
  const urlInput = getElement('companionUrl');
  const pairingCodeInput = getElement('companionPairingCode');
  if (urlInput) {
    urlInput.value = getCompanionUrl();
    if (urlInput.value) urlInput.closest('details')?.setAttribute('open', '');
  }

  if (form && urlInput && pairingCodeInput) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const url = urlInput.value.trim().replace(/\/+$/, '');
      const localMode = Boolean(url && urlInput.closest('details')?.open);
      if (localMode && !isAllowedCompanionUrl(url)) {
        updateCompanionConnectionUi(false, 'Use an origin-only HTTPS LOQ Link URL. HTTP is allowed only for localhost testing.');
        return;
      }

      const button = getElement('pairCompanion');
      if (button) button.disabled = true;
      sessionStorage.removeItem(COMPANION_SESSION_KEY);
      updateCompanionConnectionUi(false, localMode ? 'Pairing directly with LOQ Link…' : 'Pairing through the secure cloud relay…');
      try {
        const response = localMode
          ? await fetchCompanion(`${url}/pair`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: pairingCodeInput.value }),
          })
          : await fetchCompanion('/.netlify/functions/pair-loq', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pairing_code: pairingCodeInput.value }),
          });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || `Pairing failed (${response.status}).`);

        if (localMode) {
          localStorage.setItem(COMPANION_URL_KEY, url);
          sessionStorage.setItem(COMPANION_MODE_KEY, 'local');
        } else {
          localStorage.removeItem(COMPANION_URL_KEY);
          sessionStorage.setItem(COMPANION_MODE_KEY, 'cloud');
        }
        sessionStorage.setItem(COMPANION_SESSION_KEY, result.access_token);
        const label = localMode ? result.device_name : 'LOQ Link';
        updateCompanionConnectionUi(true, `Paired with ${label}. The session expires after ${Math.floor(result.expires_in_seconds / 3600)} hours.`);
        await refreshAudioEndpoints();
        await refreshLoqMetrics();
      } catch (error) {
        console.warn('LOQ Link pairing failed:', error);
        updateCompanionConnectionUi(false, error.message || 'Unable to reach LOQ Link. Check its URL, TLS certificate, and allowed dashboard origins.');
      } finally {
        pairingCodeInput.value = '';
        if (button) button.disabled = false;
      }
    });
  }

  getElement('disconnectCompanion')?.addEventListener('click', async () => {
    if (getCompanionToken()) {
      try {
        await companionRequest('/disconnect', { method: 'POST' });
      } catch (error) {
        console.warn('LOQ Link session revocation failed:', error);
      }
    }
    sessionStorage.removeItem(COMPANION_SESSION_KEY);
    sessionStorage.removeItem(COMPANION_MODE_KEY);
    updateCompanionConnectionUi(false, 'Disconnected from LOQ Link.');
    setLoqConnectionState(false, 'Connect to LOQ Link to load live system and endpoint status.');
    await refreshAudioEndpoints();
  });

  if (form) {
    if (getCompanionToken()) {
      updateCompanionConnectionUi(true, 'An authenticated LOQ Link session is available in this tab.');
    } else {
      updateCompanionConnectionUi(false, 'Not connected. Start the Windows companion and enter its HTTPS address.');
    }
  }

  getElement('refreshAudioDevices')?.addEventListener('click', () => void refreshAudioEndpoints());
};

const getDesktopAudioSource = async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    throw new Error('Display capture not supported in this browser.');
  }

  return navigator.mediaDevices.getDisplayMedia({
    video: false,
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
};

const stopCurrentAudioStream = () => {
  if (localState.stream) {
    localState.stream.getTracks().forEach((track) => track.stop());
    localState.stream = null;
  }

  if (localState.sourceNode && localState.analyser) {
    localState.sourceNode.disconnect();
  }

  if (localState.audioContext && localState.audioContext.state === 'running') {
    localState.audioContext.suspend();
  }

  localState.analyser = null;
  localState.sourceNode = null;
  localState.frequencyData = null;
  localState.previousLevels = [];
};

const setIdleVisualiserState = (text) => {
  const playbackState = getElement('playbackState');
  const deviceState = getElement('deviceState');
  if (playbackState) playbackState.textContent = text;
  if (deviceState) deviceState.textContent = 'Idle';
};

const setAudioSourceSelection = (sourceName) => {
  document.querySelectorAll('.source-toggle, .source-option').forEach((toggle) => {
    const active = toggle.dataset.source === sourceName;
    toggle.classList.toggle('active', active);
    toggle.setAttribute('aria-pressed', String(active));
  });
};

const setHomeAudioStatus = (status) => {
  const homeStatus = getElement('homeAudioStatus');
  const visualiserStatus = getElement('homeVisualiserStatus');
  if (homeStatus) homeStatus.textContent = status;
  if (visualiserStatus) visualiserStatus.textContent = status === 'CONNECTED' ? 'ARMED' : 'IDLE';
};

const initialiseAnalyser = (stream) => {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    setIdleVisualiserState('Web Audio unavailable');
    return false;
  }

  if (!localState.audioContext) {
    localState.audioContext = new AudioContextCtor();
  }

  if (localState.audioContext.state === 'suspended') {
    localState.audioContext.resume();
  }

  const analyser = localState.audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = localState.smoothing;

  const sourceNode = localState.audioContext.createMediaStreamSource(stream);
  sourceNode.connect(analyser);

  localState.analyser = analyser;
  localState.sourceNode = sourceNode;
  localState.stream = stream;
  localState.frequencyData = new Uint8Array(analyser.frequencyBinCount);
  localState.previousLevels = Array.from({ length: localState.barCount }, () => 0);
  return true;
};

const setSource = async (sourceName) => {
  localState.currentSource = null;
  setAudioSourceSelection(null);
  stopCurrentAudioStream();

  const sourceStatus = getElement('audioSourceStatus');
  const sourceNote = getElement('audioSourceNote');
  if (sourceStatus) {
    sourceStatus.textContent = sourceName === 'browser' ? 'Requesting browser audio' : sourceName === 'microphone' ? 'Requesting microphone' : 'LOQ audio unavailable';
  }
  setHomeAudioStatus(sourceName === 'pc' ? 'IDLE' : 'REQUESTING');
  if (sourceNote) {
    sourceNote.textContent = sourceName === 'browser'
      ? 'Choose a tab, window, or screen in the browser prompt and explicitly enable audio sharing.'
      : sourceName === 'microphone'
        ? 'Microphone input is active once permission is granted.'
        : 'LOQ audio streaming is not available. Windows output controls remain available on the Audio page.';
  }

  if (sourceName === 'pc') {
    setIdleVisualiserState('PC audio disconnected');
    if (sourceStatus) sourceStatus.textContent = 'LOQ audio unavailable';
    setHomeAudioStatus('IDLE');
    const deviceState = getElement('deviceState');
    if (deviceState) deviceState.textContent = 'LOQ output';
    return;
  }

  if (sourceName === 'microphone') {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIdleVisualiserState('Microphone unavailable');
      if (sourceStatus) sourceStatus.textContent = 'Microphone unavailable';
      setHomeAudioStatus('IDLE');
      const deviceState = getElement('deviceState');
      if (deviceState) deviceState.textContent = 'Not supported';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!initialiseAnalyser(stream)) {
        stream.getTracks().forEach((track) => track.stop());
        if (sourceStatus) sourceStatus.textContent = 'Web Audio unavailable';
        setHomeAudioStatus('IDLE');
        return;
      }
      localState.currentSource = sourceName;
      setAudioSourceSelection(sourceName);
      if (sourceStatus) sourceStatus.textContent = 'Microphone';
      setHomeAudioStatus('CONNECTED');
      const playbackState = getElement('playbackState');
      const deviceState = getElement('deviceState');
      if (playbackState) playbackState.textContent = 'Listening';
      if (deviceState) deviceState.textContent = 'Microphone input';
    } catch (error) {
      console.warn('Microphone permission denied:', error);
      const playbackState = getElement('playbackState');
      const deviceState = getElement('deviceState');
      if (playbackState) playbackState.textContent = 'Permission denied';
      if (deviceState) deviceState.textContent = 'Microphone';
      if (sourceStatus) sourceStatus.textContent = 'Microphone permission denied';
      if (sourceNote) sourceNote.textContent = 'Microphone permission was denied. Allow access in browser settings and try again.';
      setHomeAudioStatus('IDLE');
    }
    return;
  }

  if (sourceName === 'browser') {
    try {
      const stream = await getDesktopAudioSource();
      if (!initialiseAnalyser(stream)) {
        stream.getTracks().forEach((track) => track.stop());
        if (sourceStatus) sourceStatus.textContent = 'Web Audio unavailable';
        setHomeAudioStatus('IDLE');
        return;
      }
      localState.currentSource = sourceName;
      setAudioSourceSelection(sourceName);
      if (sourceStatus) sourceStatus.textContent = 'Browser audio';
      setHomeAudioStatus('CONNECTED');
      const playbackState = getElement('playbackState');
      const deviceState = getElement('deviceState');
      if (playbackState) playbackState.textContent = 'Listening';
      if (deviceState) deviceState.textContent = 'Browser audio';
      stream.getVideoTracks().forEach((track) => track.stop());
      stream.getAudioTracks()[0]?.addEventListener('ended', () => {
        localState.currentSource = null;
        setAudioSourceSelection(null);
        if (sourceStatus) sourceStatus.textContent = 'No source selected';
        setHomeAudioStatus('IDLE');
        setIdleVisualiserState('Audio ended');
      });
    } catch (error) {
      console.warn('Browser audio capture unavailable:', error);
      setIdleVisualiserState('Browser audio unavailable');
      if (sourceStatus) sourceStatus.textContent = 'Browser audio unavailable';
      if (sourceNote) sourceNote.textContent = 'Browser audio sharing was cancelled or is not supported by this browser.';
      setHomeAudioStatus('IDLE');
      const deviceState = getElement('deviceState');
      if (deviceState) deviceState.textContent = 'Not available';
    }
  }
};

const updateVisualiserControls = () => {
  const barCountInput = getElement('barCountControl');
  if (!barCountInput) return;

  barCountInput.value = String(localState.barCount);
  const sensitivityInput = getElement('sensitivityControl');
  const smoothingInput = getElement('smoothingControl');
  const intensityInput = getElement('intensityControl');
  const presetInput = getElement('presetControl');
  if (sensitivityInput) sensitivityInput.value = String(localState.sensitivity);
  if (smoothingInput) smoothingInput.value = String(localState.smoothing);
  if (intensityInput) intensityInput.value = String(localState.intensity);
  if (presetInput) presetInput.value = localState.colorPreset;

  const barCountValue = getElement('barCountValue');
  const sensitivityValue = getElement('sensitivityValue');
  const smoothingValue = getElement('smoothingValue');
  const intensityValue = getElement('intensityValue');

  if (barCountValue) barCountValue.textContent = String(localState.barCount);
  if (sensitivityValue) sensitivityValue.textContent = String(localState.sensitivity.toFixed(1));
  if (smoothingValue) smoothingValue.textContent = String(localState.smoothing.toFixed(2));
  if (intensityValue) intensityValue.textContent = String(localState.intensity.toFixed(1));
};

const applyVisualiserSettings = () => {
  if (localState.analyser) {
    localState.analyser.smoothingTimeConstant = localState.smoothing;
  }

  if (localState.lowPerformanceMode) {
    localState.barCount = Math.min(localState.barCount, 24);
  }

  localState.previousLevels = Array.from({ length: localState.barCount }, () => 0);
  updateVisualiserControls();
};

const renderVisualiser = () => {
  const ctx = getVisualiserContext();
  if (!ctx || !visualiserCanvas) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (visualiserCanvas.width !== Math.floor(visualiserCanvas.clientWidth * dpr)) {
    visualiserCanvas.width = Math.floor(visualiserCanvas.clientWidth * dpr);
    visualiserCanvas.height = Math.floor(visualiserCanvas.clientHeight * dpr);
  }

  const width = visualiserCanvas.width;
  const height = visualiserCanvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(10, 12, 16, 0.94)';
  ctx.fillRect(0, 0, width, height);

  const activeData = localState.analyser && localState.frequencyData ? localState.frequencyData : null;

  if (activeData) {
    localState.analyser.getByteFrequencyData(localState.frequencyData);
    const segmentSize = Math.max(1, Math.floor(activeData.length / localState.barCount));
    const maxBarHeight = height * 0.88 * 0.82;

    for (let i = 0; i < localState.barCount; i += 1) {
      const start = i * segmentSize;
      const end = start + segmentSize;
      let sum = 0;
      for (let j = start; j < end; j += 1) {
        sum += activeData[j] || 0;
      }

      const normalized = sum / segmentSize / 255;
      const bassBoost = i < Math.ceil(localState.barCount * 0.22) ? 1.2 : 1;
      const effective = Math.min(1, normalized * localState.sensitivity * bassBoost * localState.intensity);
      const target = effective * maxBarHeight;
      const previous = localState.previousLevels[i] || 0;
      const smoothed = previous + (target - previous) * (1 - localState.smoothing);
      localState.previousLevels[i] = smoothed;

      const x = (i / localState.barCount) * width;
      const barWidth = (width / localState.barCount) * 0.72;
      const barHeight = Math.max(0, smoothed);
      const y = height - barHeight;
      const primaryColor = localState.colorPreset === 'magi' ? '#62d7aa' : '#ff8a3d';
      const accentColor = localState.colorPreset === 'magi' ? '#ffba79' : '#cbb4ff';

      visualiserCtx.fillStyle = primaryColor;
      visualiserCtx.fillRect(x + 4, y, barWidth, barHeight);

      if (barHeight > 10) {
        visualiserCtx.fillStyle = accentColor;
        visualiserCtx.fillRect(x + 4, y, barWidth * 0.55, Math.max(6, barHeight * 0.18));
      }
    }

    const totalEnergy = localState.previousLevels.reduce((sum, value) => sum + value, 0) / localState.previousLevels.length;
    if (totalEnergy < 0.04) {
      setIdleVisualiserState('Idle');
      localState.previousLevels = localState.previousLevels.map((value) => value * 0.82);
    } else {
      const playbackState = getElement('playbackState');
      if (playbackState) playbackState.textContent = 'Listening';
    }
  } else {
    for (let i = 0; i < localState.barCount; i += 1) {
      const previous = localState.previousLevels[i] || 0;
      const target = previous * 0.78;
      localState.previousLevels[i] = target;
      const x = (i / localState.barCount) * width;
      const barWidth = (width / localState.barCount) * 0.72;
      const barHeight = Math.max(0, target * height * 0.8);
      visualiserCtx.fillStyle = '#1f2d2f';
      visualiserCtx.fillRect(x + 4, height - barHeight, barWidth, barHeight);
    }
  }

  if (document.visibilityState === 'hidden') {
    cancelAnimationFrame(localState.animationFrame);
    return;
  }

  localState.animationFrame = requestAnimationFrame(renderVisualiser);
};

const attachVisualiserSettings = () => {
  const barCountInput = getElement('barCountControl');
  if (!barCountInput) return;

  barCountInput.addEventListener('input', (event) => {
    localState.barCount = Number(event.target.value);
    updateVisualiserControls();
    applyVisualiserSettings();
  });

  getElement('sensitivityControl')?.addEventListener('input', (event) => {
    localState.sensitivity = Number(event.target.value);
    updateVisualiserControls();
  });

  getElement('smoothingControl')?.addEventListener('input', (event) => {
    localState.smoothing = Number(event.target.value);
    updateVisualiserControls();
    if (localState.analyser) {
      localState.analyser.smoothingTimeConstant = localState.smoothing;
    }
  });

  getElement('intensityControl')?.addEventListener('input', (event) => {
    localState.intensity = Number(event.target.value);
    updateVisualiserControls();
  });

  getElement('presetControl')?.addEventListener('change', (event) => {
    localState.colorPreset = event.target.value;
  });

  getElement('lowPowerToggle')?.addEventListener('change', (event) => {
    localState.lowPerformanceMode = !!event.target.checked;
    applyVisualiserSettings();
  });
};

const attachSourceToggles = () => {
  const sourceButtons = document.querySelectorAll('.source-toggle, .source-option');
  sourceButtons.forEach((button) => {
    button.addEventListener('click', () => void setSource(button.dataset.source));
  });
};

const attachSharedControls = () => {
  getElement('toggleFullscreen')?.addEventListener('click', toggleFullscreen);
  getElement('toggleScreensaver')?.addEventListener('click', toggleScreensaver);

  getElement('timezoneSelector')?.addEventListener('change', (event) => {
    localState.timezone = event.target.value;
    persistSettings();
    applyClockState();
  });

  getElement('offlineCacheToggle')?.addEventListener('change', persistSettings);
  getElement('compactModeToggle')?.addEventListener('change', persistSettings);
};

const bootSequence = () => {
  const boot = getElement('bootSequence');
  if (!boot) return;
  window.setTimeout(() => boot.classList.add('hidden'), 2100);
};

const initialise = () => {
  loadSettings();
  bootSequence();
  applyClockState();
  attachSharedControls();
  attachCompanionControls();
  void loadRaceCalendars();
  initialiseRaceFeed();
  initialiseWeather();
  getElement('raceSeriesFilter')?.addEventListener('change', renderRaceCalendars);

  if (document.querySelector('.source-toggle, .source-option')) {
    attachSourceToggles();
    document.querySelectorAll('.source-toggle, .source-option').forEach((toggle) => {
      toggle.classList.remove('active');
      toggle.setAttribute('aria-pressed', 'false');
    });
    const sourceStatus = getElement('audioSourceStatus');
    const sourceNote = getElement('audioSourceNote');
    if (sourceStatus) sourceStatus.textContent = 'No source selected';
    if (sourceNote) {
      sourceNote.textContent = 'Select an audio source to begin. No microphone or screen capture starts automatically.';
    }
  }

  if (getElement('windowsAudioDevices')) {
    void refreshAudioEndpoints();
  }
  if (getElement('loqConnectionBadge') || getElement('homeCpuMetric') || getElement('companionConnectionBadge')) {
    void refreshLoqMetrics();
  }

  if (getElement('windowsAudioDevices') || getElement('loqConnectionBadge') || getElement('homeCpuMetric') || getElement('companionConnectionBadge')) {
    window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void refreshAudioEndpoints();
      void refreshLoqMetrics();
    }, 5000);
  }

  visualiserCanvas = getElement('visualiserCanvas');
  if (visualiserCanvas) {
    updateVisualiserControls();
    attachVisualiserSettings();
    renderVisualiser();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (localState.animationFrame) {
        cancelAnimationFrame(localState.animationFrame);
      }
      if (localState.audioContext && localState.audioContext.state === 'running') {
        localState.audioContext.suspend();
      }
    } else if (localState.audioContext && localState.audioContext.state === 'suspended') {
      localState.audioContext.resume();
      if (visualiserCanvas) {
        localState.animationFrame = requestAnimationFrame(renderVisualiser);
      }
    }
    if (!document.hidden) {
      void refreshWeather();
      void loadRaceFeed();
    }
  });

  setInterval(applyClockState, 1000);
};

initialise();
