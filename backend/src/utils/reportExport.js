function buildCsvContent(headers, rows) {
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      })
      .join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

function rowsToSheetData(headers, rows) {
  return [headers, ...rows.map((row) => headers.map((h) => row[h] ?? ''))];
}

module.exports = { buildCsvContent, rowsToSheetData };
