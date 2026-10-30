function parseDateRange(query) {
  const { from_date, to_date, period } = query;
  const now = new Date();
  let start;
  let end;

  if (from_date && to_date) {
    start = new Date(from_date);
    end = new Date(to_date);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'daily') {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'weekly') {
    start = new Date(now);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
  } else {
    start = new Date(now);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

module.exports = { parseDateRange };
