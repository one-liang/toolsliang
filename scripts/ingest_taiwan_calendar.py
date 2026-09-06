#!/usr/bin/env python3
"""Bakes the Taiwan calendar year datasets from their primary sources.

A maintainer runs this; the site never does. Everything the tool shows is read
here, validated against the contract in
docs/research/004-taiwan-calendar-sources-and-data-contract.md, and written to
app/features/tools/taiwan-calendar/data/, so the browser makes zero requests to
any source and no year a visitor looks at ever leaves their device (ADR-0001).

Nothing is written unless every year passes: the checks below are the ingestion
errors of section 5.5, in the order that section fixes, and a failure names the
error key so a half-ingested year can never reach the site.

    python3 scripts/ingest_taiwan_calendar.py [--cache DIR] [--retrieved-at DATE]
"""

from __future__ import annotations

import argparse
import calendar
import csv
import datetime as dt
import hashlib
import io
import json
import re
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REFERENCE = ROOT / 'app/features/tools/taiwan-calendar/domain/reference.ts'
SOURCES = ROOT / 'app/features/tools/taiwan-calendar/domain/sources.ts'
OUTPUT = ROOT / 'app/features/tools/taiwan-calendar/data'

DGPA_DATASET = 'https://data.gov.tw/api/v2/rest/dataset/14718'
CWA_PDF = 'https://www.cwa.gov.tw/Data/astronomy/{year}cal.pdf'
HKO_TABLE = 'https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T{year}c.txt'

ROC_EPOCH_OFFSET = 1911
USER_AGENT = 'toolsliang-taiwan-calendar-ingestion/1.0'

# The 24 terms in the order the CWA calendar table tabulates them; two per month,
# which is what lets the term table be read without its merged month cells.
SOLAR_TERMS = [
    '小寒', '大寒', '立春', '雨水', '驚蟄', '春分',
    '清明', '穀雨', '立夏', '小滿', '芒種', '夏至',
    '小暑', '大暑', '立秋', '處暑', '白露', '秋分',
    '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
]
HEAVENLY_STEMS = '甲乙丙丁戊己庚辛壬癸'
EARTHLY_BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
ZODIAC = '鼠牛虎兔龍蛇馬羊猴雞狗豬'

DGPA_WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
DGPA_COLUMNS = ['西元日期', '星期', '是否放假', '備註']
DGPA_FLAGS = {'0': 'workday', '2': 'holiday'}

HKO_MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月',
              '七月', '八月', '九月', '十月', '十一月', '十二月']
HKO_DAYS = (['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十']
            + ['十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十']
            + ['廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'])


class IngestionError(Exception):
    """One of the section 5.5 error keys, with the year and the detail behind it."""

    def __init__(self, code: str, detail: str) -> None:
        super().__init__(f'{code}: {detail}')
        self.code = code


# --------------------------------------------------------------------------- #
# The contract the modules already publish, read back rather than retyped.
# --------------------------------------------------------------------------- #

def read_note_labels() -> dict[str, tuple[str, list[str]]]:
    source = REFERENCE.read_text()
    block = re.search(r'export const taiwanCalendarNoteLabels = \[(.*?)\] as const', source, re.S)
    if not block:
        raise SystemExit('reference.ts no longer exports taiwanCalendarNoteLabels')

    labels: dict[str, tuple[str, list[str]]] = {}
    pattern = r"\{ label: '([^']+)', kind: '([^']+)', holidays: \[([^\]]*)\] \}"
    for label, kind, holidays in re.findall(pattern, re.sub(r'\s+', ' ', block.group(1))):
        labels[label] = (kind, re.findall(r"'([^']+)'", holidays))
    if not labels:
        raise SystemExit('reference.ts note label whitelist could not be read')
    return labels


def read_coverage() -> dict[str, tuple[int, int]]:
    source = SOURCES.read_text()
    coverage: dict[str, tuple[int, int]] = {}
    for block in re.finditer(r"id: '([a-z-]+)',(.*?)coverage: \{ firstYear: (\d+), lastYear: (\d+) \}", source, re.S):
        coverage[block.group(1)] = (int(block.group(3)), int(block.group(4)))
    if len(coverage) != 3:
        raise SystemExit('sources.ts no longer declares three dataset coverages')
    return coverage


