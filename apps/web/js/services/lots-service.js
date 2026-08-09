export function createLotsService({ supabase }) {
  async function saveLot({ id, row }) {
    const query = id ? supabase.from('lots').update(row).eq('id', id) : supabase.from('lots').insert(row);
    const { error } = await query;
    if (error) throw error;
  }
  async function setStatus(id, status) {
    const { error } = await supabase.from('lots').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }
  return { saveLot, setStatus };
}
