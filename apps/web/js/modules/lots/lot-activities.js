export function createLotActivities() {
  function getSummary(state, lotId) {
    const cuts = state.cuts.filter(item => item.lot_id === lotId);
    const irrigations = state.irrigations.filter(item => item.lot_id === lotId);
    const orders = state.orders.filter(item => item.lot_id === lotId);
    const analyses = state.analyses.filter(item => item.lot_id === lotId);
    const rolls = cuts.reduce(
      (total, item) => total + Number(item.bales || item.rolls || 0),
      0,
    );

    return { cuts, irrigations, orders, analyses, rolls };
  }

  return { getSummary };
}
