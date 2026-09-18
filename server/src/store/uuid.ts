// Postgres raises on a malformed uuid instead of returning no row, so an
// unknown id would surface as a 500 where the contract owes a 404.
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID.test(value);
