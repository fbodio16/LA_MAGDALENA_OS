export function createLotFilters() {
  function getAvailableCrops(lots) {
    return [...new Set(lots.map(lot => lot.crop).filter(Boolean))];
  }

  function filterLots(lots, { query = '', crop = '', status = '' } = {}) {
    const normalizedQuery = query.trim().toLowerCase();
    return lots.filter(lot => {
      const matchesQuery =
        !normalizedQuery ||
        [lot.name, lot.crop, lot.variety].some(value =>
          String(value || '').toLowerCase().includes(normalizedQuery),
        );
      const matchesCrop = !crop || lot.crop === crop;
      const matchesStatus = !status || lot.status === status;
      return matchesQuery && matchesCrop && matchesStatus;
    });
  }

  return { getAvailableCrops, filterLots };
}