# --------------------------------------------------------------------------- #
# Fetching. Every response is cached on disk so a re-run does not re-download,
# and so the checksum written into a dataset is the checksum of what was read.
# --------------------------------------------------------------------------- #

@dataclass
class Fetched:
    body: bytes
    last_modified: str | None

    @property
    def checksum(self) -> str:
        return f'sha256-{hashlib.sha256(self.body).hexdigest()}'


def fetch(url: str, cache: Path, key: str) -> Fetched:
    body_path, meta_path = cache / key, cache / f'{key}.meta.json'
    if body_path.exists() and meta_path.exists():
        return Fetched(body_path.read_bytes(), json.loads(meta_path.read_text())['lastModified'])

    # Some download links carry the filename unencoded, in Chinese.
    encoded = urllib.parse.quote(url, safe=":/?&=%+~#!$'()*,;@[]")
    request = urllib.request.Request(encoded, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:
        body = response.read()
        header = response.headers.get('Last-Modified')

    last_modified = parsedate_to_datetime(header).date().isoformat() if header else None
    cache.mkdir(parents=True, exist_ok=True)
    body_path.write_bytes(body)
    meta_path.write_text(json.dumps({'url': url, 'lastModified': last_modified}, indent=2))
    return Fetched(body, last_modified)


def decode(body: bytes, year: int) -> str:
    """UTF-8 then Big5, because one edition of the same dataset is each."""
    for encoding in ('utf-8-sig', 'big5'):
        try:
            return body.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise IngestionError('unsupported-encoding', f'{year} decodes as neither UTF-8 nor Big5')


# --------------------------------------------------------------------------- #
# The official layer: the DGPA office calendar.
# --------------------------------------------------------------------------- #

@dataclass
class OfficialResource:
    edition: str
    url: str
    revised: bool


def resolve_official_resources(cache: Path) -> tuple[dict[int, OfficialResource], str]:
    dataset = json.loads(fetch(DGPA_DATASET, cache, 'dgpa-dataset.json').body)['result']
    editions: dict[int, list[dict]] = {}
    for resource in dataset['distribution']:
        description = resource['resourceDescription']
        # The Google calendar export of the same year is one event per holiday,
        # not one row per day, so it cannot answer "what kind of day is this".
        if 'Google' in description or resource['resourceFormat'] != 'CSV':
            continue
        roc_year = re.match(r'^(\d{3})年', description)
        if roc_year:
            editions.setdefault(int(roc_year.group(1)), []).append(resource)

    resources: dict[int, OfficialResource] = {}
    for roc_year, found in editions.items():
        # A reissue is appended after the edition it replaces, which is also the
        # only signal the platform gives that a published year was revised.
        latest = found[-1]
        resources[roc_year + ROC_EPOCH_OFFSET] = OfficialResource(
            edition=latest['resourceDescription'],
            url=latest['resourceDownloadUrl'],
            revised=len(found) > 1,
        )
    return resources, dataset['modifiedDate'][:10]


def parse_official_year(text: str, year: int, note_labels: dict[str, tuple[str, list[str]]]) -> list[dict]:
    rows = list(csv.reader(io.StringIO(text)))
    header = [cell.strip() for cell in rows[0]] if rows else []
    for column in DGPA_COLUMNS:
        if column not in header:
            raise IngestionError('missing-column', f'{year} has no {column} column')

    index = {column: header.index(column) for column in DGPA_COLUMNS}
    seen: dict[str, dict] = {}
    for row in rows[1:]:
        if not any(cell.strip() for cell in row):
            continue
        raw_date = row[index['西元日期']].strip()
        if not re.fullmatch(r'\d{8}', raw_date):
            raise IngestionError('incomplete-year', f'{year} has an unreadable date {raw_date!r}')

        date = f'{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}'
        if date in seen:
            raise IngestionError('incomplete-year', f'{year} repeats {date}')

        flag = row[index['是否放假']].strip()
        if flag not in DGPA_FLAGS:
            raise IngestionError('unknown-flag', f'{date} carries 是否放假={flag!r}')

        weekday = dt.date.fromisoformat(date).isoweekday()
        if row[index['星期']].strip() != DGPA_WEEKDAYS[weekday - 1]:
            raise IngestionError('weekday-mismatch', f'{date} is not {row[index["星期"]].strip()}')

        label = row[index['備註']].strip()
        if label and label not in note_labels:
            raise IngestionError('unknown-label', f'{date} carries an unreviewed 備註 {label!r}')

        kind, holidays = note_labels[label] if label else (
            'weekend' if weekday >= 6 else 'workday', [],
        )
        if not label and DGPA_FLAGS[flag] != ('holiday' if weekday >= 6 else 'workday'):
            raise IngestionError('flag-kind-mismatch', f'{date} has no 備註 but 是否放假={flag}')
        if label and DGPA_FLAGS[flag] != ('workday' if kind == 'makeup-workday' else 'holiday'):
            raise IngestionError('flag-kind-mismatch', f'{date} is {kind} but 是否放假={flag}')
        if kind == 'makeup-workday' and weekday != 6:
            raise IngestionError('flag-kind-mismatch', f'{date} is a makeup workday on weekday {weekday}')
        if kind in ('substitute-holiday', 'bridge-holiday') and weekday >= 6:
            raise IngestionError('flag-kind-mismatch', f'{date} is {kind} on weekday {weekday}')

        seen[date] = {'date': date, 'kind': kind, 'holidays': holidays, 'label': label}

    expected = 366 if calendar.isleap(year) else 365
    if len(seen) != expected or min(seen) != f'{year}-01-01' or max(seen) != f'{year}-12-31':
        raise IngestionError('incomplete-year', f'{year} has {len(seen)} rows, expected {expected}')

    # Only the annotated days are kept: an ordinary day is a weekday question,
    # and the checks above have just proved the source agrees with the weekday.
    return [day for date, day in sorted(seen.items()) if day['label']]


# --------------------------------------------------------------------------- #
# The lunar and solar-term layers: the CWA calendar table.
# --------------------------------------------------------------------------- #

def pdf_lines(page) -> list[dict]:
    from pdfminer.layout import LTTextContainer, LTTextLine

    lines = []
    for element in page:
        if not isinstance(element, LTTextContainer):
            continue
        for line in element:
            if isinstance(line, LTTextLine) and line.get_text().strip():
                lines.append({
                    'y': line.y1, 'x0': line.x0, 'x1': line.x1,
                    'cx': (line.x0 + line.x1) / 2, 'text': line.get_text().strip(),
                })
    return lines


def cluster(values, tolerance: float) -> list[list[float]]:
    bands: list[list[float]] = []
    for value in sorted(values, reverse=True):
        if not bands or bands[-1][-1] - value > tolerance:
            bands.append([])
        bands[-1].append(value)
    return bands


def reading_order(lines: list[dict]) -> list[dict]:
    """One row of the grid can arrive as several text lines at the same height,
    so rows are rebuilt by y and then read left to right."""
    rows: list[list[dict]] = []
    for line in sorted(lines, key=lambda line: -line['y']):
        if not rows or rows[-1][0]['y'] - line['y'] > 5:
            rows.append([])
        rows[-1].append(line)
    return [line for row in rows for line in sorted(row, key=lambda line: line['x0'])]


LUNAR_CELL = re.compile(r'閏\s*\d{1,2}/\d{1,2}|\d{1,2}/\d{1,2}|' + '|'.join(SOLAR_TERMS))
DAY_CELL = re.compile(r'[\d\s]+')
WEEKDAY_HEADER = '日一二三四五六'


def parse_month_grid(page, year: int) -> tuple[dict[str, tuple[int, bool, int] | None], dict[str, str]]:
    """The twelve month tables on page one: a lunar month/day per day, except on
    a solar-term day, where the source prints the term instead."""
    lines = pdf_lines(page)
    headers = [line for line in lines if re.sub(r'\s', '', line['text']) == WEEKDAY_HEADER]
    if len(headers) != 12:
        raise IngestionError('missing-column', f'{year} calendar table has {len(headers)} weekday headers')

    header_bands = cluster([line['y'] for line in headers], 20)
    label_bands = cluster({line['y'] for line in lines if line['text'] == '月'}, 20)
    if [len(band) for band in header_bands] != [4, 4, 4] or len(label_bands) != 3:
        raise IngestionError('missing-column', f'{year} calendar table is not a 3 × 4 month grid')

    lunar: dict[str, tuple[int, bool, int] | None] = {}
    terms: dict[str, str] = {}
    for band_index, band in enumerate(header_bands):
        row = sorted((line for line in headers if line['y'] in band), key=lambda line: line['x0'])
        top = min(band) - 2
        # A six-week month runs below the next band's heading, so the band ends
        # at that heading rather than at a fixed offset from the table above it.
        bottom = min(label_bands[band_index + 1]) + 2 if band_index + 1 < 3 else -1
        for column_index, header in enumerate(row):
            month = band_index * 4 + column_index + 1
            low, high = header['x0'] - 8, header['x1'] + 8
            cells = [line for line in lines if low <= line['cx'] <= high and bottom < line['y'] < top]

            days: list[int] = []
            annotations: list[str] = []
            for line in reading_order(cells):
                found = LUNAR_CELL.findall(line['text'])
                if found:
                    annotations.extend(found)
                elif DAY_CELL.fullmatch(line['text']):
                    days.extend(int(number) for number in re.findall(r'\d{1,2}', line['text']))

            length = calendar.monthrange(year, month)[1]
            if days != list(range(1, length + 1)):
                raise IngestionError('incomplete-year', f'{year}-{month:02d} reads as days {days}')
            if len(annotations) != length:
                raise IngestionError('incomplete-year', f'{year}-{month:02d} has {len(annotations)} of {length} cells')

            for day, cell in zip(range(1, length + 1), annotations):
                date = f'{year}-{month:02d}-{day:02d}'
                if cell in SOLAR_TERMS:
                    if cell in terms:
                        raise IngestionError('incomplete-year', f'{year} prints {cell} twice')
                    terms[cell] = date
                    lunar[date] = None
                    continue
                parsed = re.fullmatch(r'(閏\s*)?(\d{1,2})/(\d{1,2})', cell)
                if not parsed:
                    raise IngestionError('unknown-label', f'{date} carries an unreadable lunar cell {cell!r}')
                lunar[date] = (int(parsed.group(2)), bool(parsed.group(1)), int(parsed.group(3)))

    if len(terms) != 24:
        raise IngestionError('incomplete-year', f'{year} prints {len(terms)} of 24 solar terms')
    return lunar, terms


def parse_term_times(page, year: int) -> dict[str, str]:
    """Page two tabulates each term's day, hour and minute in Taiwan time. The
    month is not read: two terms per month, in order, is what a term is."""
    lines = pdf_lines(page)
    numbers = [line for line in lines if re.fullmatch(r'\d{1,2}', line['text'])]
    names = [line for line in lines if re.sub(r'\s', '', line['text']) in SOLAR_TERMS]

    times: dict[str, str] = {}
    for name in sorted(names, key=lambda line: (line['x0'], -line['y'])):
        term = re.sub(r'\s', '', name['text'])
        if term in times:
            continue  # The next year's first terms repeat at the foot of the table.
        row = sorted(
            (line for line in numbers
             if abs(line['y'] - name['y']) < 4 and line['x0'] > name['x1'] and line['x0'] - name['x1'] < 160),
            key=lambda line: line['x0'],
        )
        if len(row) != 3:
            raise IngestionError('missing-column', f'{year} {term} has {len(row)} of 3 time cells')
        day, hour, minute = (int(cell['text']) for cell in row)
        times[term] = f'{day:02d} {hour:02d}:{minute:02d}'

    missing = [term for term in SOLAR_TERMS if term not in times]
    if missing:
        raise IngestionError('missing-column', f'{year} term table omits {missing}')
    return times


def parse_astronomical_year(body: bytes, year: int) -> tuple[list[dict], str, list[dict], str]:
    from pdfminer.high_level import extract_pages

    # Some editions append moon-phase and eclipse pages, so the two pages the
    # calendar needs are found by what they carry, not by their position.
    pages = list(extract_pages(io.BytesIO(body)))
    grids = [page for page in pages
             if sum(re.sub(r'\s', '', line['text']) == WEEKDAY_HEADER for line in pdf_lines(page)) == 12]
    tables = [page for page in pages
              if len({re.sub(r'\s', '', line['text']) for line in pdf_lines(page)} & set(SOLAR_TERMS)) == 24]
    if not grids or not tables:
        raise IngestionError('missing-column',
                             f'{year} calendar table has {len(grids)} month grids and {len(tables)} term tables')
    # An edition can bind the same two pages twice; two pages that differ would
    # mean the file holds something other than this one year.
    for pages_of_a_kind in (grids, tables):
        fingerprints = {''.join(sorted(line['text'] for line in pdf_lines(page))) for page in pages_of_a_kind}
        if len(fingerprints) != 1:
            raise IngestionError('incomplete-year', f'{year} calendar table repeats a page with different content')

    lunar, term_dates = parse_month_grid(grids[0], year)
    term_times = parse_term_times(tables[0], year)

    heading = ' '.join(line['text'] for line in pdf_lines(grids[0]) if line['y'] > 700)
    edition = re.search(r'中華民國\s*\d+\s*年日曆資料表', heading)
    sexagenary = re.search(r'農曆歲次([一-鿿]{2})年', heading)
    if not edition or not sexagenary:
        raise IngestionError('missing-column', f'{year} calendar table has no readable heading')

    solar_terms = []
    for term in SOLAR_TERMS:
        day, time = term_times[term].split(' ')
        date = term_dates[term]
        if int(date[8:]) != int(day):
            raise IngestionError('cross-layer-conflict', f'{year} {term} is {date} in the grid and day {day} in the table')
        solar_terms.append({'name': term, 'date': date, 'time': time})

    return fill_lunar_gaps(lunar, year), edition.group(0), solar_terms, sexagenary.group(1)


def fill_lunar_gaps(lunar: dict[str, tuple[int, bool, int] | None], year: int) -> list[dict]:
    """A solar-term day prints the term in place of its lunar date, so the day is
    read back from its neighbours — never guessed: it has to land inside a run
    the source itself printed on both sides."""
    dates = sorted(lunar)
    filled: dict[str, tuple[int, bool, int]] = {}
    for index, date in enumerate(dates):
        value = lunar[date]
        if value is not None:
            filled[date] = value
            continue
        before = filled.get(dates[index - 1]) if index else None
        after = lunar[dates[index + 1]] if index + 1 < len(dates) else None

        if after is not None and after[2] > 1:
            # Mid-month: the day after states the month, so the gap is its eve.
            reconstructed = (after[0], after[1], after[2] - 1)
            same_month = before is not None and before[:2] == after[:2]
            if same_month and before[2] != after[2] - 2:
                raise IngestionError('incomplete-year', f'{date} sits between {before} and {after}')
            # A month change across the gap only works out if the gap is its first day.
            if before is not None and not same_month and after[2] != 2:
                raise IngestionError('incomplete-year', f'{date} sits between {before} and {after}')
        elif before is not None:
            # A month starts the next day, so the gap closes the month before it.
            reconstructed = (before[0], before[1], before[2] + 1)
        else:
            raise IngestionError('incomplete-year', f'{date} has no lunar date and no run to read it from')
        filled[date] = reconstructed

    months: list[dict] = []
    for date in dates:
        month, leap, day = filled[date]
        if not months or (month, leap) != (months[-1]['month'], months[-1]['leapMonth']):
            months.append({'start': date, 'month': month, 'leapMonth': leap, 'startDay': day})
            continue
        expected = months[-1]['startDay'] + (dt.date.fromisoformat(date) - dt.date.fromisoformat(months[-1]['start'])).days
        if day != expected:
            raise IngestionError('incomplete-year', f'{date} is lunar day {day}, expected {expected}')
    return months


# --------------------------------------------------------------------------- #
# The second opinion: the Hong Kong Observatory conversion table.
# --------------------------------------------------------------------------- #

def cross_check_year(text: str, year: int, months: list[dict], solar_terms: list[dict]) -> int:
    """Same time zone, independent authority. The month starts, the day numbers
    and the solar-term days are compared — everything the table states about a
    date. The terms' times are not: the two authorities round the same instant,
    and one 2026 term differs by a minute without moving the day."""
    term_dates = {term['name']: term['date'] for term in solar_terms}
    checked = 0
    for line in text.splitlines():
        row = re.match(r'^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\S+)(?:\s+\S+\s+(\S+))?', line)
        if not row or int(row.group(1)) != year:
            continue

        date = f'{year}-{int(row.group(2)):02d}-{int(row.group(3)):02d}'
        term = row.group(5)
        if term in SOLAR_TERMS and term_dates[term] != date:
            raise IngestionError('cross-layer-conflict', f'{term} is {term_dates[term]} here and {date} there')

        cell, ours = row.group(4), lunar_on(date, months)
        if cell in HKO_DAYS:
            if ours['day'] != HKO_DAYS.index(cell) + 1:
                raise IngestionError('cross-layer-conflict', f'{date} is lunar day {ours["day"]} here and {cell} there')
        else:
            leap = cell.startswith('閏')
            name = cell[1:] if leap else cell
            if name not in HKO_MONTHS:
                raise IngestionError('cross-layer-conflict', f'{date} carries an unreadable second opinion {cell!r}')
            if (ours['month'], ours['leapMonth'], ours['day']) != (HKO_MONTHS.index(name) + 1, leap, 1):
                raise IngestionError('cross-layer-conflict', f'{date} starts {cell} there but not here')
        checked += 1

    expected = 366 if calendar.isleap(year) else 365
    if checked != expected:
        raise IngestionError('cross-layer-conflict', f'{year} was cross-checked on {checked} of {expected} days')
    return checked


def lunar_on(date: str, months: list[dict]) -> dict:
    for month in reversed(months):
        if month['start'] <= date:
            offset = (dt.date.fromisoformat(date) - dt.date.fromisoformat(month['start'])).days
            return {'month': month['month'], 'leapMonth': month['leapMonth'], 'day': month['startDay'] + offset}
    raise IngestionError('incomplete-year', f'{date} is before the first lunar month of its year')


# --------------------------------------------------------------------------- #
# Assembly and the cross-layer checks of section 5.4.
# --------------------------------------------------------------------------- #

def sexagenary_year(year: int) -> tuple[str, str]:
    index = (year - 4) % 60
    return HEAVENLY_STEMS[index % 10] + EARTHLY_BRANCHES[index % 12], ZODIAC[index % 12]


@dataclass
class OfficialYear:
    days: list[dict]
    edition: str
    published_at: str
    checksum: str
    revised: bool


@dataclass
class AstronomicalYear:
    months: list[dict]
    edition: str
    solar_terms: list[dict]
    sexagenary: str
    published_at: str | None
    checksum: str


def build_year(year: int, official: OfficialYear, astronomical: AstronomicalYear, retrieved_at: str) -> dict:
    months, solar_terms = astronomical.months, astronomical.solar_terms
    official_days = official.days

    starts = [month for month in months if month['month'] == 1 and not month['leapMonth'] and month['startDay'] == 1]
    if len(starts) != 1:
        raise IngestionError('incomplete-year', f'{year} has {len(starts)} lunar new years')
    lunar_new_year = starts[0]['start']

    stem_branch, _ = sexagenary_year(year)
    if stem_branch != astronomical.sexagenary:
        raise IngestionError('cross-layer-conflict', f'{year} is 歲次{stem_branch} here and 歲次{astronomical.sexagenary} there')

    tomb_sweeping = [day for day in official_days if 'tomb-sweeping-day' in day['holidays']]
    qingming = next(term['date'] for term in solar_terms if term['name'] == '清明')
    for day in tomb_sweeping:
        if day['date'] != qingming:
            raise IngestionError('cross-layer-conflict', f'{day["date"]} is 民族掃墓節 but 清明 is {qingming}')

    for day in official_days:
        lunar = lunar_on(day['date'], months)
        if 'spring-festival' in day['holidays'] and not (lunar['month'] == 1 and not lunar['leapMonth'] and lunar['day'] <= 3):
            raise IngestionError('cross-layer-conflict', f'{day["date"]} is 春節 on lunar {lunar["month"]}/{lunar["day"]}')
        if 'lunar-new-years-eve' in day['holidays']:
            eve = (dt.date.fromisoformat(lunar_new_year) - dt.timedelta(days=1)).isoformat()
            if day['date'] != eve or lunar['day'] not in (29, 30):
                raise IngestionError('cross-layer-conflict', f'{day["date"]} is 農曆除夕 but 正月初一 is {lunar_new_year}')
        for holiday in day['holidays']:
            if day['kind'] != 'national-holiday':
                raise IngestionError('flag-kind-mismatch', f'{day["date"]} is {day["kind"]} yet names {holiday}')

    if not astronomical.published_at:
        raise IngestionError('missing-column', f'{year} calendar table states no publication date')

    astronomical_layer = {
        'status': 'published',
        'datasetId': 'cwa-calendar-table',
        'edition': astronomical.edition,
        'publishedAt': astronomical.published_at,
        'retrievedAt': retrieved_at,
        'checksum': astronomical.checksum,
    }
    return {
        'year': year,
        'rocYear': year - ROC_EPOCH_OFFSET,
        'layers': {
            'lunar': astronomical_layer,
            'solarTerm': dict(astronomical_layer),
            'official': {
                'status': 'revised' if official.revised else 'published',
                'datasetId': 'dgpa-office-calendar',
                'edition': official.edition,
                'publishedAt': official.published_at,
                'retrievedAt': retrieved_at,
                'checksum': official.checksum,
            },
        },
        'lunarNewYear': lunar_new_year,
        'lunarMonths': months,
        'solarTerms': solar_terms,
        'officialDays': official_days,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', default=str(ROOT / 'artifacts/taiwan-calendar-sources'))
    parser.add_argument('--retrieved-at', default=dt.date.today().isoformat())
    args = parser.parse_args()

    cache = Path(args.cache)
    note_labels = read_note_labels()
    coverage = read_coverage()
    first = max(coverage['dgpa-office-calendar'][0], coverage['cwa-calendar-table'][0])
    last = min(coverage['dgpa-office-calendar'][1], coverage['cwa-calendar-table'][1])
    cross_check = coverage['hko-lunar-calendar']

    resources, official_published = resolve_official_resources(cache)
    years: list[dict] = []
    for year in range(first, last + 1):
        if year not in resources:
            raise SystemExit(f'{year}: the office calendar dataset no longer offers this year')

        resource = resources[year]
        csv_file = fetch(resource.url, cache, f'dgpa-{year}.csv')
        official = OfficialYear(
            days=parse_official_year(decode(csv_file.body, year), year, note_labels),
            edition=resource.edition,
            published_at=official_published,
            checksum=csv_file.checksum,
            revised=resource.revised,
        )

        pdf = fetch(CWA_PDF.format(year=year), cache, f'cwa-{year}.pdf')
        months, edition, solar_terms, printed = parse_astronomical_year(pdf.body, year)
        astronomical = AstronomicalYear(
            months=months, edition=edition, solar_terms=solar_terms,
            sexagenary=printed, published_at=pdf.last_modified, checksum=pdf.checksum,
        )

        if cross_check[0] <= year <= cross_check[1]:
            table = fetch(HKO_TABLE.format(year=year), cache, f'hko-{year}.txt')
            cross_check_year(decode(table.body, year), year, months, solar_terms)

        years.append(build_year(year, official, astronomical, args.retrieved_at))
        print(f'{year}: {len(official.days)} annotated days, {len(months)} lunar months, {len(solar_terms)} terms')

    OUTPUT.mkdir(parents=True, exist_ok=True)
    for existing in OUTPUT.glob('*.json'):
        existing.unlink()
    for dataset in years:
        path = OUTPUT / f'{dataset["year"]}.json'
        path.write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + '\n')
    print(f'wrote {len(years)} years to {OUTPUT.relative_to(ROOT)}')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except IngestionError as error:
        print(f'ingestion failed — {error}', file=sys.stderr)
        sys.exit(1)
